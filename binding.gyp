##
# @license
# Copyright 2018 Google Inc. All Rights Reserved.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# =============================================================================

# Node.js TensorFlow Binding config:
{
  'variables' : {
    'angle_lib_dir': '<!(node scripts/resolve-angle-path.js)'
  },
  'targets' : [{
    'target_name' : 'nodejs_gl_binding',
    'sources' : [
      'binding/binding.cc',
      'binding/egl_context_wrapper.cc',
      'binding/webgl_extensions.cc',
      'binding/webgl_rendering_context.cc',
      'binding/webgl_sync.cc'
    ],
    'include_dirs' : [
      '..',
      '<(module_root_dir)/deps',
      '<(module_root_dir)/deps/angle/include'
    ],
    'conditions' : [
      [
        'OS=="linux"', {
          # The compiled add-on needs ANGLE, the graphics library, to run. We
          # copy ANGLE's files into the same folder as the add-on and tell the
          # add-on to look in its own folder for them ($ORIGIN). That way the
          # add-on keeps working when the whole package is moved somewhere
          # else, as happens when it's installed on the Pi.
          #
          # We also copy SwiftShader, a backup renderer that draws using the
          # main processor when there's no graphics chip to use. ANGLE only
          # finds it if it sits next to ANGLE's own files.
          'copies' : [{
            'destination' : '<(PRODUCT_DIR)',
            'files' : [
              '<(angle_lib_dir)/libEGL.so',
              '<(angle_lib_dir)/libGLESv2.so',
              '<(angle_lib_dir)/libvk_swiftshader.so',
              '<(angle_lib_dir)/vk_swiftshader_icd.json',
            ],
          }],
          'ldflags' : [
            "-Wl,-rpath,'$$ORIGIN'",
          ],
          'libraries' : [
            '-lGLESv2',
            '-lEGL',
          ],
          'library_dirs' : [
            '<(angle_lib_dir)'
          ],
        }
      ],
      [
        'OS=="mac"', {
          'libraries' : [
            '-Wl,-rpath,<@(angle_lib_dir)',
            '-lGLESv2',
            '-lEGL',
          ],
          'library_dirs' : [
            '<(angle_lib_dir)'
          ],
        }
      ],
      [
        'OS=="win"', {
          'defines': ['COMPILER_MSVC', 'NOMINMAX'],
          'libraries': ['libGLESv2', 'libEGL'],
          'library_dirs' : [
            '<(angle_lib_dir)'
          ],
        },
      ]
    ]
  }]
}
