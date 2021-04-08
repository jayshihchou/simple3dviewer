/* eslint-disable max-len */
import { mat4, vec2 } from '../lib/gl-matrix/index.js';
import { gl } from './gl.js';
import { Transform } from './transformation.js';
import { DebugDraw } from './debugDraw.js';

function toDeg(radians) {
  return (radians * 180.0) / Math.PI;
}
function toRad(degrees) {
  return (degrees * Math.PI) / 180.0;
}

const allCameras = [];

export default class Camera {
  constructor(width, height) {
    this.enabled = true;
    this.fieldOfView = 60.0;
    this.width = width;
    this.height = height;
    this.aspect = width / height;
    this.zNear = 0.1;
    this.zFar = 10.0;
    this.uiTag = false;
    this.orthoTag = false;
    this.orthoTagSize = 5;
    this.onResize(width, height);
    this.clearColor = true;
    this.backgroundColor = [0.2, 0.3, 0.4, 1.0];
    this.clearDepth = true;

    this.viewport = [0.0, 0.0, 1.0, 1.0];

    this.trans = new Transform();

    allCameras.push(this);
  }

  get transform() { return this.trans; }

  get ui() { return this.uiTag; }

  set ui(ui) {
    this.uiTag = ui;
    if (this.uiTag) {
      if (!this.orthoTag) this.ortho = true;
    }
  }

  get ortho() { return this.orthoTag; }

  set ortho(ortho) {
    this.orthoTag = ortho;
    if (this.orthoTag) {
      this.projectionMatrix = mat4.ortho(mat4.create(),
        -this.orthoTagSize * this.aspect,
        this.orthoTagSize * this.aspect,
        -this.orthoTagSize,
        this.orthoTagSize,
        this.zNear,
        this.zFar);
    } else {
      this.projectionMatrix = mat4.perspective(mat4.create(),
        toRad(this.fieldOfView),
        this.aspect,
        this.zNear,
        this.zFar);
    }
  }

  get orthoSize() { return this.orthoTagSize; }

  set orthoSize(orthoSize) { this.orthoTagSize = orthoSize; }

  get resolution() {
    return vec2.set(vec2.create(), this.width, this.height);
  }

  onResize(width, height) {
    this.width = width;
    this.height = height;
    this.aspect = width / height;
    this.updateProjectionMatrix();
  }

  updateProjectionMatrix() {
    if (this.orthoTag) {
      this.projectionMatrix = mat4.ortho(mat4.create(),
        -this.orthoTagSize * this.aspect,
        this.orthoTagSize * this.aspect,
        -this.orthoTagSize,
        this.orthoTagSize,
        this.zNear,
        this.zFar);
    } else {
      this.projectionMatrix = mat4.perspective(mat4.create(),
        toRad(this.fieldOfView),
        this.aspect,
        this.zNear,
        this.zFar);
    }
  }

  setFOV(fov) {
    this.fieldOfView = fov;
    this.updateProjectionMatrix();
  }

  render(nodeGroup, drawDebugDraw = false, Light = undefined, material = undefined) {
    if (!this.enabled) return this;
    if (this.viewport[0] !== 0.0 || this.viewport[1] !== 0.0 || this.viewport[2] !== 1.0 || this.viewport[3] !== 1.0) {
      gl.viewport(this.viewport[0], this.viewport[1], this.viewport[2], this.viewport[3]);
    }
    const viewMat = this.transform.inverseMatrix;
    const projMat = this.projectionMatrix;

    if (this.uiTag) {
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      // gl.disable(gl.CULL_FACE);
      // ed rendering
      // var err;
      // err = gl.getError();
      // if (err !== gl.NO_ERROR) {
      //     console.error("UI1 error gl error code : " + err);
      // }
      for (let c = nodeGroup.length - 1; c >= 0; c -= 1) {
        if (nodeGroup[c] && nodeGroup[c].ui) {
          nodeGroup[c].render(this, Light, viewMat, projMat);
        }
      }

      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
    } else {
      if (this.clearColor) gl.clearColor(this.backgroundColor[0], this.backgroundColor[1], this.backgroundColor[2], this.backgroundColor[3]);
      if (this.clearDepth) gl.clearDepth(1.0);

      if (this.clearColor || this.clearDepth) {
        if (this.clearColor && this.clearDepth) {
          // eslint-disable-next-line no-bitwise
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        } else if (!this.clearColor) {
          gl.clear(gl.DEPTH_BUFFER_BIT);
        } else if (!this.clearDepth) {
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      }

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      for (let c = nodeGroup.length - 1; c >= 0; c -= 1) {
        if (nodeGroup[c] && !nodeGroup[c].ui) {
          nodeGroup[c].render(this, Light, viewMat, projMat, material);
        }
      }

      if (drawDebugDraw) DebugDraw.get()?.draw(viewMat, projMat);
    }
    return this;
  }
}

export {
  toDeg, toRad, allCameras, Camera,
};
