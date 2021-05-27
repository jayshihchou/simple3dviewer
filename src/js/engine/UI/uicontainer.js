import { GameNode } from '../gamenode.js';
import { input } from '../inputmanager.js';
import { Rect } from './rect.js';
import { Sprite } from './sprite.js';
import { Text } from './text.js';
import { clamp, screenSize } from '../utils.js';

export default class UIContainer {
  constructor(rect) {
    this.enabledTag = true;
    this.rect = rect || new Rect(0, 0, 100, 100);
    // this.rect.onChangeTargets.push(this);

    this.color = [0.3, 0.3, 0.6, 0.3];
    this.pressedColor = [0.1, 0.1, 0.6, 0.3];

    let node = new GameNode(new Sprite(), 'uicontainer_background');
    this.background = node.renderable;
    this.background.color = this.color;

    node = new GameNode(new Text().setText('container').setTextColor([0.1, 0.1, 0.3, 1.0]), 'uicontainer_title');
    this.title = node.renderable;

    this.widgets = [];

    this.allowGrowth = false;
    this.border = [15, 45, 15, 15];
    this.realRect = new Rect(
      this.rect.x,
      this.rect.y,
      this.rect.width + this.border[0] + this.border[2],
      this.rect.height + this.border[1] + this.border[3],
    );
    this.background.rect = this.realRect;
    this.Refresh();

    this.title.rect = new Rect(0, 0, this.realRect.width, 50);

    this.pressing = false;
    this.pressOffset = undefined;
    input.eventListeners.push(this);
  }

  set enabled(yes) {
    if (this.enabledTag !== yes) {
      this.enabledTag = yes;
      this.title.enabled = this.enabledTag;
      this.background.enabled = this.enabledTag;
      this.widgets.forEach((v) => {
        const w = v;
        w.enabled = this.enabledTag;
      });
      this.Refresh();
    }
  }

  get enabled() {
    return this.enabledTag;
  }

  addWidget(w) {
    this.widgets.push(w);
    this.Refresh();
  }

  Refresh() {
    const oldHeight = this.realRect.height;
    if (this.allowGrowth) {
      let h = this.border[1] + this.border[3];
      let w = this.rect.width + this.border[0] + this.border[2];
      this.widgets.forEach((v) => {
        h += v.rect.height + 5;
        w = Math.max(w, v.rect.width + this.border[0] + this.border[2]);
      });
      this.realRect.width = Math.max(w, this.rect.width);
      this.realRect.height = Math.max(h, this.rect.height);
    }
    if (oldHeight !== this.realRect.height) {
      this.realRect.y -= this.realRect.height - oldHeight;
    }
    let { x, y } = this.realRect;
    x += this.border[0];
    y += this.realRect.height - this.border[1];
    this.widgets.forEach((v) => {
      y -= v.rect.height + 5;
      v.rect.set(x, y, v.rect.width, v.rect.height);
    });
    this.title.rect.x = this.realRect.x;
    this.title.rect.y = this.realRect.y + this.realRect.height - this.title.rect.height;
  }

  OnTouchStart(e) {
    if (!this.enabledTag) return false;
    if (this.realRect.contains([e.x, e.y])) {
      this.pressOffset = this.realRect.toLocal([e.x, e.y]);
      this.pressing = true;
      this.background.color = this.pressedColor;
      return true;
    }
    return false;
  }

  OnTouchEnd() {
    if (this.pressing) {
      this.pressing = false;
      this.background.color = this.color;
    }
  }

  OnTouch(e) {
    if (!this.enabledTag) return;
    if (this.pressing) {
      this.realRect.x = clamp(e.x - this.pressOffset[0], 0, screenSize[0] - this.realRect.width);
      this.realRect.y = clamp(e.y - this.pressOffset[1], 0, screenSize[1] - this.realRect.height);
      // console.log(this.realRect.toString());
      this.Refresh();
    }
  }

  OnMouseOutWindow() {
    if (this.pressing) {
      this.background.color = this.color;
    }
  }

  OnMouseEnterWindow() {
    if (!input.mouseDown && this.pressing) {
      this.pressing = false;
    }
    if (this.pressing) {
      this.background.color = this.pressedColor;
    }
  }
}

export { UIContainer };
