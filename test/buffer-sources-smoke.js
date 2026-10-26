"use strict";

// bufferData, bufferSubData and getBufferSubData accept raw binary data, an ArrayBuffer or a
// DataView, as a browser's context does, and a null source reports INVALID_VALUE.

const assert = require("assert");
const nodeGles = require("..");

const gl = nodeGles.createWebGLRenderingContext({ width: 4, height: 4 });
const buffer = gl.createBuffer();
gl.bindBuffer(gl.COPY_READ_BUFFER, buffer);
const bytes = (count) => {
  const out = new Uint8Array(count);
  gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, out);
  return [...out];
};

gl.bufferData(gl.COPY_READ_BUFFER, new Uint8Array([1, 2, 3, 4]).buffer, gl.STATIC_DRAW);
assert.deepStrictEqual(bytes(4), [1, 2, 3, 4]);

// A DataView over the middle of a larger buffer uploads only its own bytes.
const whole = new Uint8Array([9, 5, 6, 7, 8, 9]);
gl.bufferData(gl.COPY_READ_BUFFER, new DataView(whole.buffer, 1, 4), gl.STATIC_DRAW);
assert.deepStrictEqual(bytes(4), [5, 6, 7, 8]);

gl.bufferSubData(gl.COPY_READ_BUFFER, 1, new Uint8Array([0, 0]).buffer);
assert.deepStrictEqual(bytes(4), [5, 0, 0, 8]);
gl.bufferSubData(gl.COPY_READ_BUFFER, 0, new DataView(new Uint8Array([3]).buffer));
assert.deepStrictEqual(bytes(4), [3, 0, 0, 8]);

// A DataView's offsets count bytes.
gl.bufferSubData(gl.COPY_READ_BUFFER, 0, new DataView(new Uint8Array([1, 2, 6, 4]).buffer), 2, 1);
assert.deepStrictEqual(bytes(4), [6, 0, 0, 8]);

// Reading back into a DataView fills that view's own bytes.
const target = new Uint8Array(6);
gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, new DataView(target.buffer, 1, 4));
assert.deepStrictEqual([...target], [0, 6, 0, 0, 8, 0]);
assert.strictEqual(gl.getError(), gl.NO_ERROR);

// A null source reports INVALID_VALUE instead of throwing.
gl.bufferData(gl.COPY_READ_BUFFER, null, gl.STATIC_DRAW);
assert.strictEqual(gl.getError(), gl.INVALID_VALUE);
gl.bufferSubData(gl.COPY_READ_BUFFER, 0, null);
assert.strictEqual(gl.getError(), gl.INVALID_VALUE);
assert.strictEqual(gl.getError(), gl.NO_ERROR);

console.log("buffer sources smoke test passed");
