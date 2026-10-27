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

#include <node_api.h>

#include <vector>

#include "egl_context_wrapper.h"
#include "utils.h"
#include "webgl_extensions.h"
#include "webgl_rendering_context.h"

namespace nodejsgl {

static napi_value CreateWebGLRenderingContext(napi_env env,
                                              napi_callback_info info) {
  napi_value instance;
  napi_status nstatus =
      WebGLRenderingContext::NewInstance(env, &instance, info);
  ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);

  return instance;
}

// For tests only: runs the drawing buffer's config choice (ChooseConfigIndex)
// on a list of configs given as arrays of eight numbers, [red, green, blue,
// alpha, depth, stencil, samples, renderable type], so a test can check the
// choice against a device it is not running on.
static napi_value ChooseConfigIndexForTest(napi_env env,
                                           napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  napi_status nstatus =
      napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);
  ENSURE_ARGC_RETVAL(env, argc, 3, nullptr);

  uint32_t length = 0;
  nstatus = napi_get_array_length(env, args[0], &length);
  ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);
  std::vector<ConfigTraits> configs(length);
  for (uint32_t i = 0; i < length; ++i) {
    napi_value row;
    nstatus = napi_get_element(env, args[0], i, &row);
    ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);
    EGLint* fields[] = {&configs[i].red_size,     &configs[i].green_size,
                        &configs[i].blue_size,    &configs[i].alpha_size,
                        &configs[i].depth_size,   &configs[i].stencil_size,
                        &configs[i].samples,      &configs[i].renderable_type};
    for (uint32_t f = 0; f < ARRAY_SIZE(fields); ++f) {
      napi_value field;
      nstatus = napi_get_element(env, row, f, &field);
      ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);
      int32_t value = 0;
      nstatus = napi_get_value_int32(env, field, &value);
      ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);
      *fields[f] = value;
    }
  }
  bool antialias = false;
  bool es3 = false;
  nstatus = napi_get_value_bool(env, args[1], &antialias);
  ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);
  nstatus = napi_get_value_bool(env, args[2], &es3);
  ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);

  napi_value result;
  nstatus = napi_create_uint32(
      env, static_cast<uint32_t>(ChooseConfigIndex(configs, antialias, es3)),
      &result);
  ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);
  return result;
}

static napi_value InitBinding(napi_env env, napi_value exports) {
  ANGLEInstancedArraysExtension::Register(env, exports);
  EXTBlendMinmaxExtension::Register(env, exports);
  EXTColorBufferFloatExtension::Register(env, exports);
  WebGLColorBufferFloatExtension::Register(env, exports);
  EXTColorBufferHalfFloatExtension::Register(env, exports);
  EXTFragDepthExtension::Register(env, exports);
  EXTFloatBlendExtension::Register(env, exports);
  EXTShaderTextureLodExtension::Register(env, exports);
  EXTSRGBExtension::Register(env, exports);
  EXTTextureFilterAnisotropicExtension::Register(env, exports);
  EXTTextureMirrorClampToEdgeExtension::Register(env, exports);
  OESElementIndexUintExtension::Register(env, exports);
  OESStandardDerivativesExtension::Register(env, exports);
  OESTextureFloatExtension::Register(env, exports);
  OESTextureFloatLinearExtension::Register(env, exports);
  OESTextureHalfFloatExtension::Register(env, exports);
  OESTextureHalfFloatLinearExtension::Register(env, exports);
  WebGLDebugRendererInfoExtension::Register(env, exports);
  WebGLDepthTextureExtension::Register(env, exports);
  WebGLCompressedTextureS3TCExtension::Register(env, exports);
  WebGLCompressedTextureS3TCSRGBExtension::Register(env, exports);
  WebGLLoseContextExtension::Register(env, exports);
  WebGLRenderingContext::Register(env, exports);

  napi_property_descriptor properties[] = {
      NAPI_DEFINE_METHOD("createWebGLRenderingContext",
                         CreateWebGLRenderingContext),
      NAPI_DEFINE_METHOD("_chooseConfigIndexForTest", ChooseConfigIndexForTest),
  };

  napi_status nstatus =
      napi_define_properties(env, exports, ARRAY_SIZE(properties), properties);
  ENSURE_NAPI_OK_RETVAL(env, nstatus, nullptr);

  return exports;
}

NAPI_MODULE(nodejs_gl_binding, InitBinding)

}  // namespace nodejsgl
