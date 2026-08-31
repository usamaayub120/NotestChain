import { readFileSync } from "node:fs";

const raw = readFileSync(0, "utf8").trim();
if (!raw) throw new Error("EAS did not return JSON for the Android versionCode.");

let value;
try {
  value = JSON.parse(raw);
} catch {
  throw new Error("EAS returned invalid JSON while reading the Android versionCode.");
}

const found = new Set();
function visit(node) {
  if (Array.isArray(node)) {
    node.forEach(visit);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, child] of Object.entries(node)) {
    if (key === "versionCode" && (typeof child === "number" || typeof child === "string")) {
      const parsed = Number(child);
      if (Number.isInteger(parsed) && parsed > 0) found.add(parsed);
    }
    visit(child);
  }
}
visit(value);

if (found.size !== 1) {
  throw new Error(`Expected exactly one positive Android versionCode from EAS, found ${found.size}.`);
}

console.log([...found][0]);
