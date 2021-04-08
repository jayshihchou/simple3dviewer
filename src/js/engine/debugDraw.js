import { Renderable } from './renderable.js';
import { Shader } from './shader.js';
import { mat4, vec3 } from '../lib/gl-matrix/index.js';
import { gl } from './gl.js';
import { mat4MulVec3 } from './transformation.js';

let debugDraw;
export default class DebugDraw extends Renderable {
  constructor() {
    super(null);

    this.mode = gl.LINES;

    this.attributeDatas = [{
      name: 'position', size: 3, offset: 0, stride: 3,
    }];

    this.matrix = mat4.create();
    this.shader = new Shader(Shader.FindShaderSource('debug'));

    this.size = 2;
    this.clearFrame = false;

    this.datas = [];

    return this;
  }

  static get() {
    if (!debugDraw) debugDraw = new DebugDraw();
    return debugDraw;
  }

  addOrigLine(point, matrix = undefined) {
    let forward = point.slice();
    if (matrix) {
      forward = vec3.add(vec3.create(), forward, mat4MulVec3(matrix, [2.0, 0.0, 0.0]));
    } else {
      forward[0] += 2.0;
    }
    this.addLine(point, forward, [1.0, 0.0, 0.0, 1.0]);
    forward = point.slice();
    if (matrix) {
      forward = vec3.add(vec3.create(), forward, mat4MulVec3(matrix, [0.0, 2.0, 0.0]));
    } else {
      forward[1] += 2.0;
    }
    this.addLine(point, forward, [0.0, 1.0, 0.0, 1.0]);
    forward = point.slice();
    if (matrix) {
      forward = vec3.add(vec3.create(), forward, mat4MulVec3(matrix, [0.0, 0.0, -3.0]));
    } else {
      forward[2] += 3.0;
    }
    this.addLine(point, forward, [0.0, 0.0, 1.0, 1.0]);
  }

  addLine(fromPnt, toPnt, color = undefined, width = 1.0) {
    this.datas.push(
      {
        line: [fromPnt[0], fromPnt[1], fromPnt[2], toPnt[0], toPnt[1], toPnt[2]],
        width,
        color,
      },
    );
  }

  clear() {
    this.clearFrame = true;
  }

  draw(viewMat, projMat) {
    if (this.datas.length > 0) {
      let c; let
        max;
      for (c = 0, max = this.datas.length; c < max; c += 1) {
        const data = this.datas[c];

        this.buildLine(data.line);

        this.drawCurrentLine(viewMat, projMat, data.color, data.width);
      }
    }
    if (this.clearFrame) {
      this.datas.length = 0;
    }
    return this;
  }

  buildLine(vertices) {
    this.uploadList(vertices);
    return this;
  }

  drawCurrentLine(viewMat, projMat, color, width) {
    this.shader.bind();
    this.shader.setMatrix4('viewMatrix', viewMat);
    this.shader.setMatrix4('projectionMatrix', projMat);
    this.shader.setMatrix4('modelMatrix', this.matrix);

    this.shader.setVec4('color', !color ? [1.0, 0.0, 0.0, 1.0] : color);

    this.setAttributesForShader(this.shader, this.buffer, this.attributeDatas);

    gl.lineWidth(width);

    gl.drawArrays(this.mode, this.first, this.size);

    this.disableAttribs(this.shader, this.attributeDatas);

    this.shader.unbind();
  }
}

export { DebugDraw };
