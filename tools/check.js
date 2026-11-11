// Syntax-check every shipped script and confirm the manifest points at real files.
// Usage: npm run check
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SHIPPED_DIRS = ["background", "content", "export", "popup", "ui", "utils"];
const EXTRA_SCRIPTS = ["selftest.js"];

function walk(directory) {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const scripts = SHIPPED_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
for (const file of EXTRA_SCRIPTS) {
  const full = path.join(ROOT, file);
  if (existsSync(full)) scripts.push(full);
}

let failures = 0;
for (const file of scripts.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  const ok = result.status === 0;
  if (!ok) {
    failures += 1;
    console.log(`FAIL  ${path.relative(ROOT, file)}`);
    console.log(result.stderr.trim());
  } else {
    console.log(`ok    ${path.relative(ROOT, file)}`);
  }
}

// Every path the manifest names must exist in the shipped tree.
const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const referenced = new Set();
for (const file of Object.values(manifest.icons || {})) referenced.add(file);
for (const file of Object.values(manifest.action?.default_icon || {})) referenced.add(file);
if (manifest.action?.default_popup) referenced.add(manifest.action.default_popup);
if (manifest.background?.service_worker) referenced.add(manifest.background.service_worker);
for (const script of manifest.content_scripts || []) {
  for (const file of script.js || []) referenced.add(file);
  for (const file of script.css || []) referenced.add(file);
}
for (const file of [...referenced].sort()) {
  const ok = existsSync(path.join(ROOT, file));
  if (!ok) failures += 1;
  console.log(`${ok ? "ok    " : "MISSING"} ${file}`);
}

console.log(
  failures
    ? `\n${failures} problem${failures === 1 ? "" : "s"} found.`
    : `\n${scripts.length} scripts parse and ${referenced.size} manifest paths resolve.`
);
process.exitCode = failures ? 1 : 0;
