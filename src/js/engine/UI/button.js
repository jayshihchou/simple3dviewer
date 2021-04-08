import { Rect } from './rect.js';
import { GameNode } from '../gamenode.js';
import { Text } from './text.js';
import { Sprite } from './sprite.js';
import { input, setFrameDirty } from '../inputmanager.js';

export default class Button {
  constructor(rect) {
    this.enabledTag = true;
    this.rect = rect || new Rect(0, 0, 100, 30);
    this.rect.onChangeTargets.push(this);

    let node = new GameNode(new Text(), 'buttontextTag');
    this.text = node.renderable;
    node = new GameNode(new Sprite(), 'button_background');
    this.background = node.renderable;
    this.background.rect = this.rect;
    this.background.color = [1.0, 1.0, 1.0, 0.3];

    this.text.rect.set(this.rect.x, this.rect.y, this.rect.width, this.rect.height);

    this.pressing = false;
    this.onClick = undefined;
    this.notify = [];

    input.eventListeners.push(this);
  }

  set enabled(yes) {
    if (this.enabledTag !== yes) {
      this.enabledTag = yes;
      this.background.enabled = this.enabledTag;
      this.text.enabled = this.enabledTag;
    }
  }

  get enabled() {
    return this.enabledTag;
  }

  setText(text) {
    if (this.textTag !== text) {
      setFrameDirty();
      this.textTag = text;
      this.text.setText(text);
    }
  }

  setTextColor(col) {
    this.text.setTextColor(col);
  }

  // setColor(col) {
  //     this.background.color = col;
  // }

  OnTouchStart(e) {
    if (this.rect.contains([e.x, e.y])) {
      this.pressing = true;
      this.background.color = [0.5, 0.5, 0.5, 1.0];
    }
  }

  OnTouchEnd(e) {
    if (this.pressing) {
      if (this.rect.contains([e.x, e.y])) {
        if (this.onClick !== undefined) this.onClick();
        for (let i = this.notify.length - 1; i >= 0; i -= 1) {
          if (this.notify[i].OnClick !== undefined) this.notify[i].OnClick(this);
        }
      }
      this.background.color = [1.0, 1.0, 1.0, 0.3];
    }
    this.pressing = false;
  }

  OnRectChanged(rect) {
    this.rect = rect;
    this.text.rect.set(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
  }

  OnMouseOutWindow() {
    if (this.pressing) {
      this.background.color = [1.0, 1.0, 1.0, 0.3];
    }
  }

  OnMouseEnterWindow() {
    if (!input.mouseDown && this.pressing) {
      this.pressing = false;
    }
    if (this.pressing) {
      this.background.color = [0.5, 0.5, 0.5, 1.0];
    }
  }
}
export { Button };