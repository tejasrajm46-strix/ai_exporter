/**
 * Minimal, dependency-free Chrome DevTools Protocol client plus a static file
 * server. It exists so the exporter can be exercised in a real browser (Canvas,
 * MathML, DOMParser, CSS layout) from Node without adding Playwright.
 *
 * Usage:
 *   import { launch } from "./cdp.js";
 *   const browser = await launch();
 *   const page = await browser.newPage();
 *   await page.goto("http://127.0.0.1:1234/selftest.html");
 *   const value = await page.evaluate("1 + 1");
 *   await browser.close();
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf"
};

/** Serve one directory tree over http://127.0.0.1:<port>. */
export async function serve(root) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      let file = path.join(root, decodeURIComponent(url.pathname));
      if (!file.startsWith(root)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const info = await stat(file).catch(() => null);
      if (info && info.isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      response.writeHead(200, {
        "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Chrome lives in the usual places; AI_EXPORTER_CHROME overrides the search. */
export function findChrome() {
  const candidates = [
    process.env.AI_EXPORTER_CHROME,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

class Connection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message}${message.error.data ? ` (${message.error.data})` : ""}`));
        else resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out.`));
      }, 30000);
    });
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** One attached page target. */
class Page {
  constructor(browser, targetId, sessionId) {
    this.browser = browser;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.consoleErrors = [];
    this.networkFailures = [];
  }

  send(method, params) {
    return this.browser.connection.send(method, params, this.sessionId);
  }

  async evaluate(expression, { awaitPromise = true } = {}) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(text || "Page evaluation failed.");
    }
    return result.result.value;
  }

  async waitFor(expression, { timeout = 30000, interval = 120, label = expression } = {}) {
    const started = Date.now();
    for (;;) {
      const value = await this.evaluate(expression, { awaitPromise: false }).catch(() => false);
      if (value) return value;
      if (Date.now() - started > timeout) throw new Error(`Timed out waiting for ${label}.`);
      await sleep(interval);
    }
  }

  async goto(url) {
    await this.send("Page.enable");
    const loaded = new Promise((resolve) => {
      const off = this.browser.connection.on((message) => {
        if (message.method === "Page.loadEventFired" && message.sessionId === this.sessionId) {
          off();
          resolve();
        }
      });
      setTimeout(() => {
        off();
        resolve();
      }, 20000);
    });
    await this.send("Page.navigate", { url });
    await loaded;
    return this;
  }

  async setViewport(width, height, deviceScaleFactor = 1) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor, mobile: false
    });
  }

  async screenshot(file) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(data, "base64"));
    return file;
  }

  async printToPDF(file, options = {}) {
    const { data } = await this.send("Page.printToPDF", {
      preferCSSPageSize: true,
      printBackground: true,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      ...options
    });
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(data, "base64"));
    return file;
  }

  async close() {
    await this.browser.connection.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {});
  }
}

export async function launch({ headless = true, width = 1440, height = 1000 } = {}) {
  const executable = findChrome();
  if (!executable) throw new Error("Chrome was not found. Set AI_EXPORTER_CHROME to its path.");
  const profile = await mkdtemp(path.join(tmpdir(), "ai-exporter-chrome-"));
  const port = 9400 + Math.floor(Math.random() * 400);
  const args = [
    headless ? "--headless=new" : null,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--force-color-profile=srgb",
    "--hide-scrollbars",
    "about:blank"
  ].filter(Boolean);

  const child = spawn(executable, args, { stdio: "ignore", windowsHide: true });
  let version = null;
  for (let attempt = 0; attempt < 150 && !version; attempt += 1) {
    await sleep(100);
    version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null);
  }
  if (!version) {
    child.kill();
    throw new Error("Chrome did not expose its debugging endpoint.");
  }

  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not attach to Chrome.")), { once: true });
  });
  const connection = new Connection(socket);
  const browser = {
    version,
    connection,
    async newPage() {
      const { targetId } = await connection.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await connection.send("Target.attachToTarget", { targetId, flatten: true });
      const page = new Page(browser, targetId, sessionId);
      await page.send("Runtime.enable");
      await page.send("Log.enable").catch(() => {});
      connection.on((message) => {
        if (message.sessionId !== sessionId) return;
        if (message.method === "Runtime.exceptionThrown") {
          page.consoleErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        }
        if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
          page.consoleErrors.push(message.params.entry.text);
        }
        if (message.method === "Network.loadingFailed") {
          page.networkFailures.push(message.params.errorText);
        }
      });
      await page.setViewport(width, height);
      return page;
    },
    async close() {
      await connection.send("Browser.close").catch(() => {});
      socket.close();
      child.kill();
      await sleep(200);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    }
  };
  return browser;
}

export { sleep };
