/* eslint-disable no-console */
import { gl } from './gl.js';
import { isMobile } from './utils.js';

let programUsing = null;

if (!String.prototype.replaceAll) {
  // eslint-disable-next-line no-extend-native
  String.prototype.replaceAll = function replaceAll(search, replace) {
    return this.split(search).join(replace);
  };
}

function removeShaderText(text) {
  return text.replace(' void ', '\nvoid ')
    .replace(' { ', '\n{\n')
    .replaceAll('; ', ';\n')
    .replaceAll('\r', '');
}

const shadersMap = {
  error: {
    vs: `#pragma DEFINES
attribute vec3 position;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
#pragma UNIFORMS
void main(void)
{
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`,
    fs: `void main(void)
{
  gl_FragColor = vec4(0.5, 0.0, 0.7, 1.0);
}`,
  },
  debug: {
    vs: `#pragma DEFINES
attribute vec3 position;

uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;

uniform vec4 color;
#pragma UNIFORMS
varying lowp vec4 vColor;

void main(void)
{
  vec3 finalPos = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);
  vColor = color;
}`,
    fs: `varying lowp vec4 vColor;
void main(void)
{
  gl_FragColor = vColor;
}`,
  },
  default: {
    vs: `#pragma DEFINES
attribute vec3 position;
attribute vec3 color;
attribute vec3 normal;
attribute vec2 texcoord;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;

#pragma UNIFORMS

varying highp vec2 vTexcoord;

varying highp vec3 N;
varying highp vec3 v;
void main(void)
{
  vec3 finalPos = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);
  vTexcoord = texcoord;
  v = (viewMatrix * modelMatrix * vec4(finalPos, 1.0)).xyz;
  N = normalize(normal);
}`,
    fs: `precision mediump float;
#pragma DEFINES
#pragma UNIFORMS

uniform sampler2D uAlbedo;

#ifdef LIGHT_COUNT
uniform vec3 lightDirections[LIGHT_COUNT];
uniform vec3 lightColors[LIGHT_COUNT];
#endif

varying highp vec2 vTexcoord;
varying highp vec3 N;
varying highp vec3 v;
void main(void)
{
  highp vec4 col = texture2D(uAlbedo, vTexcoord);
  highp vec4 Idiff = vec4(0.0, 0.0, 0.0, 1.0);
  highp vec4 Ispec = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef LIGHT_COUNT
  for(int i = 0; i < LIGHT_COUNT; i++) {
    vec3 L = normalize(lightDirections[i] - v);
    vec3 E = normalize(-v);
    vec3 R = normalize(-reflect(L, N));
    Idiff.rgb += lightColors[i] * max(dot(N,L), 0.0);
    Ispec.rgb += lightColors[i] * pow(max(dot(R, E), 0.0), 30.0);
  }
#else
  highp vec3 L = normalize(vec3(0.0, 0.0, -1.0) - v);
  highp vec3 E = normalize(-v);
  highp vec3 R = normalize(-reflect(L, N));
  Idiff = vec4(vec3(0.8, 0.8, 0.78).rgb, 1.0) * max(dot(N,L), 0.0);
  Ispec = vec4(0.8, 0.8, 0.78, 1.0) * pow(max(dot(R, E), 0.0), 30.0);
#endif
  highp vec4 Iamb = vec4(0.3, 0.3, 0.3, 1.0);

  Idiff = clamp(Idiff, 0.0, 1.0);
  Ispec = clamp(Ispec, 0.0, 1.0);
  gl_FragColor = col * (Iamb + Idiff + Ispec);
}`,
  },
  default_orig: {
    vs: `#pragma DEFINES
attribute vec3 position;
attribute vec3 color;
attribute vec3 normal;
attribute vec2 texcoord;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

#pragma UNIFORMS

varying highp vec2 vTexcoord;

varying highp vec3 vLighting;
void main(void)
{
  vec3 finalPos = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);
  vTexcoord = texcoord;
  highp vec3 ambientLight = vec3(0.3, 0.3, 0.3);
  highp vec3 directionalLightColor = vec3(0.8, 0.8, 0.78);
  highp vec3 directionalVector = normalize(vec3(0.0, 0.0, 1.0));

  highp vec3 transformedNormal = normalize(normalMatrix * normal);

  highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
  vLighting = ambientLight + (directionalLightColor * directional);
}`,
    fs: `#pragma DEFINES

uniform sampler2D uAlbedo;

#pragma UNIFORMS

varying highp vec2 vTexcoord;
varying highp vec3 vLighting;
void main(void)
{
  highp vec4 col = texture2D(uAlbedo, vTexcoord);
  gl_FragColor = vec4(col.rgb * vLighting, col.a);
}`,
  },
  sprite: {
    vs: `#pragma DEFINES
attribute vec2 position;
attribute vec2 texcoord;
uniform mat4 modelMatrix;
uniform vec2 halfView;
uniform vec4 widgetRect;
uniform vec4 color;
#pragma UNIFORMS
varying highp vec2 vTexcoord;
varying lowp vec4 vColor;
void main(void)
{
  vec2 pos = vec2(widgetRect.x, widgetRect.y);
  vec2 size = vec2(widgetRect.z, widgetRect.w);
  vec2 vertPos_homogeneous_space = ((position * size + size * 0.5) - halfView + pos) / halfView;
  gl_Position = modelMatrix * vec4(vertPos_homogeneous_space, 0, 1.0);
  vTexcoord = texcoord;
  vColor = color;
}`,
    fs: `#pragma DEFINES
precision highp float;
uniform sampler2D uAlbedo;
#pragma UNIFORMS
varying highp vec2 vTexcoord;
varying lowp vec4 vColor;
void main(void)
{
  gl_FragColor = texture2D(uAlbedo, vTexcoord) * vColor;
}`,
  },
  sprite_circle: {
    vs: `precision highp float;
#pragma DEFINES
attribute vec2 position;
attribute vec2 texcoord;
uniform mat4 modelMatrix;
uniform vec2 halfView;
uniform vec4 widgetRect;
uniform float radius;
uniform vec4 color;
#pragma UNIFORMS
varying highp vec2 vTexcoord;
varying lowp vec4 vColor;
varying highp vec2 radius_data;
void main(void)
{
  vec2 pos = vec2(widgetRect.x, widgetRect.y);
  vec2 size = vec2(widgetRect.z, widgetRect.w);
  vec2 vertPos_homogeneous_space = ((position * size + size * 0.5) - halfView + pos) / halfView;
  gl_Position = modelMatrix * vec4(vertPos_homogeneous_space, 0, 1.0);
  vTexcoord = texcoord;
  vColor = color;
}`,
    fs: `precision highp float;
uniform sampler2D uAlbedo;
varying highp vec2 vTexcoord;
varying lowp vec4 vColor;
varying highp vec2 radius_data;
void main(void)
{
  vec2 dir = vTexcoord * 2.0 - 1.0;

  if ((dir.x * dir.x + dir.y * dir.y) > 1.0) discard;
  gl_FragColor = texture2D(uAlbedo, vTexcoord) * vColor;

}`,
  },
  pointcloud: {
    vs: `#pragma DEFINES
attribute vec3 position;
attribute vec3 color;

uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
#pragma UNIFORMS
varying highp vec3 vColor;

void main(void)
{
  vec3 finalPos = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);
  vColor = color;
  gl_PointSize = 3.0;
}`,
    fs: `varying highp vec3 vColor;

void main(void)
{
  gl_FragColor = vec4(vColor, 1.0);
}`,
  },
  hair: {
    vs: `#pragma DEFINES
attribute vec3 position;
attribute vec3 tangent;

uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

#pragma UNIFORMS

varying highp vec4 worldPosition;
varying highp vec3 worldTangent;

void main(void)
{
  vec3 finalPos = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);
  worldPosition = modelMatrix * vec4(finalPos, 1.0);
  worldTangent = (modelMatrix * vec4(tangent, 0.0)).xyz;
}`,
    fs: `
precision highp float;
#pragma DEFINES

#define M_PI 3.14159265358979323846
#define M_E  2.71828182845904523536

varying highp vec4 worldPosition;
varying highp vec3 worldTangent;
#pragma UNIFORMS

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 uCameraPosition;
uniform vec2 cameraResolution;

uniform vec4 color;

#ifdef LIGHT_COUNT
uniform vec3 lightDirections[LIGHT_COUNT];
uniform vec3 lightColors[LIGHT_COUNT];
uniform mat4 lightMatrices[LIGHT_COUNT];
#if LIGHT_COUNT > 0
uniform sampler2D shadowmap0;
#if LIGHT_COUNT > 1
uniform sampler2D shadowmap1;
#if LIGHT_COUNT > 2
uniform sampler2D shadowmap2;
#if LIGHT_COUNT > 3
uniform sampler2D shadowmap3;
#endif
#endif
#endif
#endif
#endif

vec3 kajiya_kay(vec3 diffuse, vec3 specular, float p, vec3 tangent, vec3 light, vec3 eye) {
  float cosTL = dot(tangent, light);
  float cosTE = dot(tangent, eye);

  float cosTL_squared = cosTL * cosTL;
  float cosTE_squared = cosTE * cosTE;

  float one_minus_cosTL_squared = 1.0 - cosTL_squared;
  float one_minus_cosTE_squared = 1.0 - cosTE_squared;

  float sinTL = sqrt(one_minus_cosTL_squared);
  float sinTE = sqrt(one_minus_cosTE_squared);

  vec3 diffuse_colors = diffuse * sinTL;
  float spec = cosTL * cosTE + sinTL * sinTE;
  vec3 specular_colors = specular * pow(max(spec, 0.0), p);
  return diffuse_colors + specular_colors;
}

float approximate_deep_shadow(float shadow_depth, float light_depth, float strand_radius, float strand_alpha) {
    float strand_depth = max(0.0, light_depth - shadow_depth); // depth of the current strand inside geometry.
    float strand_count = strand_depth * strand_radius; // expected number of hair strands occluding the strand.

    if (strand_depth > 1e-10) strand_count += 1.0; // assume we have passed some strand if the depth is above some
    // floating point error threshold (e.g from the given shadow map) and add it to the occluding strand count.

    // We also take into account the transparency of the hair strand to determine how much light might scatter.
    return pow(1.0 - strand_alpha, strand_count); // this gives us "stronger" shadows with deeper hair strand.
}

vec4 tex2Dproj(sampler2D image, vec2 projected_position, vec2 displacement) {
    return texture2D(image, projected_position.st + displacement);
}

float approximate_deep_shadows(sampler2D shadow_map, vec4 light_space_strand, float kernel_width, float smoothing, float strand_radius, float strand_opacity) {
  float visibility = 0.0;
  vec2 shadow_map_size = vec2(1536.0, 1536.0);

  // float kernel_range = (kernel_width - 1.0) / 2.0;
  float sigma_stddev = (kernel_width / 2.0) / 2.4;
  float sigma_squared = sigma_stddev * sigma_stddev;

  float light_depth = (light_space_strand.z / light_space_strand.w) * 0.5 + 0.5;
  vec2 shadow_map_stride = shadow_map_size / smoothing; // stride.

  vec2 projected_position = (light_space_strand.xy / light_space_strand.w) * 0.5 + 0.5;

  float total_weight = 0.0;
  //             -kernel_range <= +kernel_range
  for (float y = -1.0; y <= 1.0; y += 1.0) {
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        float exponent = -1.0 * (x * x + y * y) / 2.0 * sigma_squared; // Gaussian RBDF.
        float local_weight = 1.0 / (2.0 * M_PI * sigma_squared) * pow(M_E, exponent);

        float shadow_depth = tex2Dproj(shadow_map, projected_position, vec2(x, y) / shadow_map_stride).r;
        float shadow = approximate_deep_shadow(shadow_depth, light_depth, strand_radius, strand_opacity);

        visibility += shadow * local_weight;
        total_weight += local_weight;
    }
  }
  return visibility / total_weight;
}

void main(void)
{
  float hair_alpha = 0.3;
  // === gpaa ===
  vec2 screen_fragment = gl_FragCoord.xy;
  vec4 world_line = worldPosition;
  mat4 view_projection = projectionMatrix * viewMatrix;
  vec2 resolution = cameraResolution;
  float line_thickness = 2.0;

  vec4 clip_line = view_projection * world_line;
  vec3 ndc_line = (clip_line.xyz / clip_line.w);
  vec2 screen_line = ndc_line.xy;
  screen_line = (screen_line + 1.0) * (resolution / 2.0);
  float d = length(screen_line - screen_fragment);
  float converage = 1.0 - (d / (line_thickness / 2.0));
  converage *= hair_alpha;

  if (converage < 0.001) discard;

  converage *= 1.0 / 0.042;

  // === occlusion & shadow ===
  // TODO : add occlusion and shadow
  float occlusion = 1.0;
#ifdef LIGHT_COUNT
  // since no array
  // for (int i = 0; i < LIGHT_COUNT; i++) {
  //     vec4 shadow_space_fragment = lightMatrices[i] * worldPosition;
  //     //float approximate_deep_shadows(sampler2D shadow_map, vec4 light_space_strand, float kernel_width, float smoothing, float strand_radius, float strand_opacity)
  //     occlusion *= approximate_deep_shadows(shadowmaps[i], shadow_space_fragment, 3.0, 4.0, 15000.0, hair_alpha);
  //   }
  #if LIGHT_COUNT > 0
  vec4 shadow_space_fragment = lightMatrices[0] * vec4(vWorldPos, 1.0);
  occlusion *= approximate_deep_shadows(shadowmap0, shadow_space_fragment, 3.0, 4.0, 15000.0, hair_alpha);
  #if LIGHT_COUNT > 1
  shadow_space_fragment = lightMatrices[1] * vec4(vWorldPos, 1.0);
  occlusion *= approximate_deep_shadows(shadowmap1, shadow_space_fragment, 3.0, 4.0, 15000.0, hair_alpha);
  #if LIGHT_COUNT > 2
  shadow_space_fragment = lightMatrices[2] * vec4(vWorldPos, 1.0);
  occlusion *= approximate_deep_shadows(shadowmap2, shadow_space_fragment, 3.0, 4.0, 15000.0, hair_alpha);
  #if LIGHT_COUNT > 3
  shadow_space_fragment = lightMatrices[3] * vec4(vWorldPos, 1.0);
  occlusion *= approximate_deep_shadows(shadowmap3, shadow_space_fragment, 3.0, 4.0, 15000.0, hair_alpha);
  #endif
  #endif
  #endif
  #endif
#endif
  lowp vec3 shading = vec3(1.0, 1.0, 1.0);
#ifdef LIGHT_COUNT
  shading = vec3(0.0, 0.0, 0.0);
  // === kajiya kay ===
  highp vec3 eye = normalize(worldPosition.xyz - uCameraPosition);
  for (int i = 0; i < LIGHT_COUNT; i++) {
    //                vec3 diffuse, vec3 specular, float p, vec3 tangent, vec3 light, vec3 eye
    shading += kajiya_kay(color.xyz, lightColors[i], 80.0, worldTangent, lightDirections[i], eye);
  }
#endif
  gl_FragColor = vec4(shading * occlusion, converage);
}`,
  },
  shadow: {
    vs: `precision highp float;
#pragma DEFINES
attribute vec3 position;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
#pragma UNIFORMS
varying highp vec2 zw;
void main(void)
{
  vec3 finalPos = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);
  zw = gl_Position.zw;
}`,
    fs: `precision highp float;
varying highp vec2 zw;
vec3 jH(float v){
    vec4 jI = vec4(1.0, 255.0, 65025.0, 16581375.0) * v;
    jI = fract(jI);
    jI.xyz -= jI.yzw * (1.0 / 255.0);
    return jI.xyz;
}
void main(void)
{
  // gl_FragColor.xyz = jH((zw.x / zw.y) * 0.5 + 0.5);
  gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
}`,
  },
};

