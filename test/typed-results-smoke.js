"use strict";

// Queries answer with the kinds of typed array a browser's context answers with, and a vertex
// attribute set with whole numbers reads back as those whole numbers.

const assert = require("assert");
const nodeGles = require("..");

const gl = nodeGles.createWebGLRenderingContext({ width: 4, height: 4 });
function kind(value) { return value && value.constructor && value.constructor.name; }

for (const [name, expected] of [
  ["VIEWPORT", "Int32Array"], ["SCISSOR_BOX", "Int32Array"], ["MAX_VIEWPORT_DIMS", "Int32Array"],
  ["COLOR_CLEAR_VALUE", "Float32Array"], ["BLEND_COLOR", "Float32Array"], ["DEPTH_RANGE", "Float32Array"],
  ["ALIASED_POINT_SIZE_RANGE", "Float32Array"], ["ALIASED_LINE_WIDTH_RANGE", "Float32Array"],
  ["COMPRESSED_TEXTURE_FORMATS", "Uint32Array"],
]) {
  assert.strictEqual(kind(gl.getParameter(gl[name])), expected, name);
}
assert.deepStrictEqual([...gl.getParameter(gl.VIEWPORT)], [0, 0, 4, 4]);
assert.deepStrictEqual(gl.getParameter(gl.COLOR_WRITEMASK), [true, true, true, true], "COLOR_WRITEMASK stays booleans");
assert.strictEqual(kind(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA8, gl.SAMPLES)), "Int32Array");

// getUniform
function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  assert(gl.getShaderParameter(shader, gl.COMPILE_STATUS), gl.getShaderInfoLog(shader));
  return shader;
}
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER,
    "#version 300 es\nuniform vec3 v; uniform ivec2 i; uniform uvec2 u; uniform bvec2 b; uniform mat3 m;\n" +
    "uniform vec2 arr[3]; uniform float f;\n" +
    "void main() { gl_Position = vec4(v, 1) + vec4(i, u) * 0.0 + vec4(b, 0, 0) + vec4(m[0], 0) + vec4(arr[2], 0, 0) + vec4(f); }"));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER,
    "#version 300 es\nprecision highp float; out vec4 o; void main() { o = vec4(1.0); }"));
gl.linkProgram(program);
gl.useProgram(program);
const read = (name) => gl.getUniform(program, gl.getUniformLocation(program, name));
gl.uniform3f(gl.getUniformLocation(program, "v"), 1, 2, 3);
assert.strictEqual(kind(read("v")), "Float32Array");
assert.deepStrictEqual([...read("v")], [1, 2, 3]);
assert.strictEqual(kind(read("i")), "Int32Array");
assert.strictEqual(kind(read("u")), "Uint32Array");
assert.strictEqual(kind(read("m")), "Float32Array");
assert.strictEqual(kind(read("arr")), "Float32Array", "an array uniform by its name");
assert.strictEqual(kind(read("arr[2]")), "Float32Array", "an array uniform's element");
assert(Array.isArray(read("b")) && typeof read("b")[0] === "boolean", "a boolean vector stays booleans");
assert.strictEqual(typeof read("f"), "number");

// getVertexAttrib(CURRENT_VERTEX_ATTRIB)
gl.vertexAttrib4fv(1, [0.5, 1, 2, 3]);
assert.strictEqual(kind(gl.getVertexAttrib(1, gl.CURRENT_VERTEX_ATTRIB)), "Float32Array");
assert.deepStrictEqual([...gl.getVertexAttrib(1, gl.CURRENT_VERTEX_ATTRIB)], [0.5, 1, 2, 3]);
gl.vertexAttribI4i(1, 1, -2, 3, 4);
assert.strictEqual(kind(gl.getVertexAttrib(1, gl.CURRENT_VERTEX_ATTRIB)), "Int32Array");
assert.deepStrictEqual([...gl.getVertexAttrib(1, gl.CURRENT_VERTEX_ATTRIB)], [1, -2, 3, 4]);
gl.vertexAttribI4uiv(2, [5, 6, 7, 4000000000]);
assert.deepStrictEqual([...gl.getVertexAttrib(2, gl.CURRENT_VERTEX_ATTRIB)], [5, 6, 7, 4000000000]);
assert.strictEqual(gl.getError(), gl.NO_ERROR);

console.log("typed results smoke test passed");
