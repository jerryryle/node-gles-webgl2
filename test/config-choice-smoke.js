"use strict";

// The drawing buffer's config is the one with a browser's sizes (8 bits for each of red, green,
// blue and alpha, 24 of depth and 8 of stencil), with 4 samples when the context asks for
// antialiasing. EGL lists the deepest configs first, so taking the first config gives a
// Raspberry Pi 5 a buffer with 16 bits a channel. No context made in a test can show that,
// because the test machines' first config already has 8 bits a channel, so this test runs the
// choice itself on the list the Pi's EGL gives, from fixtures/board-egl-configs.txt.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const binding = require("bindings")("nodejs_gl_binding");

const ES3 = 0x40; // EGL_OPENGL_ES3_BIT

// Each line is: config id, red, green, blue, alpha, depth, stencil, samples, float, renderable
// type. The choice reads all but the id and the float flag.
const rows = fs.readFileSync(path.join(__dirname, "fixtures", "board-egl-configs.txt"), "utf8")
  .split("\n").filter((line) => line && !line.startsWith("#"))
  .map((line) => line.trim().split(/\s+/));
assert.strictEqual(rows.length, 70);
const ids = rows.map((row) => Number(row[0]));
const configs = rows.map((row) => [...row.slice(1, 8).map(Number), Number(row[9])]);

const choose = (list, antialias, es3 = true) => binding._chooseConfigIndexForTest(list, antialias, es3);

// The Pi's EGL lists config 64 (16 bits a channel) first for the binding's minimums; the choice
// takes config 29 (4 samples) or config 24 (none).
assert.strictEqual(ids[choose(configs, true)], 29);
assert.strictEqual(ids[choose(configs, false)], 24);

const exact = [8, 8, 8, 8, 24, 8];
const deep = [16, 16, 16, 16, 24, 8, 0, ES3];
// With no 4-sample exact match, an antialiased context takes the single-sampled one.
assert.strictEqual(choose([deep, [...exact, 0, ES3]], true), 1);
// With no exact match at all, the choice takes the first config.
assert.strictEqual(choose([deep, [16, 16, 16, 16, 24, 8, 4, ES3]], true), 0);
assert.strictEqual(choose([deep, [8, 8, 8, 0, 24, 8, 0, ES3]], false), 0);
// An ES2-only exact match is passed over when the context asks for ES 3.
assert.strictEqual(choose([deep, [...exact, 4, 0x4], [...exact, 4, ES3]], true), 2);
// With no ES3-capable config at all, the choice takes the first, and the binding then falls
// back to ES 2.0 as it always has.
assert.strictEqual(choose([[16, 16, 16, 16, 24, 8, 0, 0x4], [...exact, 4, 0x4]], true), 0);
// A context that asks for ES 2 takes an ES2-only exact match.
assert.strictEqual(choose([deep, [...exact, 0, 0x4]], false, false), 1);

console.log("config choice smoke test passed");
