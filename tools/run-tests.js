/**
 * Run the in-browser self-checks in a real headless Chrome.
 *
 * The checks need Canvas, MathML layout, DOMParser, iframes and CSS metrics, so
 * they cannot run in Node. selftest.html reports its own result on #summary and
 * globalThis.AIExporterSelftest; this runner waits for that, prints every
 * failure, and exits non-zero when anything fails.
 *
 * Usage:
 *   npm test
 *   npm test -- --keep-screenshots
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { launch, serve, sleep } from "./cdp.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const VISUAL = path.join(ROOT, "tests", "visual");
const keepScreenshots = process.argv.includes("--keep-screenshots");

const server = await serve(ROOT);
const browser = await launch({ width: 1280, height: 1000 });
let failures = 0;

try {
  const page = await browser.newPage();
  page.consoleErrors = [];
  await page.goto(`${server.origin}/selftest.html`);
  await page.waitFor("globalThis.AIExporterSelftest && globalThis.AIExporterSelftest.complete", {
    timeout: 180000,
    label: "the self-test suite to finish"
  });
  const results = await page.evaluate("globalThis.AIExporterSelftest.results");
  for (const result of results) {
    if (!result.pass) {
      failures += 1;
      console.log(`FAIL  ${result.name}`);
      if (result.error) console.log(`      ${result.error}`);
    }
  }
  console.log(`\n${results.length - failures}/${results.length} browser checks passed.`);

  if (keepScreenshots) {
    await mkdir(VISUAL, { recursive: true });
    await page.screenshot(path.join(VISUAL, "selftest-summary.png"));
    const frame = await page.evaluate(`(() => {
      const node = document.getElementById("document");
      return node ? "ready" : "missing";
    })()`);
    if (frame === "ready") {
      await page.evaluate(`(() => { document.getElementById("light").click(); return true; })()`);
      await sleep(600);
      const rect = await page.evaluate(`(() => {
        const r = document.getElementById("document").getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })()`);
      const { data } = await page.send("Page.captureScreenshot", {
        format: "png",
        clip: { ...rect, scale: 1 }
      });
      const { writeFile } = await import("node:fs/promises");
      await writeFile(path.join(VISUAL, "document-sample.png"), Buffer.from(data, "base64"));
    }
  }

  if (page.consoleErrors.length) {
    console.log("\nPage errors reported during the run:");
    for (const error of page.consoleErrors) console.log(`  ${error.split("\n")[0]}`);
  }
} catch (error) {
  failures += 1;
  console.error(`Runner error: ${error.message}`);
} finally {
  await browser.close();
  await server.close();
}

process.exitCode = failures ? 1 : 0;
