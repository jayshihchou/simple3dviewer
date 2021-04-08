import { Renderable } from '../renderable.js';
import { Rect } from './rect.js';
import { input, screenSize } from '../inputmanager.js';

export default class Widget extends Renderable {
  constructor(material) {
    super(material);

    this.rect = new Rect(0, 0, 100, 100);
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.clickStart = false;
    this.onTouchStart = undefined;
    this.onTouch = undefined;
    this.onTouchEnd = undefined;
    this.receiveTouchEvent = false;
  }

  get alpha() { return this.color[3]; }

  set alpha(alpha) { this.color[3] = alpha; }

  get receiveTouch() { return this.receiveTouch; }

  set receiveTouch(receive) {
    this.clickStart = false;
    if (this.receiveTouch !== receive) {
      this.receiveTouch = receive;
      if (this.receiveTouch) {
        input.eventListeners.push(this);
      } else {
        const index = input.eventListeners.indexOf(this);
        if (index !== -1) {
          input.eventListeners.splice(index, 1);
        }
      }
    }
  }

  draw(matrix, camPos, viewMat, projMat, material = undefined) {
    this.material.setUniformData('halfView', [screenSize[0] * 0.5, screenSize[1] * 0.5]);
    this.material.setUniformData('color', this.color);
    this.material.setUniformData('widgetRect', this.rect.array);

    super.draw(matrix, camPos, viewMat, projMat, material);
  }

  OnTouchStart(e) {
    if (this.rect.contains([e.x, e.y])) {
      this.clickStart = true;
      if (this.onTouchStart !== undefined) this.onTouchStart();
      return true;
    }
    return false;
  }

  OnTouchEnd(e) {
    this.clickStart = false;
    if (this.rect.contains([e.x, e.y])) {
      if (this.onTouchEnd !== undefined) this.onTouchEnd();
    }
  }

  OnTouch(e) {
    if (this.clickStart) {
      if (this.onTouch !== undefined) {
        this.onTouch(e);
      }
    }
  }
}

export { Widget };
