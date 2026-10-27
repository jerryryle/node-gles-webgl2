"use strict";

// The `antialias` option chooses whether the drawing buffer is multisampled, and
// getContextAttributes().antialias reports what the buffer is.
//
// Every backend: the report agrees with the buffer's SAMPLES, for both values of the option.
// SwiftShader on the arm64 builds, whose configs are known to include 8/8/8/8 with 24/8 depth
// and stencil at 0 and at 4 samples: the option gives exactly those buffers. Other SwiftShader
// builds are not known to offer them, so they get only the first check.

const assert = require("assert");
const {execFileSync} = require("child_process");
const {createWebGLRenderingContext} = require("..");

function buffer(antialias) {
  const gl = createWebGLRenderingContext({width: 4, height: 4, webGLCompatibility: true, antialias});
  try {
    const bits = ["RED_BITS", "GREEN_BITS", "BLUE_BITS", "ALPHA_BITS", "DEPTH_BITS", "STENCIL_BITS"]
      .map((name) => gl.getParameter(gl[name]));
    return {samples: gl.getParameter(gl.SAMPLES), antialias: gl.getContextAttributes().antialias, bits};
  } finally {
    gl.destroy();
  }
}

if (process.argv.includes("--child")) {
  for (const antialias of [true, false]) {
    const got = buffer(antialias);
    assert.strictEqual(got.samples, antialias ? 4 : 0, `antialias ${antialias}: SAMPLES`);
    assert.strictEqual(got.antialias, antialias, `antialias ${antialias}: reported`);
    assert.deepStrictEqual(got.bits, [8, 8, 8, 8, 24, 8], `antialias ${antialias}: sizes`);
  }
} else {
  for (const antialias of [true, false]) {
    const got = buffer(antialias);
    assert.strictEqual(got.antialias, got.samples > 0,
        `antialias ${antialias}: reported ${got.antialias} for SAMPLES ${got.samples}`);
  }
  const probed = process.arch === "arm64" && (process.platform === "linux" || process.platform === "darwin");
  if (probed) {
    // A fresh process with no window server, as swiftshader-smoke.js runs one.
    const env = Object.assign({}, process.env, {ANGLE_DEFAULT_PLATFORM: "swiftshader"});
    delete env.DISPLAY;
    delete env.WAYLAND_DISPLAY;
    execFileSync(process.execPath, [__filename, "--child"], {env, stdio: "inherit"});
  }
}

console.log("antialias smoke test passed");
