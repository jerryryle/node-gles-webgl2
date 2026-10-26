/**
 * @license
 * Copyright 2026 node-gles-webgl2 contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

// Browser-style WebGL objects for the native context.
//
// In plain terms: OpenGL names every texture, buffer, framebuffer and so on by a number. The
// native binding hands those numbers straight to JavaScript, but a browser hands out objects,
// one per thing created, and the same thing always comes back as the same object. Libraries
// written for browsers rely on that: three.js, for one, files per-framebuffer state in a
// WeakMap, which only accepts objects as keys, so every off-screen render target throws.
//
// This module wraps a context so it behaves like a browser's. Each create call returns an
// object holding the number. Every method that takes such an object hands the native call its
// number, and every method that reports one hands back the same object it created, or null
// where OpenGL reports 0, meaning "nothing". A bare number still passes through unchanged, so
// code written against the numbers keeps working.

// tslint:disable:no-any

/** What every wrapped object shares: the number OpenGL names it by. */
export class WebGLObjectHandle {
  /** Set by the matching delete call; a deleted object is never reported again. */
  deleted = false;
  constructor(readonly name: number) {}
}

// One class per kind of object, so code that inspects them can tell them apart.
export class WebGLBuffer extends WebGLObjectHandle {}
export class WebGLFramebuffer extends WebGLObjectHandle {}
export class WebGLRenderbuffer extends WebGLObjectHandle {}
export class WebGLTexture extends WebGLObjectHandle {}
export class WebGLProgram extends WebGLObjectHandle {}
export class WebGLShader extends WebGLObjectHandle {}
export class WebGLVertexArrayObject extends WebGLObjectHandle {}
export class WebGLQuery extends WebGLObjectHandle {}
export class WebGLSampler extends WebGLObjectHandle {}
export class WebGLTransformFeedback extends WebGLObjectHandle {}

type Kind = new (name: number) => WebGLObjectHandle;

// Each kind's create and delete method names.
const KINDS: Array<[Kind, string, string]> = [
  [WebGLBuffer, 'createBuffer', 'deleteBuffer'],
  [WebGLFramebuffer, 'createFramebuffer', 'deleteFramebuffer'],
  [WebGLRenderbuffer, 'createRenderbuffer', 'deleteRenderbuffer'],
  [WebGLTexture, 'createTexture', 'deleteTexture'],
  [WebGLProgram, 'createProgram', 'deleteProgram'],
  [WebGLShader, 'createShader', 'deleteShader'],
  [WebGLVertexArrayObject, 'createVertexArray', 'deleteVertexArray'],
  [WebGLQuery, 'createQuery', 'deleteQuery'],
  [WebGLSampler, 'createSampler', 'deleteSampler'],
  [WebGLTransformFeedback, 'createTransformFeedback', 'deleteTransformFeedback'],
];

// The methods that take an object somewhere among their arguments. Each argument that is one
// of this module's objects is replaced by its number; every other argument is left alone.
const TAKES_OBJECTS = [
  'isBuffer', 'bindBuffer', 'bindBufferBase', 'bindBufferRange',
  'isFramebuffer', 'bindFramebuffer',
  'isRenderbuffer', 'bindRenderbuffer', 'framebufferRenderbuffer',
  'isTexture', 'bindTexture', 'framebufferTexture2D', 'framebufferTextureLayer',
  'isProgram', 'useProgram', 'attachShader', 'detachShader', 'linkProgram', 'validateProgram',
  'getProgramParameter', 'getProgramInfoLog', 'getActiveAttrib', 'getActiveUniform',
  'getActiveUniforms', 'getActiveUniformBlockName', 'getActiveUniformBlockParameter',
  'getUniformBlockIndex', 'getUniformIndices', 'getUniform', 'getUniformLocation',
  'getAttribLocation', 'bindAttribLocation', 'getFragDataLocation', 'uniformBlockBinding',
  'transformFeedbackVaryings', 'getTransformFeedbackVarying',
  'isShader', 'shaderSource', 'compileShader', 'getShaderParameter', 'getShaderInfoLog',
  'getShaderSource',
  'isVertexArray', 'bindVertexArray',
  'isQuery', 'beginQuery', 'getQueryParameter',
  'queryCounterEXT',  // the native context also carries the timer query extension's method
  'isSampler', 'bindSampler', 'samplerParameteri', 'samplerParameterf', 'getSamplerParameter',
  'isTransformFeedback', 'bindTransformFeedback',
];

