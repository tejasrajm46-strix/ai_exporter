/**
 * Evaluate expressions against the real exporter in headless Chrome.
 *
 * Usage:
 *   node tools/probe.js "AIExporter.texToMathML('\\frac{a}{b}', true)"
 *   node tools/probe.js --file probes.js
 *
 * The file form exports an object of {label: expression} or a function body
 * returning JSON. Probes load selftest.html, which installs the real modules.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { launch, serve } from "./cdp.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const source = fileIndex >= 0
  ? await readFile(path.resolve(args[fileIndex + 1]), "utf8")
  : args.join(" ");

const server = await serve(ROOT);
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/selftest.html?probe=1`);
  await page.waitFor("globalThis.AIExporter && globalThis.AIExporterDocx", { label: "the exporter modules" });
  const value = await page.evaluate(`(async () => { ${source} })()`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
} finally {
  await browser.close();
  await server.close();
}
