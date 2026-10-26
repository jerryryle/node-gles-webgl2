/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
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

// tslint:disable-next-line:no-require-imports
import bindings = require('bindings');
import {NodeJsGlBinding} from './binding';
import {useBufferOffsets} from './buffers';
import {useWebGLObjects} from './objects';

const binding = bindings('nodejs_gl_binding') as NodeJsGlBinding;

type WebGLExtensionName = string;

interface ContextArguments {
    width?: number,
    height?: number,
    webGLCompatibility?: boolean,
    webGLCompability?: boolean,
    majorVersion?: number,
    minorVersion?: number,
    enabledExtensions?: WebGLExtensionName[],
    disabledExtensions?: WebGLExtensionName[],
};

const createWebGLRenderingContext = function(args: ContextArguments = {}) {
    const width =  args.width || 1;
    const height = args.height || 1;
    const webGLCompatibility = args.webGLCompatibility === undefined ?
        args.webGLCompability || false : args.webGLCompatibility;
    const majorVersion =  args.majorVersion || 3;
    const minorVersion =  args.minorVersion || 0;
    const enabledExtensions = args.enabledExtensions;
    const disabledExtensions = args.disabledExtensions;
    // The native context differs from a browser's in a few ways. Each wrapper below makes one
    // of them behave as a browser's does, and its module's opening comment says which.
    const gl = binding.createWebGLRenderingContext(
        width,
        height,
        majorVersion,
        minorVersion,
        webGLCompatibility,
        enabledExtensions,
        disabledExtensions,
    );
    useWebGLObjects(gl);
    useBufferOffsets(gl);
    return gl;


} 


export { createWebGLRenderingContext };
export {
    WebGLBuffer, WebGLFramebuffer, WebGLObjectHandle, WebGLProgram, WebGLQuery,
    WebGLRenderbuffer, WebGLSampler, WebGLShader, WebGLTexture, WebGLTransformFeedback,
    WebGLVertexArrayObject,
} from './objects';