// The getParameter queries that report a bound object, by the name of their constant.
const BOUND_BY_PARAMETER: Array<[string, Kind]> = [
  ['ARRAY_BUFFER_BINDING', WebGLBuffer],
  ['ELEMENT_ARRAY_BUFFER_BINDING', WebGLBuffer],
  ['COPY_READ_BUFFER_BINDING', WebGLBuffer],
  ['COPY_WRITE_BUFFER_BINDING', WebGLBuffer],
  ['PIXEL_PACK_BUFFER_BINDING', WebGLBuffer],
  ['PIXEL_UNPACK_BUFFER_BINDING', WebGLBuffer],
  ['TRANSFORM_FEEDBACK_BUFFER_BINDING', WebGLBuffer],
  ['UNIFORM_BUFFER_BINDING', WebGLBuffer],
  ['DRAW_FRAMEBUFFER_BINDING', WebGLFramebuffer],  // the same constant as FRAMEBUFFER_BINDING
  ['READ_FRAMEBUFFER_BINDING', WebGLFramebuffer],
  ['RENDERBUFFER_BINDING', WebGLRenderbuffer],
  ['TEXTURE_BINDING_2D', WebGLTexture],
  ['TEXTURE_BINDING_CUBE_MAP', WebGLTexture],
  ['TEXTURE_BINDING_3D', WebGLTexture],
  ['TEXTURE_BINDING_2D_ARRAY', WebGLTexture],
  ['CURRENT_PROGRAM', WebGLProgram],
  ['VERTEX_ARRAY_BINDING', WebGLVertexArrayObject],
  ['SAMPLER_BINDING', WebGLSampler],
  ['TRANSFORM_FEEDBACK_BINDING', WebGLTransformFeedback],
];

/** The objects one context has handed out: for each kind, its live objects by number. */
class Registry {
  private readonly byKind = new Map<Kind, Map<number, WebGLObjectHandle>>();

  private live(kind: Kind): Map<number, WebGLObjectHandle> {
    let map = this.byKind.get(kind);
    if (!map) {
      map = new Map();
      this.byKind.set(kind, map);
    }
    return map;
  }

  /** The object for a number OpenGL reports: the one already handed out, a new one for a
   *  number this context never handed out, or null for 0 ("nothing"). */
  wrap(kind: Kind, name: any): WebGLObjectHandle|null {
    if (typeof name !== 'number') return name;
    if (name === 0) return null;
    const live = this.live(kind);
    let object = live.get(name);
    if (!object) {
      object = new kind(name);
      live.set(name, object);
    }
    return object;
  }

  /** Forget a deleted object, so a number OpenGL reuses later gets a new object. */
  forget(object: WebGLObjectHandle): void {
    object.deleted = true;
    const live = this.live(object.constructor as Kind);
    if (live.get(object.name) === object) live.delete(object.name);
  }
}

/** The number to hand the native call: an object's number, or the value unchanged. */
function unwrap(value: any): any {
  return value instanceof WebGLObjectHandle ? value.name : value;
}

function unwrapAll(args: IArguments): any[] {
  const out = new Array(args.length);
  for (let i = 0; i < args.length; i++) out[i] = unwrap(args[i]);
  return out;
}

/** Replace `name` on `target` with `make(original)`. The native context's methods cannot be
 *  assigned, so each replacement is defined as the object's own property. */
function replace(target: any, name: string, make: (original: Function) => Function): void {
  const original = target[name];
  if (typeof original !== 'function') return;  // a method this context does not have
  Object.defineProperty(target, name, {
    value: make(original.bind(target)),
    configurable: true,
    writable: true,
    enumerable: false,
  });
}

