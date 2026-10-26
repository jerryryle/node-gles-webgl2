"use strict";

// After WEBGL_lose_context.loseContext(), the context stays safe to call and answers as a
// browser's lost context does.

const assert = require("assert");
const nodeGles = require("..");

const gl = nodeGles.createWebGLRenderingContext({ width: 4, height: 4 });
const texture = gl.createTexture();
const extension = gl.getExtension("WEBGL_lose_context");
assert.strictEqual(gl.isContextLost(), false);
extension.loseContext();

assert.strictEqual(gl.isContextLost(), true);
assert.strictEqual(gl.getError(), gl.CONTEXT_LOST_WEBGL);
assert.strictEqual(gl.getError(), gl.NO_ERROR, "CONTEXT_LOST_WEBGL is reported once");

// Calls quietly do nothing, and answer as a browser's lost context does.
gl.clearColor(1, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.drawArrays(gl.TRIANGLES, 0, 3);
assert.strictEqual(gl.createTexture(), null);
assert.strictEqual(gl.getParameter(gl.VIEWPORT), null);
assert.strictEqual(gl.getExtension("WEBGL_lose_context"), null);
assert.strictEqual(gl.getSupportedExtensions(), null);
assert.strictEqual(gl.isTexture(texture), false);
assert.strictEqual(gl.getAttribLocation(null, "p"), -1);
assert.strictEqual(gl.checkFramebufferStatus(gl.FRAMEBUFFER), gl.FRAMEBUFFER_UNSUPPORTED);

// Its fixed values keep answering, as in a browser.
assert.strictEqual(gl.drawingBufferWidth, 4);
assert.strictEqual(gl.TEXTURE_2D, 0x0DE1);

// Losing it again, and restoring it, do nothing.
extension.loseContext();
extension.restoreContext();
assert.strictEqual(gl.isContextLost(), true);

// A context nobody lost is untouched.
const other = nodeGles.createWebGLRenderingContext({ width: 4, height: 4 });
assert.strictEqual(other.isContextLost(), false);
assert.notStrictEqual(other.createTexture(), null);

console.log("context loss smoke test passed");
