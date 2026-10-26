"use strict";

// The uniform array setters read only the slice WebGL 2's `srcOffset` and `srcLength` name, as
// a browser's context does.

const assert = require("assert");
const nodeGles = require("..");

const gl = nodeGles.createWebGLRenderingContext({ width: 4, height: 4 });
function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  assert(gl.getShaderParameter(shader, gl.COMPILE_STATUS), gl.getShaderInfoLog(shader));
  return shader;
}
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER,
    "#version 300 es\nuniform vec4 v; uniform ivec2 i; uniform uvec2 u; uniform mat4 m; uniform mat2x3 n;\n" +
    "void main() { gl_Position = m * v + vec4(i, u) * 0.0 + vec4(n[0], 0.0); }"));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER,
    "#version 300 es\nprecision highp float; out vec4 o; void main() { o = vec4(1.0); }"));
gl.linkProgram(program);
gl.useProgram(program);
const at = (name) => gl.getUniformLocation(program, name);
const read = (name) => Array.from(gl.getUniform(program, at(name)));

gl.uniform4fv(at("v"), new Float32Array([9, 1, 2, 3, 4, 9]), 1, 4);
assert.deepStrictEqual(read("v"), [1, 2, 3, 4]);
gl.uniform4fv(at("v"), [9, 9, 5, 6, 7, 8], 2);  // a plain array, to the end
assert.deepStrictEqual(read("v"), [5, 6, 7, 8]);
gl.uniform2iv(at("i"), new Int32Array([0, 3, 4]), 1, 2);
assert.deepStrictEqual(read("i"), [3, 4]);
gl.uniform2uiv(at("u"), new Uint32Array([0, 0, 5, 6]), 2, 0);
assert.deepStrictEqual(read("u"), [5, 6]);
const values = Float32Array.from({ length: 20 }, (_, k) => k);
gl.uniformMatrix4fv(at("m"), false, values, 4, 16);
assert.strictEqual(read("m")[0], 4);
assert.strictEqual(read("m")[15], 19);
gl.uniformMatrix2x3fv(at("n"), false, values, 10, 6);
assert.deepStrictEqual(read("n"), [10, 11, 12, 13, 14, 15]);

// The forms without an offset are unchanged.
gl.uniform4fv(at("v"), [1, 1, 1, 1]);
assert.deepStrictEqual(read("v"), [1, 1, 1, 1]);
assert.strictEqual(gl.getError(), gl.NO_ERROR);

// A slice past the array's end sets nothing and reports INVALID_VALUE.
gl.uniform4fv(at("v"), new Float32Array([2, 2, 2, 2]), 2, 4);
assert.strictEqual(gl.getError(), gl.INVALID_VALUE);
assert.deepStrictEqual(read("v"), [1, 1, 1, 1]);

console.log("uniform offsets smoke test passed");
