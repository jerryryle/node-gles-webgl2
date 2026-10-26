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

// A lost context that stays safe to call, as a browser's does.
//
// In plain terms: WEBGL_lose_context.loseContext() tells WebGL to give up its GPU context, which
// is how a program frees GPU memory at once. In a browser the context object then stays usable:
// every call quietly does nothing, isContextLost() answers true, and getError reports
// CONTEXT_LOST_WEBGL once. The native binding destroys the context instead, and every later call,
// isContextLost() included, throws "WebGLRenderingContext has been destroyed".
//
// This module lets the native loseContext free the GPU context, then replaces each of the
// context's methods with one that answers as a browser's lost context does. Nothing changes
// until the context is lost, so ordinary calls cost nothing extra.

import {replace} from './wrap';

// tslint:disable:no-any

/** What a lost context's method answers, by the start of its name, as a browser's does. Methods
 *  not listed answer null, and a method that returns nothing ignores the answer. */
function lostAnswer(gl: any, name: string): any {
  if (name === 'isContextLost') return true;
  if (name.lastIndexOf('is', 0) === 0) return false;
  if (name === 'checkFramebufferStatus') return gl.FRAMEBUFFER_UNSUPPORTED;
  if (name === 'getAttribLocation' || name === 'getFragDataLocation') return -1;
  if (name === 'getUniformBlockIndex') return gl.INVALID_INDEX;
  if (name === 'clientWaitSync') return gl.WAIT_FAILED;
  return null;
}

/** The methods and the read-only values `gl` answers to, its own and its prototypes', short of
 *  Object's. Read before the context is lost, because a destroyed native context throws even
 *  when one of its values is read. */
function members(gl: any): {methods: string[], values: Map<string, any>} {
  const methods = new Set<string>();
  const values = new Map<string, any>();
  for (let o = gl; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const name of Object.getOwnPropertyNames(o)) {
      if (name === 'constructor' || methods.has(name) || values.has(name)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(o, name)!;
      if (typeof descriptor.value === 'function') {
        methods.add(name);
      } else if (descriptor.get && !descriptor.set) {
        // Such as drawingBufferWidth: a browser's lost context keeps answering with it.
        try {
          values.set(name, gl[name]);
        } catch (e) {
          // A value the context cannot report is left as it is.
        }
      }
    }
  }
  return {methods: Array.from(methods), values};
}

/** Make `gl` stay safe to call after WEBGL_lose_context.loseContext(). Returns `gl`. */
export function useContextLoss<T>(gl: T): T {
  const context = gl as any;
  let lost = false;

  function lose(nativeLose: Function) {
    if (lost) return;  // a browser ignores losing a context that is already lost
    const {methods, values} = members(context);
    nativeLose();
    lost = true;
    values.forEach((value, name) => {
      Object.defineProperty(context, name, {value, configurable: true, enumerable: true});
    });
    let reported = false;
    for (const name of methods) {
      const answer = lostAnswer(context, name);
      Object.defineProperty(context, name, {
        value: name === 'getError' ? () => {
          // CONTEXT_LOST_WEBGL is reported once, then no error.
          if (reported) return context.NO_ERROR;
          reported = true;
          return context.CONTEXT_LOST_WEBGL;
        } : () => answer,
        configurable: true,
        writable: true,
        enumerable: false,
      });
    }
  }

  replace(context, 'getExtension', (original) => function(extensionName: string) {
    const extension = original(extensionName);
    if (extension && typeof extension.loseContext === 'function' &&
        !Object.prototype.hasOwnProperty.call(extension, 'loseContext')) {
      replace(extension, 'loseContext', (nativeLose) => () => lose(nativeLose));
      // The native context cannot be brought back once it is destroyed, so restoring does
      // nothing and the context stays lost.
      replace(extension, 'restoreContext', () => (): void => undefined);
    }
    return extension;
  });

  return gl;
}