/** Make `gl` hand out and accept browser-style WebGL objects. Returns `gl`. */
export function useWebGLObjects<T>(gl: T): T {
  const context = gl as any;
  const registry = new Registry();

  for (const [kind, create, remove] of KINDS) {
    replace(context, create, (original) => function() {
      return registry.wrap(kind, original.apply(null, arguments));
    });
    replace(context, remove, (original) => function(object: any) {
      if (object instanceof WebGLObjectHandle) {
        if (object.deleted) return;  // a browser ignores a second delete
        registry.forget(object);
      }
      original(unwrap(object));
    });
  }

  for (const name of TAKES_OBJECTS) {
    replace(context, name, (original) => function() {
      // A browser reports false for an object it has deleted, even once OpenGL reuses its
      // number for something new.
      if (name.lastIndexOf('is', 0) === 0 && arguments[0] instanceof WebGLObjectHandle &&
          arguments[0].deleted) {
        return false;
      }
      return original.apply(null, unwrapAll(arguments));
    });
  }

  const boundBy = new Map<number, Kind>();
  for (const [constant, kind] of BOUND_BY_PARAMETER) {
    if (typeof context[constant] === 'number') boundBy.set(context[constant], kind);
  }
  replace(context, 'getParameter', (original) => function(pname: number) {
    const value = original(pname);
    const kind = boundBy.get(pname);
    return kind ? registry.wrap(kind, value) : value;
  });

  replace(context, 'getIndexedParameter', (original) => function(target: number, index: number) {
    const value = original(target, index);
    return target === context.TRANSFORM_FEEDBACK_BUFFER_BINDING ||
            target === context.UNIFORM_BUFFER_BINDING ?
        registry.wrap(WebGLBuffer, value) :
        value;
  });

  replace(context, 'getVertexAttrib', (original) => function(index: number, pname: number) {
    const value = original(index, pname);
    return pname === context.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING ?
        registry.wrap(WebGLBuffer, value) :
        value;
  });

  replace(
      context, 'getFramebufferAttachmentParameter',
      (original) => function(target: number, attachment: number, pname: number) {
        const value = original(target, attachment, pname);
        if (pname !== context.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME) return value;
        // The attachment is a texture or a renderbuffer; OpenGL says which.
        const type =
            original(target, attachment, context.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
        if (type === context.TEXTURE) return registry.wrap(WebGLTexture, value);
        if (type === context.RENDERBUFFER) return registry.wrap(WebGLRenderbuffer, value);
        return value;
      });

  replace(context, 'getAttachedShaders', (original) => function(program: any) {
    const shaders = original(unwrap(program));
    return Array.isArray(shaders) ?
        shaders.map((name: any) => registry.wrap(WebGLShader, name)) :
        shaders;
  });

  replace(context, 'getQuery', (original) => function(target: number, pname: number) {
    // Only CURRENT_QUERY reports a query; QUERY_COUNTER_BITS_EXT reports a count.
    const value = original(target, pname);
    return pname === context.CURRENT_QUERY ? registry.wrap(WebGLQuery, value) : value;
  });

  // Two extensions carry objects too: vertex arrays for WebGL 1 code, and the timer query.
  const wrapped = new WeakSet<object>();
  replace(context, 'getExtension', (original) => function(extensionName: string) {
    const extension = original(extensionName);
    if (!extension || typeof extension !== 'object' || wrapped.has(extension)) return extension;
    wrapped.add(extension);
    replace(extension, 'createVertexArrayOES', (create) => function() {
      return registry.wrap(WebGLVertexArrayObject, create());
    });
    replace(extension, 'deleteVertexArrayOES', (remove) => function(object: any) {
      if (object instanceof WebGLObjectHandle) {
        if (object.deleted) return;
        registry.forget(object);
      }
      remove(unwrap(object));
    });
    for (const name of ['isVertexArrayOES', 'bindVertexArrayOES', 'queryCounterEXT']) {
      replace(extension, name, (method) => function() {
        return method.apply(null, unwrapAll(arguments));
      });
    }
    return extension;
  });

  return gl;
}