const keys = Object.keys(shadersMap);
for (let i = keys.length - 1; i >= 0; i -= 1) {
  const k = keys[i];
  shadersMap[k].name = k;
  shadersMap[k].vs = removeShaderText(shadersMap[k].vs);
  shadersMap[k].fs = removeShaderText(shadersMap[k].fs);
}

function loadShader(type, name, s) {
  const source = s.replace('#pragma DEFINES', '').replace('#pragma UNIFORMS', '');
  const shader = gl.createShader(type);

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`An error occurred compiling the shader "${name}" :\n${gl.getShaderInfoLog(shader)}`);
    if (isMobile) {
      // eslint-disable-next-line no-alert
      alert(`shader(${name}) : ${source}`);
    } else {
      console.error(`shader(${name}) : ${source}`);
    }
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initShaderProgram(shaderSource) {
  const vertexShader = loadShader(gl.VERTEX_SHADER, shaderSource.name, shaderSource.vs);
  const fragmentShader = loadShader(gl.FRAGMENT_SHADER, shaderSource.name, shaderSource.fs);

  // Create the shader program
  const shaderProgram = gl.createProgram();
  if (vertexShader !== null && fragmentShader !== null) {
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
  }
  // If creating the shader program failed, alerts
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
    return null;
  }

  return shaderProgram;
}

