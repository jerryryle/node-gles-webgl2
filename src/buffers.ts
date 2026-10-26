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

// The WebGL 2 forms of bufferData and bufferSubData that upload part of an array.
//
// In plain terms: WebGL 2 lets a program upload just a slice of a typed array, by naming where
// the slice starts (`srcOffset`) and how many elements it holds (`length`), counted in the
// array's own elements. The native binding reads only the first three arguments and uploads
// the whole array, so the wrong bytes reach the GPU without any error. three.js uploads the
// changed part of a geometry this way, so a later change to a mesh's shape never showed up.
//
// This module turns the slice into a view of just those elements before the native call. The
// native code already uploads a view from wherever it starts.

import {raiseError, replace} from './wrap';

// tslint:disable:no-any

/** The elements of `data` from `srcOffset`, `length` of them, or to the end when `length` is 0
 *  or missing. Null when the slice runs past the array's end, which WebGL reports as
 *  INVALID_VALUE. */
function slice(data: any, srcOffset: any, length: any): any {
  const start = Number(srcOffset) || 0;
  const count = Number(length) || 0;
  if (start > data.length || start + count > data.length) return null;
  return data.subarray(start, count ? start + count : data.length);
}

/** A typed array, the only kind of source these forms accept an offset into. */
function isTypedArray(value: any): boolean {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

/** Make `gl` honour bufferData's and bufferSubData's `srcOffset` and `length`. Returns `gl`. */
export function useBufferOffsets<T>(gl: T): T {
  const context = gl as any;

  replace(context, 'bufferData', (original) => function(
      target: number, data: any, usage: number, srcOffset?: number, length?: number) {
    if (arguments.length <= 3 || !isTypedArray(data)) return original(target, data, usage);
    const part = slice(data, srcOffset, length);
    if (part === null) return raiseError(context, context.INVALID_VALUE);
    return original(target, part, usage);
  });

  replace(context, 'bufferSubData', (original) => function(
      target: number, dstByteOffset: number, data: any, srcOffset?: number, length?: number) {
    if (arguments.length <= 3 || !isTypedArray(data)) return original(target, dstByteOffset, data);
    const part = slice(data, srcOffset, length);
    if (part === null) return raiseError(context, context.INVALID_VALUE);
    return original(target, dstByteOffset, part);
  });

  return gl;
}
