"use strict";

// bufferData and bufferSubData upload only the slice of a typed array that WebGL 2's `srcOffset`
// and `length` name, counted in the array's own elements, as a browser's context does.

const assert = require("assert");
const THREE = require("three");
const nodeGles = require("..");

const gl = nodeGles.createWebGLRenderingContext({ width: 32, height: 32 });

function contents(buffer, count) {
  gl.bindBuffer(gl.COPY_READ_BUFFER, buffer);
  const out = new Float32Array(count);
  gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, out);
  return [...out];
}

// bufferData(target, data, usage, srcOffset, length)
let buffer = gl.createBuffer();
gl.bindBuffer(gl.COPY_READ_BUFFER, buffer);
gl.bufferData(gl.COPY_READ_BUFFER, new Float32Array([0, 1, 2, 3]), gl.STATIC_DRAW, 1, 2);
assert.deepStrictEqual(contents(buffer, 2), [1, 2]);
assert.strictEqual(gl.getBufferParameter(gl.COPY_READ_BUFFER, gl.BUFFER_SIZE), 8);

// A length of 0 means "to the end".
gl.bufferData(gl.COPY_READ_BUFFER, new Float32Array([0, 1, 2, 3]), gl.STATIC_DRAW, 1, 0);
assert.deepStrictEqual(contents(buffer, 3), [1, 2, 3]);

// bufferSubData(target, dstByteOffset, data, srcOffset, length)
gl.bufferData(gl.COPY_READ_BUFFER, new Float32Array(4), gl.STATIC_DRAW);
gl.bufferSubData(gl.COPY_READ_BUFFER, 4, new Float32Array([5, 6, 7]), 1, 1);
assert.deepStrictEqual(contents(buffer, 4), [0, 6, 0, 0]);

// The three-argument forms are unchanged.
gl.bufferSubData(gl.COPY_READ_BUFFER, 0, new Float32Array([9, 8]));
assert.deepStrictEqual(contents(buffer, 4), [9, 8, 0, 0]);
assert.strictEqual(gl.getError(), gl.NO_ERROR);

// A slice past the array's end uploads nothing and reports INVALID_VALUE.
gl.bindBuffer(gl.COPY_READ_BUFFER, buffer);
gl.bufferSubData(gl.COPY_READ_BUFFER, 0, new Float32Array([1, 2]), 1, 5);
assert.strictEqual(gl.getError(), gl.INVALID_VALUE);
assert.strictEqual(gl.getError(), gl.NO_ERROR);
assert.deepStrictEqual(contents(buffer, 4), [9, 8, 0, 0]);

// three.js uploads only the changed range of an attribute this way.
const canvas = { width: 32, height: 32, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => gl };
gl.canvas = canvas;
const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
renderer.setSize(32, 32, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.z = 3;
const positions = new Float32Array([50, 50, 0, 51, 50, 0, 50, 51, 0, 60, 60, 0, 61, 60, 0, 60, 61, 0]);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
// three.js measures a mesh's bounds once and skips one it thinks is out of view; this one moves.
mesh.frustumCulled = false;
scene.add(mesh);
renderer.render(scene, camera);
// Move the second triangle, and only it, into view.
positions.set([-1, -1, 0, 1, -1, 0, 0, 1, 0], 9);
geometry.attributes.position.addUpdateRange(9, 9);
geometry.attributes.position.needsUpdate = true;
renderer.render(scene, camera);
const pixel = new Uint8Array(4);
gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
assert(pixel[0] > 200 && pixel[1] < 50, `the updated triangle should cover the centre, not ${[...pixel]}`);

console.log("buffer offsets smoke test passed");