export default class Shader {
  constructor(shaderSource) {
    this.shaderSource = shaderSource;

    this.program = initShaderProgram(shaderSource);

    this.attrib_cache = {};
    this.uniform_cache = {};
    this.value_cache = {};

    return this;
  }

  get getProgram() { return this.program; }

  attribLocation(name) {
    let location = this.attrib_cache[name];
    if (location === undefined) {
      location = gl.getAttribLocation(this.program, name);
      this.attrib_cache[name] = location;
    }
    if (location >= 0) {
      gl.enableVertexAttribArray(location);
    }
    return location;
  }

  bind() {
    if (this !== programUsing) {
      programUsing = this;
      gl.useProgram(this.program);
    }
    return this;
  }

  unbind() {
    if (programUsing === this) {
      programUsing = null;
      gl.useProgram(null);
    }
    return this;
  }

  getUniformLocation(name) {
    let location = this.uniform_cache[name];
    if (location === undefined) {
      location = gl.getUniformLocation(this.program, name);
      this.uniform_cache[name] = location;
    }
    if (location === undefined) console.error(`name : ${name} is not found in shader ${this.shaderSource.name}`);
    return location;
  }

  setInt(name, value, debug = false) {
    if (this.value_cache[name] !== value) {
      this.value_cache[name] = value;
      const uniLoc = this.getUniformLocation(name);
      if (uniLoc) gl.uniform1i(uniLoc, value);
      else console.log(`setInt failed for ${name}`);
    }
    if (debug) {
      console.log(`setInt for ${name} : ${value}`);
    }
    return this;
  }

