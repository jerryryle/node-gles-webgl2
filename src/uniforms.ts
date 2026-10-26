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

// The WebGL 2 forms of the uniform array setters that read part of an array.
//
// In plain terms: WebGL 2 lets a program set a uniform from a slice of a larger array, by naming
// where the slice starts (`srcOffset`) and how many values it holds (`srcLength`). The native
// binding ignores both and reads from the start of the array, so the shader receives the wrong
// values with no error.
//
// This module cuts the slice out before the native call.

import {raiseError, replace} from './wrap';

// tslint:disable:no-any

const VECTOR_SETTERS = [
  'uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv',
  'uniform1iv', 'uniform2iv', 'uniform3iv', 'uniform4iv',
  'uniform1uiv', 'uniform2uiv', 'uniform3uiv', 'uniform4uiv',
];
const MATRIX_SETTERS = [
  'uniformMatrix2fv', 'uniformMatrix3fv', 'uniformMatrix4fv',
  'uniformMatrix2x3fv', 'uniformMatrix3x2fv', 'uniformMatrix2x4fv',
  'uniformMatrix4x2fv', 'uniformMatrix3x4fv', 'uniformMatrix4x3fv',
];

/** The values of `data` from `srcOffset`, `srcLength` of them, or to the end when `srcLength`
 *  is 0 or missing. Null when the slice runs past the end, which WebGL reports as
 *  INVALID_VALUE. `data` is a typed array or a plain array. */
function slice(data: any, srcOffset: any, srcLength: any): any {
  const start = Number(srcOffset) || 0;
  const count = Number(srcLength) || 0;
  if (start > data.length || start + count > data.length) return null;
  const end = count ? start + count : data.length;
  return ArrayBuffer.isView(data) ? (data as any).subarray(start, end) : data.slice(start, end);
}

/** Make `gl`'s uniform array setters honour `srcOffset` and `srcLength`. Returns `gl`. */
export function useUniformOffsets<T>(gl: T): T {
  const context = gl as any;
  for (const name of VECTOR_SETTERS) {
    replace(context, name, (original) => function(
        location: any, data: any, srcOffset?: number, srcLength?: number) {
      if (arguments.length <= 2 || data == null) return original(location, data);
      const part = slice(data, srcOffset, srcLength);
      if (part === null) return raiseError(context, context.INVALID_VALUE);
      return original(location, part);
    });
  }
  for (const name of MATRIX_SETTERS) {
    replace(context, name, (original) => function(
        location: any, transpose: boolean, data: any, srcOffset?: number, srcLength?: number) {
      if (arguments.length <= 3 || data == null) return original(location, transpose, data);
      const part = slice(data, srcOffset, srcLength);
      if (part === null) return raiseError(context, context.INVALID_VALUE);
      return original(location, transpose, part);
    });
  }
  return gl;
}
