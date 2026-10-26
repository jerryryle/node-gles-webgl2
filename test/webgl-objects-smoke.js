"use strict";

// The context hands out browser-style WebGL objects: one object per texture, buffer,
// framebuffer and so on, the same object back from every query, and null for "nothing". This
// is what lets three.js keep per-framebuffer state in a WeakMap, which every off-screen render
// target needs.

const assert = require("assert");
const THREE = require("three");
const nodeGles = require("..");

const WIDTH = 64;
const HEIGHT = 32;

function createContext() {
  return nodeGles.createWebGLRenderingContext({ width: WIDTH, height: HEIGHT });
}

function assertObject(value, Kind, what) {
  assert.strictEqual(typeof value, "object", `${what} should be an object, not ${typeof value}`);
  assert(value instanceof Kind, `${what} should be a ${Kind.name}`);
}

// Each kind of object: how to make one, how to bind it, and the query that reports the binding.
function kinds(gl) {
  return [
    ["buffer", nodeGles.WebGLBuffer, () => gl.createBuffer(),
      (b) => gl.bindBuffer(gl.ARRAY_BUFFER, b), gl.ARRAY_BUFFER_BINDING],
    ["framebuffer", nodeGles.WebGLFramebuffer, () => gl.createFramebuffer(),
      (f) => gl.bindFramebuffer(gl.FRAMEBUFFER, f), gl.FRAMEBUFFER_BINDING],
    ["renderbuffer", nodeGles.WebGLRenderbuffer, () => gl.createRenderbuffer(),
      (r) => gl.bindRenderbuffer(gl.RENDERBUFFER, r), gl.RENDERBUFFER_BINDING],
    ["texture", nodeGles.WebGLTexture, () => gl.createTexture(),
      (t) => gl.bindTexture(gl.TEXTURE_2D, t), gl.TEXTURE_BINDING_2D],
    ["vertex array", nodeGles.WebGLVertexArrayObject, () => gl.createVertexArray(),
      (v) => gl.bindVertexArray(v), gl.VERTEX_ARRAY_BINDING],
    ["sampler", nodeGles.WebGLSampler, () => gl.createSampler(),
      (s) => gl.bindSampler(0, s), gl.SAMPLER_BINDING],
    ["transform feedback", nodeGles.WebGLTransformFeedback, () => gl.createTransformFeedback(),
      (t) => gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, t), gl.TRANSFORM_FEEDBACK_BINDING],
  ];
}

function testBindingsReturnTheSameObject() {
  const gl = createContext();
  for (const [what, Kind, create, bind, binding] of kinds(gl)) {
    const object = create();
    assertObject(object, Kind, `create ${what}`);
    bind(object);
    assert.strictEqual(gl.getParameter(binding), object, `${what} binding returns the same object`);
    bind(null);
    assert.strictEqual(gl.getParameter(binding), null, `${what} binding reads null when unbound`);
    assert.strictEqual(gl.getError(), gl.NO_ERROR, `${what} round trip`);
  }
}

function testWeakMapKeys() {
  // three.js files framebuffer state this way, and it throws on a number.
  const gl = createContext();
  const state = new WeakMap();
  const framebuffer = gl.createFramebuffer();
  state.set(framebuffer, "draw buffers");
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  assert.strictEqual(state.get(gl.getParameter(gl.FRAMEBUFFER_BINDING)), "draw buffers");
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  assertObject(shader, nodeGles.WebGLShader, "createShader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  assert(gl.getShaderParameter(shader, gl.COMPILE_STATUS), gl.getShaderInfoLog(shader));
  return shader;
}

function testProgramsAndShaders() {
  const gl = createContext();
  const vs = compile(gl, gl.VERTEX_SHADER, "#version 300 es\nvoid main() { gl_Position = vec4(0.0); }");
  const fs = compile(gl, gl.FRAGMENT_SHADER,
      "#version 300 es\nprecision mediump float;\nout vec4 o;\nvoid main() { o = vec4(1.0); }");
  const program = gl.createProgram();
  assertObject(program, nodeGles.WebGLProgram, "createProgram");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program));
  const attached = gl.getAttachedShaders(program);
  assert.strictEqual(attached.length, 2);
  assert(attached.includes(vs) && attached.includes(fs), "getAttachedShaders returns the same shaders");
  gl.useProgram(program);
  assert.strictEqual(gl.getParameter(gl.CURRENT_PROGRAM), program);
  gl.useProgram(null);
  assert.strictEqual(gl.getParameter(gl.CURRENT_PROGRAM), null);
}

function testFramebufferAttachments() {
  const gl = createContext();
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const depth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 4, 4);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  const name = gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME;
  assert.strictEqual(gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, name), texture);
  assert.strictEqual(gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, name), depth);
  assert.strictEqual(gl.checkFramebufferStatus(gl.FRAMEBUFFER), gl.FRAMEBUFFER_COMPLETE);
}

function testIndexedAndAttributeBindings() {
  const gl = createContext();
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
  gl.bufferData(gl.UNIFORM_BUFFER, 16, gl.STATIC_DRAW);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, buffer);
  assert.strictEqual(gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, 0), buffer);
  const attributes = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, attributes);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  assert.strictEqual(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING), attributes);
}

function testDeletedObjects() {
  const gl = createContext();
  const first = gl.createTexture();
  gl.deleteTexture(first);
  assert.strictEqual(gl.isTexture(first), false);
  gl.deleteTexture(first);  // a second delete is ignored, as in a browser
  // OpenGL may give the next texture the same number; it is still a new object.
  const second = gl.createTexture();
  assert.notStrictEqual(second, first);
  gl.bindTexture(gl.TEXTURE_2D, second);
  assert.strictEqual(gl.isTexture(second), true);
  assert.strictEqual(gl.isTexture(first), false, "a deleted object stays deleted");
  assert.strictEqual(gl.getError(), gl.NO_ERROR);
}

function testNumbersStillWork() {
  // Code written against the old numbers keeps working: a bare number passes straight through.
  const gl = createContext();
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture.name);
  assert.strictEqual(gl.getParameter(gl.TEXTURE_BINDING_2D), texture);
}

function testThreeEnvironmentMap() {
  // PMREMGenerator draws the environment through off-screen render targets, which threw
  // "Invalid value used as weak map key" when framebuffers were numbers.
  const gl = createContext();
  const canvas = {
    width: WIDTH, height: HEIGHT, style: {},
    addEventListener() {}, removeEventListener() {},
    getContext: () => gl,
  };
  gl.canvas = canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  renderer.setSize(WIDTH, HEIGHT, false);

  const sky = new THREE.Scene();
  sky.background = new THREE.Color(0xff0000);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(sky).texture;
  pmrem.dispose();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0, envMap: environment })));
  const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.1, 10);
  camera.position.z = 3;
  renderer.render(scene, camera);

  const pixel = new Uint8Array(4);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.readPixels(WIDTH / 2, HEIGHT / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  assert(pixel[0] > 100 && pixel[1] < 60 && pixel[2] < 60,
      `the sphere should reflect the red environment, not ${Array.from(pixel)}`);
}

testBindingsReturnTheSameObject();
testWeakMapKeys();
testProgramsAndShaders();
testFramebufferAttachments();
testIndexedAndAttributeBindings();
testDeletedObjects();
testNumbersStillWork();
testThreeEnvironmentMap();
console.log("webgl objects smoke test passed");
