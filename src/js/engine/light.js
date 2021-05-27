import { Camera } from './camera.js';
import { RenderTexture, RenderTextureType } from './rendertexture.js';
import { Material } from './material.js';
import { GameNode } from './gamenode.js';
import { Sprite } from './UI/sprite.js';
import { Rect } from './UI/rect.js';
import { DebugDraw } from './debugDraw.js';
import { mat4 } from '../lib/gl-matrix/index.js';
// import { mulPoint } from './utils.js';

const allLights = [];
let lightSize = 0;
let lightPositions;
let lightDirections;
let lightColors;
let lightMatrices;

function UpdateLightParams() {
  lightSize = allLights.length;
  lightPositions = new Float32Array(lightSize * 3);
  lightDirections = new Float32Array(lightSize * 3);
  lightColors = new Float32Array(lightSize * 3);
  lightMatrices = new Float32Array(lightSize * 16);
}

export default class Light {
  constructor() {
    this.renderTexture = new RenderTexture(RenderTextureType.Depth, 1536, 1536);
    this.camera = new Camera(1536.0, 1536.0);
    this.camera.fixedSize = true;
    // this.camera.setFOV(45);
    this.camera.zNear = 0.1;
    this.camera.zFar = 10.0;
    this.camera.ortho = true;
    this.camera.orthoSize = 1.0;
    this.camera.clearColor = true;
    this.camera.clearDepth = true;
    this.camera.backgroundColor = [1.0, 1.0, 1.0, 1.0];
    this.camera.enabled = false;
    this.shadowMaterial = new Material('shadow');
    this.color = [1.0, 1.0, 1.0];
    this.index = allLights.length;
    this.debug = false;
    allLights.push(this);
    UpdateLightParams();
  }

  get transform() { return this.camera.transform; }

  // render depth
  render(nodeGroup) {
    if (this.quad || this.debug) {
      DebugDraw.get()?.clear();
      DebugDraw.get()?.addOrigLine(
        this.camera.transform.position, this.camera.transform.matrix,
      );
    }
    this.camera.enabled = true;
    this.renderTexture.bind();
    this.camera.render(nodeGroup, false, undefined, this.shadowMaterial);
    this.renderTexture.unbind();
    this.camera.enabled = false;
  }

  debugRenderTexture() {
    if (!this.quad) {
      this.quad = new GameNode(new Sprite(undefined, this.renderTexture.texture), `debug_shadowmap_${this.index}`);
      this.quad = this.quad.renderable;
      this.quad.rect = new Rect(0, 0, 100, 100).set(
        -256 * (1 + this.index),
        -256,
        256,
        256,
      );
    }
  }

  static Update() {
    let i;
    let j;
    let f;
    let m;
    let c;
    let p;
    let l;
    const imax = allLights.length;
    // console.log(allLights);
    // console.slog(lightPositions);
    for (i = 0; i < imax; i += 1) {
      l = allLights[i];
      p = l.camera.transform.position;
      f = l.camera.transform.forward;
      m = mat4.multiply(mat4.create(), l.camera.projectionMatrix, l.camera.transform.inverseMatrix);
      c = l.color;
      for (j = 0; j < 3; j += 1) {
        lightPositions[(i * 3) + j] = p[j];
        lightDirections[(i * 3) + j] = f[j];
        lightColors[(i * 3) + j] = c[j];
      }
      for (j = 0; j < 16; j += 1) {
        lightMatrices[(i * 16) + j] = m[j];
      }
    }

    // let point = mulPoint(lightMatrices, [1, 1, 1]);
    // console.log(point);
    // console.log(lightMatrices);
    // console.log(lightColors);
  }

  static SetLightUniformDatas(mat) {
    let i;
    let n;
    const imax = allLights.length;
    for (i = 0; i < imax; i += 1) {
      n = `shadowmap${i}`;
      if (mat.hasKey(n)) mat.setUniformData(n, allLights[i].renderTexture.texture);
    }
    if (mat.hasKey('lightPositions')) mat.setUniformData('lightPositions', lightDirections);
    if (mat.hasKey('lightDirections')) mat.setUniformData('lightDirections', lightDirections);
    if (mat.hasKey('lightColors')) mat.setUniformData('lightColors', lightColors);
    if (mat.hasKey('lightMatrices')) mat.setUniformData('lightMatrices', lightMatrices);
  }

  static lightCount() {
    return lightSize;
  }

  static getLights() {
    return allLights;
  }
}

export { Light, allLights };