  setIv(name, values) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniform1iv(uniLoc, values);
    return this;
  }

  setFloat(name, value) {
    if (this.value_cache[name] !== value) {
      this.value_cache[name] = value;
      const uniLoc = this.getUniformLocation(name);
      if (uniLoc) gl.uniform1f(uniLoc, value);
    }
    return this;
  }

  setFv(name, values) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniform1fv(uniLoc, values);
    return this;
  }

  setVal2(name, x, y) {
    const cached = this.value_cache[name];
    if (cached) {
      if (cached[0] !== x || cached[1] !== y) {
        cached[0] = x;
        cached[1] = y;
        this.value_cache[name] = cached;
      } else return this;
    } else {
      this.value_cache[name] = [x, y];
    }
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniform2f(uniLoc, x, y);
    // else console.log(`Cannot find uniLoc for name: ${name}`);
    return this;
  }

  setVal3(name, x, y, z) {
    const cached = this.value_cache[name];
    if (cached) {
      if (cached[0] !== x || cached[1] !== y || cached[2] !== z) {
        cached[0] = x;
        cached[1] = y;
        cached[2] = z;
        this.value_cache[name] = cached;
      } else return this;
    } else {
      this.value_cache[name] = [x, y, z];
    }
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniform3f(uniLoc, x, y, z);
    // else console.log(`Cannot find uniLoc for name: ${name}`);
    return this;
  }

  setVal4(name, x, y, z, w) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniform4f(uniLoc, x, y, z, w);
    // else console.log(`Cannot find uniLoc for name: ${name}`);
    return this;
  }

  setVec2(name, vec) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniform2fv(uniLoc, vec);
    return this;
  }

  setVec3(name, vec) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniform3fv(uniLoc, vec);
    // else console.log(`Cannot find uniLoc for name: ${name}`);
    return this;
  }

  setVec4(name, vec) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniform4fv(uniLoc, vec);
    return this;
  }

  setMatrix2(name, matrix) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniformMatrix2fv(uniLoc, false, matrix);
    return this;
  }

  setMatrix3(name, matrix) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniformMatrix3fv(uniLoc, false, matrix);
    return this;
  }

  setMatrix4(name, matrix) {
    const uniLoc = this.getUniformLocation(name);
    if (uniLoc) gl.uniformMatrix4fv(uniLoc, false, matrix);
    return this;
  }

  static FindShaderSource(name) {
    if (typeof name === 'string') {
      if (name in shadersMap) {
        return shadersMap[name];
      }
      // eslint-disable-next-line no-console
      console.error(`Cannot find shader ${name}`);
      return null;
    }
    return name;
  }

  static ShaderMap() {
    return shadersMap;
  }
}

export { Shader };
