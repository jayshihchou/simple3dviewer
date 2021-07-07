import { Widget } from './widget.js';
import { inverseDevicePixelRatio, realScreenSize } from '../utils.js';
import { input } from '../inputmanager.js';

const container = document.getElementById('container');
export default class TextField extends Widget {
  constructor() {
    super(null);
    this.enabledTag = true;

    this.comparer = [-1, -1];

    this.input = document.createElement('INPUT');
    this.input.onchange = this.onInputText.bind(this);
    this.input.size = 10;
    this.div = document.createElement('div');
    this.textNode = document.createTextNode('');
    this.div.className = 'text_id';
    this.div.style = 'white-space: pre;';
    this.style = this.div.style;
    const halfWidth = this.rect.width * 0.4;
    this.style.left = `${Math.floor(this.rect.x * inverseDevicePixelRatio)}px`;
    this.style.width = `${Math.floor(halfWidth * inverseDevicePixelRatio)}px`;
    this.style.top = `${Math.floor(realScreenSize[1] - (this.rect.y + this.rect.height) * inverseDevicePixelRatio)}px`;
    this.style.fontSize = '20px';
    this.style.color = 'rgba(0.0, 0.0, 0.0, 1.0)';
    this.color = [0.0, 0.0, 0.0, 1.0];
    this.text = '';
    this.inputStyle = this.input.style;
    this.inputStyle.left = `${Math.floor((this.rect.x + halfWidth) * inverseDevicePixelRatio)}px`;
    this.inputStyle.width = `${Math.floor(halfWidth * inverseDevicePixelRatio)}px`;
    this.inputStyle.top = `${Math.floor(realScreenSize[1] - (this.rect.y + this.rect.height) * inverseDevicePixelRatio)}px`;
    this.inputStyle.fontSize = '20px';
    this.inputStyle.color = 'rgba(255, 255, 255, 1.0)';
    this.div.appendChild(this.textNode);
    this.div.appendChild(this.input);

    this.borders = [0, 0];
    this.useBorderX = true;
    this.useBorderY = true;
    this.textSize = [1, 1];

    container.appendChild(this.div);
    this.rect.onChangeTargets.push(this);
    this.backgroundColor = 'rgba(0.0, 0.0, 0.0, 0.5)';
    this.backgroundColorPressed = 'rgba(0.0, 0.0, 0.0, 0.8)';
    this.pressing = false;
    this.inputStyle.backgroundColor = this.backgroundColor;
    this.borders[1] = this.rect.height;
    input.eventListeners.push(this);
    this.onInputText = undefined;
    this.onInputTextTargets = [];
  }

  onInputText() {
    const { value } = this.input;
    if (this.onInputText) {
      this.onInputText(this, value);
    }
    this.onInputTextTargets.forEach((tar) => {
      if (tar.OnInputText) tar.OnInputText(this, value);
    });
  }

  setText(text) {
    if (this.text !== text) {
      this.text = text;
      this.textNode.nodeValue = this.text;

      this.OnRectChanged(this.rect);
    }
    return this;
  }

  setFieldText(text) {
    this.input.value = text;
  }

  setTextColor(col) {
    this.color = col;
    this.style.color = `rgba(${this.color[0] * 255}, ${this.color[1] * 255}, ${this.color[2] * 255}, ${this.color[3]})`;
    this.inputStyle.color = `rgba(${this.color[0] * 255}, ${this.color[1] * 255}, ${this.color[2] * 255}, ${this.color[3]})`;
    return this;
  }

  setTextSize(size) {
    const pxSize = `${size}px`;
    this.inputStyle.fontSize = pxSize;
    this.style.fontSize = pxSize;
    return this;
  }

  OnRectChanged(rect) {
    this.rect = rect;

    const halfWidth = this.rect.width * 0.4;
    this.style.left = `${Math.floor(this.rect.x * inverseDevicePixelRatio)}px`;
    this.style.width = `${Math.floor(halfWidth * inverseDevicePixelRatio)}px`;
    this.style.top = `${Math.floor(realScreenSize[1] - (this.rect.y + this.rect.height) * inverseDevicePixelRatio)}px`;
    this.inputStyle.left = `${Math.floor((this.rect.x + halfWidth) * inverseDevicePixelRatio)}px`;
    this.inputStyle.width = `${Math.floor(halfWidth * inverseDevicePixelRatio)}px`;
    this.inputStyle.top = `${Math.floor(realScreenSize[1] - (this.rect.y + this.rect.height) * inverseDevicePixelRatio)}px`;
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
      if (!this.enabled) this.style.display = 'none';
      else this.style.display = 'block';
    }
  }

  // for input text
  OnTouchStart(e) {
    if (!this.enabledTag) return false;
    // console.log(`this.rect: ${this.rect}, e: (${e.x}, ${e.y})`);
    if (this.rect.contains([e.x, e.y])) {
      this.pressing = true;
      this.inputStyle.backgroundColor = this.backgroundColorPressed;
      return true;
    }
    return false;
  }

  OnTouchEnd(e) {
    if (!this.enabledTag) return;
    if (this.pressing) {
      if (this.rect.contains([e.x, e.y])) {
        this.input.focus();
      }
      this.inputStyle.backgroundColor = this.backgroundColor;
    }
    this.pressing = false;
  }

  OnMouseOutWindow() {
    if (this.pressing) {
      this.inputStyle.backgroundColor = this.backgroundColor;
    }
  }

  OnMouseEnterWindow() {
    if (!input.mouseDown && this.pressing) {
      this.pressing = false;
    }
    if (this.pressing) {
      this.inputStyle.backgroundColor = this.backgroundColorPressed;
    }
  }
}

export { TextField };
