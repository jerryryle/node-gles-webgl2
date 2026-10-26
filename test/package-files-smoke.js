"use strict";

// The published package holds every file its own code loads. package.json lists the files it
// publishes by name, so a new module under src/ is left out of an install unless it is added
// there too, and the installed package then fails at its first require.

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
// What `npm pack` would publish, without running the build or install scripts.
const packed = JSON.parse(execFileSync(
    "npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" }));
const files = new Set(packed[0].files.map((file) => file.path));

let checked = 0;
for (const file of files) {
  if (!file.startsWith("dist/") || !file.endsWith(".js")) continue;
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of source.matchAll(/require\("(\.{1,2}\/[^"]+)"\)/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
    const candidates = [target, `${target}.js`, `${target}/index.js`];
    assert(candidates.some((candidate) => files.has(candidate)),
        `${file} loads ${match[1]}, which the published package does not include`);
    checked++;
  }
}
assert(checked > 0, "no local require was found in the published dist files");
console.log(`package files smoke test passed (${checked} local requires)`);
