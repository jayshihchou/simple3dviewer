import { Widget } from './widget.js';
import { inverseDevicePixelRatio, realScreenSize } from '../utils.js';

const container = document.getElementById('container');
const textSizeCalculator = document.createRange();
export default class Text extends Widget {
  constructor() {
    super(null);
    this.enabledTag = true;

    this.comparer = [-1, -1];

    this.div = document.createElement('div');
    this.textNode = document.createTextNode('');
    this.div.className = 'text_id';
    this.style = this.div.style;
    this.style.left = `${Math.floor(this.rect.x * inverseDevicePixelRatio)}px`;
    this.style.top = `${Math.floor(realScreenSize[1] - (this.rect.y + this.rect.height) * inverseDevicePixelRatio)}px`;
    this.style.fontSize = '20px';
    this.style.color = 'rgba(0.0, 0.0, 0.0, 1.0)';
    this.color = [0.0, 0.0, 0.0, 1.0];
    this.text = '';
    this.div.appendChild(this.textNode);

    this.borders = [0, 0];
    this.textSize = [1, 1];

    container.appendChild(this.div);
    this.rect.onChangeTargets.push(this);
  }

  setText(text) {
    if (this.text !== text) {
      this.textNode.nodeValue = text;
      this.text = text;

      textSizeCalculator.selectNodeContents(this.textNode);
      const rects = textSizeCalculator.getClientRects();
      if (rects.length > 0) {
        this.textSize[0] = rects[0].width;
        this.textSize[1] = rects[0].height;
        this.borders[0] = (this.rect.width - rects[0].width) * 0.5;
        this.borders[1] = (this.rect.height - rects[0].height) * 0.5;
        this.OnRectChanged(this.rect);
        // this.rect.set(this.rect.x, this.rect.y, rects[0].width, rects[0].height);
      }
    }
  }

  setTextColor(col) {
    this.color = col;
    this.style.color = `rgba(${this.color[0] * 255}, ${this.color[1] * 255}, ${this.color[2] * 255}, ${this.color[3] * 255})`;
  }

  setTextSize(size) {
    this.style.fontSize = `${size}px`;
  }

  OnRectChanged(rect) {
    this.rect = rect;

    textSizeCalculator.selectNodeContents(this.textNode);
    const rects = textSizeCalculator.getClientRects();
    if (rects.length > 0) {
      this.textSize[0] = rects[0].width;
      this.textSize[1] = rects[0].height;
      this.borders[0] = (this.rect.width - rects[0].width) * 0.5;
      this.borders[1] = (this.rect.height - rects[0].height) * 0.5;
      // this.rect.set(this.rect.x, this.rect.y, rects[0].width, rects[0].height);
    }

    this.style.left = `${Math.floor((this.rect.x + this.borders[0]) * inverseDevicePixelRatio)}px`;
    this.style.top = `${Math.floor(realScreenSize[1] - (this.rect.y + this.textSize[1] + this.borders[1]) * inverseDevicePixelRatio)}px`;
  }

  // since we using html to draw text...
  draw() {
    if (this.comparer[0] !== this.rect.x || this.comparer[1] !== this.rect.y) {
      this.comparer[0] = this.rect.x;
      this.comparer[1] = this.rect.y;
      this.OnRectChanged(this.rect);
    }
    if (this.enabled !== this.enabledTag) {
      this.enabledTag = this.enabled;
      this.textNode.nodeValue = this.enabled ? this.text : '';
    }
  }
}

export { Text };
