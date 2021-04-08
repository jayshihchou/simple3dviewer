import { Widget } from './widget.js';
import { Material } from '../material.js';
import { gl } from '../gl.js';
import { Texture2D } from '../texture.js';

export default class Sprite extends Widget {
  constructor(texPath = undefined, tex = undefined, shaderName = undefined) {
    super(null);
    const shader = shaderName || 'sprite';
    this.material = new Material(shader);

    if (tex) {
      this.texture = tex;
    } else {
      this.texture = new Texture2D(
        gl.RGBA, gl.UNSIGNED_BYTE, false, 1, 1, new Uint8Array([255, 255, 255, 255]),
      );
    }
    if (texPath) this.texture.loadFromUrl(texPath);

    this.material.setUniformData('texture', this.texture);

    this.attributeDatas = [
      {
        name: 'position',
        size: 2,
        offset: 0,
        stride: 4,
      },
      {
        name: 'texcoord',
        size: 2,
        offset: 2,
        stride: 4,
      },
    ];

    this.size = 6;
    const vertices = [
    // x y z tx ty
      0.5, -0.5, 1.0, 0.0,
      0.5, 0.5, 1.0, 1.0,
      -0.5, -0.5, 0.0, 0.0,
      -0.5, 0.5, 0.0, 1.0,
      -0.5, -0.5, 0.0, 0.0,
      0.5, 0.5, 1.0, 1.0,
    ];

    this.uploadList(vertices);
  }
}

export { Sprite };
