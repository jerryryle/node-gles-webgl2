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

// Helpers the JavaScript layer uses to adjust the native context's behaviour to match a
// browser's, one method at a time.

// tslint:disable:no-any

/** Replace `name` on `target` with `make(original)`. The native context's methods cannot be
 *  assigned, so each replacement is defined as the object's own property. */
export function replace(
    target: any, name: string, make: (original: Function) => Function): void {
  const original = target[name];
  if (typeof original !== 'function') return;  // a method this context does not have
  Object.defineProperty(target, name, {
    value: make(original.bind(target)),
    configurable: true,
    writable: true,
    enumerable: false,
  });
}

// The errors the JavaScript layer has raised itself, per context, waiting for getError.
const raised = new WeakMap<object, number[]>();

/** Record a WebGL error, such as INVALID_VALUE, for a call the JavaScript layer refused before
 *  it reached the native context. getError reports these first, oldest first, as it would
 *  report the native context's own. */
export function raiseError(gl: any, error: number): void {
  let pending = raised.get(gl);
  if (!pending) {
    pending = [];
    raised.set(gl, pending);
    replace(gl, 'getError', (original) => function() {
      return pending!.length ? pending!.shift() : original();
    });
  }
  // OpenGL records one error of each kind until it is read, and so does this.
  if (pending.indexOf(error) < 0) pending.push(error);
}
