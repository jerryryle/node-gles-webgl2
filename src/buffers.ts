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
//
// A browser also accepts raw binary data, an ArrayBuffer or a DataView, wherever these calls
// take an array, while the native binding throws "Invalid napi_status: UNKNOWN". This module
// hands the native code a byte array over the same memory instead, and turns a null source
// into the INVALID_VALUE error a browser reports.

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

/** Raw binary data as a byte array over the same memory: an ArrayBuffer or a DataView. Any other
 *  value comes back unchanged. */
function asBytes(data: any): any {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof DataView) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return data;
}

/** A typed array, the only kind of source these forms accept an offset into. */
function isTypedArray(value: any): boolean {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

/** Make `gl` honour bufferData's and bufferSubData's `srcOffset` and `length`, and accept the
 *  raw binary sources a browser accepts. Returns `gl`. */
export function useBufferOffsets<T>(gl: T): T {
  const context = gl as any;

  replace(context, 'bufferData', (original) => function(
      target: number, data: any, usage: number, srcOffset?: number, length?: number) {
    if (data === null) return raiseError(context, context.INVALID_VALUE);
    data = asBytes(data);
    if (arguments.length <= 3 || !isTypedArray(data)) return original(target, data, usage);
    const part = slice(data, srcOffset, length);
    if (part === null) return raiseError(context, context.INVALID_VALUE);
    return original(target, part, usage);
  });

  replace(context, 'bufferSubData', (original) => function(
      target: number, dstByteOffset: number, data: any, srcOffset?: number, length?: number) {
    if (data === null) return raiseError(context, context.INVALID_VALUE);
    data = asBytes(data);
    if (arguments.length <= 3 || !isTypedArray(data)) return original(target, dstByteOffset, data);
    const part = slice(data, srcOffset, length);
    if (part === null) return raiseError(context, context.INVALID_VALUE);
    return original(target, dstByteOffset, part);
  });

  // Reading back into a DataView reads into the same memory through a byte array. Its offset and
  // length then count bytes, which is what they count for a DataView.
  replace(context, 'getBufferSubData', (original) => function(
      target: number, srcByteOffset: number, destination: any) {
    const args = Array.prototype.slice.call(arguments);
    args[2] = destination instanceof DataView ? asBytes(destination) : destination;
    return original.apply(null, args);
  });

  return gl;
}
