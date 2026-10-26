"use strict";

// vertexAttrib2f, vertexAttrib3f and vertexAttrib4f set each component from its own argument,
// so a shader reading the attribute sees the values the program gave.

const assert = require("assert");
const nodeGles = require("..");

const gl = nodeGles.createWebGLRenderingContext({ width: 4, height: 4 });
const current = (index) => Array.from(gl.getVertexAttrib(index, gl.CURRENT_VERTEX_ATTRIB));

gl.vertexAttrib4f(1, 0.25, 0.5, 0.75, 1);
assert.deepStrictEqual(current(1), [0.25, 0.5, 0.75, 1]);
gl.vertexAttrib3f(1, 0.75, 0.5, 0.25);
assert.deepStrictEqual(current(1), [0.75, 0.5, 0.25, 1]);
gl.vertexAttrib2f(1, 0.5, 0.25);
assert.deepStrictEqual(current(1), [0.5, 0.25, 0, 1]);

// A shader reading an attribute with no array behind it draws with the values set above.
function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  assert(gl.getShaderParameter(shader, gl.COMPILE_STATUS), gl.getShaderInfoLog(shader));
  return shader;
}
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER,
    "#version 300 es\nlayout(location = 1) in vec4 colour; out vec4 c;\n" +
    "void main() { c = colour; gl_Position = vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = 8.0; }"));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER,
    "#version 300 es\nprecision highp float; in vec4 c; out vec4 o; void main() { o = c; }"));
gl.linkProgram(program);
gl.useProgram(program);
gl.disableVertexAttribArray(1);
gl.vertexAttrib4f(1, 1, 0.5, 0, 1);
gl.drawArrays(gl.POINTS, 0, 1);
const pixel = new Uint8Array(4);
gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
assert(pixel[0] > 250 && Math.abs(pixel[1] - 128) <= 2 && pixel[2] < 5,
    `the point should be orange (255, 128, 0), not ${Array.from(pixel)}`);
assert.strictEqual(gl.getError(), gl.NO_ERROR);

console.log("vertex attribute smoke test passed");
