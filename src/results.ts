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

// The kinds of array a browser's queries return.
//
// In plain terms: when a browser's WebGL answers a question with several numbers, it answers
// with a typed array of the right kind: whole numbers in an Int32Array, fractions in a
// Float32Array. The native binding answers with a plain JavaScript array instead. Code that
// relies on typed-array behaviour, or checks the kind, then goes wrong.
//
// The native binding also reads back a vertex attribute set with whole numbers
// (vertexAttribI4i, vertexAttribI4ui) as if it held fractions, so 1, 2, 3, 4 came back as tiny
// fractions such as 1.4e-45, and -2 came back as NaN. This module reads such an attribute back
// through the native layer's own whole-number readers instead.

import {replace} from './wrap';

// tslint:disable:no-any

type ArrayKind = Int32ArrayConstructor|Uint32ArrayConstructor|Float32ArrayConstructor;

// The getParameter queries a browser answers with a typed array, by the name of their constant.
// COLOR_WRITEMASK stays a plain array of booleans, as it is in a browser.
const PARAMETER_KINDS: Array<[string, ArrayKind]> = [
  ['VIEWPORT', Int32Array],
  ['SCISSOR_BOX', Int32Array],
  ['MAX_VIEWPORT_DIMS', Int32Array],
  ['COLOR_CLEAR_VALUE', Float32Array],
  ['BLEND_COLOR', Float32Array],
  ['DEPTH_RANGE', Float32Array],
  ['ALIASED_POINT_SIZE_RANGE', Float32Array],
  ['ALIASED_LINE_WIDTH_RANGE', Float32Array],
  ['COMPRESSED_TEXTURE_FORMATS', Uint32Array],
];

// The kind of array getUniform returns for each uniform type that holds several numbers, by the
// name of the type's constant. A boolean vector stays a plain array of booleans, as in a
// browser, and a single number stays a number.
const UNIFORM_KINDS: Array<[string, ArrayKind]> = [
  ['FLOAT_VEC2', Float32Array], ['FLOAT_VEC3', Float32Array], ['FLOAT_VEC4', Float32Array],
  ['FLOAT_MAT2', Float32Array], ['FLOAT_MAT3', Float32Array], ['FLOAT_MAT4', Float32Array],
  ['FLOAT_MAT2x3', Float32Array], ['FLOAT_MAT2x4', Float32Array],
  ['FLOAT_MAT3x2', Float32Array], ['FLOAT_MAT3x4', Float32Array],
  ['FLOAT_MAT4x2', Float32Array], ['FLOAT_MAT4x3', Float32Array],
  ['INT_VEC2', Int32Array], ['INT_VEC3', Int32Array], ['INT_VEC4', Int32Array],
  ['UNSIGNED_INT_VEC2', Uint32Array], ['UNSIGNED_INT_VEC3', Uint32Array],
  ['UNSIGNED_INT_VEC4', Uint32Array],
];

/** A map from each named constant's value to its array kind, for the constants `gl` has. */
function byConstant(gl: any, table: Array<[string, ArrayKind]>): Map<number, ArrayKind> {
  const map = new Map<number, ArrayKind>();
  for (const [name, kind] of table) {
    if (typeof gl[name] === 'number') map.set(gl[name], kind);
  }
  return map;
}

/** `value` as an array of `kind`, when it is a plain array; anything else comes back as is. */
function as(kind: ArrayKind|undefined, value: any): any {
  return kind && Array.isArray(value) ? new kind(value) : value;
}

/** Make `gl`'s queries answer with the typed arrays a browser's do. Returns `gl`. */
export function useTypedResults<T>(gl: T): T {
  const context = gl as any;

  const parameterKinds = byConstant(context, PARAMETER_KINDS);
  replace(context, 'getParameter', (original) => function(pname: number) {
    return as(parameterKinds.get(pname), original(pname));
  });

  replace(
      context, 'getInternalformatParameter',
      (original) => function(target: number, internalformat: number, pname: number) {
        const value = original(target, internalformat, pname);
        return pname === context.SAMPLES ? as(Int32Array, value) : value;
      });

  // getUniform needs the uniform's type to pick the kind of array, and the native layer reports
  // only numbers. Each location is remembered with its program and name when it is handed out,
  // and each program's uniform types are read once per link.
  const locations = new WeakMap<object, {program: any, name: string}>();
  const types = new WeakMap<object, Map<string, number>>();
  const uniformKinds = byConstant(context, UNIFORM_KINDS);

  replace(context, 'getUniformLocation', (original) => function(program: any, name: string) {
    const location = original(program, name);
    if (location && typeof location === 'object') locations.set(location, {program, name});
    return location;
  });
  replace(context, 'linkProgram', (original) => function(program: any) {
    if (program && typeof program === 'object') types.delete(program);
    return original(program);
  });

  function uniformType(program: any, name: string): number|undefined {
    if (!program || typeof program !== 'object') return undefined;
    let byName = types.get(program);
    if (!byName) {
      byName = new Map();
      const count = context.getProgramParameter(program, context.ACTIVE_UNIFORMS) || 0;
      for (let i = 0; i < count; i++) {
        const info = context.getActiveUniform(program, i);
        if (info) byName.set(info.name, info.type);
      }
      types.set(program, byName);
    }
    // An array's elements are listed under its first element: `a[0]` for `a`, `a[2]` and `a[0]`.
    return byName.get(name) || byName.get(`${name}[0]`) ||
        byName.get(name.replace(/\[\d+\]$/, '[0]'));
  }

  replace(context, 'getUniform', (original) => function(program: any, location: any) {
    const value = original(program, location);
    if (!Array.isArray(value)) return value;
    const known = location && typeof location === 'object' ? locations.get(location) : undefined;
    const type = known ? uniformType(known.program, known.name) : undefined;
    return as(type === undefined ? undefined : uniformKinds.get(type), value);
  });

  // Which vertex attributes were last given whole numbers through a vertexAttribI4* setter, and
  // of which kind. A vertex attribute's current value changes only through these setters, and
  // any other setter gives it fractions, which the native getVertexAttrib reads correctly. The
  // native getVertexAttribIiv and getVertexAttribIuiv read whole numbers correctly.
  const wholeNumbers = new Map<number, string>();
  for (const [name, reader] of [['vertexAttribI4i', 'getVertexAttribIiv'],
                                ['vertexAttribI4iv', 'getVertexAttribIiv'],
                                ['vertexAttribI4ui', 'getVertexAttribIuiv'],
                                ['vertexAttribI4uiv', 'getVertexAttribIuiv']]) {
    replace(context, name, (original) => function(index: number) {
      wholeNumbers.set(index, reader);
      return original.apply(null, arguments);
    });
  }
  for (const name of ['vertexAttrib1f', 'vertexAttrib2f', 'vertexAttrib3f', 'vertexAttrib4f',
                      'vertexAttrib1fv', 'vertexAttrib2fv', 'vertexAttrib3fv', 'vertexAttrib4fv']) {
    replace(context, name, (original) => function(index: number) {
      wholeNumbers.delete(index);
      return original.apply(null, arguments);
    });
  }

  replace(context, 'getVertexAttrib', (original) => function(index: number, pname: number) {
    const reader = wholeNumbers.get(index);
    if (pname === context.CURRENT_VERTEX_ATTRIB && reader && typeof context[reader] === 'function') {
      const values = context[reader](index, pname);
      return reader === 'getVertexAttribIiv' ? new Int32Array(values) : new Uint32Array(values);
    }
    const value = original(index, pname);
    return pname === context.CURRENT_VERTEX_ATTRIB ? as(Float32Array, value) : value;
  });

  return gl;
}
