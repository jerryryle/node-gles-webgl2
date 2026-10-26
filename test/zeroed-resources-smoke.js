"use strict";

// A context that behaves like a browser fills every new buffer, texture and renderbuffer with
// zeros, so a program never reads memory it did not write.

const assert = require("assert");
const nodeGles = require("..");

const gl = nodeGles.createWebGLRenderingContext({ width: 4, height: 4, webGLCompatibility: true });

// A buffer given new storage by size reads back as zeros, not as what it held before.
const buffer = gl.createBuffer();
gl.bindBuffer(gl.COPY_READ_BUFFER, buffer);
gl.bufferData(gl.COPY_READ_BUFFER, new Float32Array([7, 7, 7, 7]), gl.STATIC_DRAW);
gl.bufferData(gl.COPY_READ_BUFFER, 16, gl.STATIC_DRAW);
const contents = new Float32Array(4);
gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, contents);
assert.deepStrictEqual(Array.from(contents), [0, 0, 0, 0]);

// A texture and a renderbuffer made without data read back as zeros.
function readsZero(attach) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  attach();
  assert.strictEqual(gl.checkFramebufferStatus(gl.FRAMEBUFFER), gl.FRAMEBUFFER_COMPLETE);
  const pixels = new Uint8Array(64 * 64 * 4);
  gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels.every((v) => v === 0);
}
assert(readsZero(() => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
}), "a new texture reads as zeros");
assert(readsZero(() => {
  const renderbuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, 64, 64);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, renderbuffer);
}), "a new renderbuffer reads as zeros");
assert.strictEqual(gl.getError(), gl.NO_ERROR);

console.log("zeroed resources smoke test passed");
