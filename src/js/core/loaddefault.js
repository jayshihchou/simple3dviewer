import { Rect } from '../engine/UI/rect.js';
import { Button } from '../engine/UI/button.js';
import { addOnStart } from './app.js';

const loadingButton = [];

export default class LoadDefault {
  constructor(app) {
    this.node = app.node;

    this.state = 0;
    const rect = new Rect(0, 0, 0, 0);
    rect.setRelative(0.0, 0.95, 0.2, 0.05);
    this.button1 = new Button(rect);
    this.button1.setText('Load Female');
    this.button1.setTextColor([1.0, 0.0, 0.0, 1.0]);
    this.button1.notify.push(this);
  }

  OnClick() {
    if (this.state >= loadingButton.length) {
      this.state = 0;
    }

    if (this.state === 0) this.button1.setText('Load Full');
    else if (this.state === 1) this.button1.setText('Load Male');
    else if (this.state === 2) this.button1.setText('Load Female');

    if (this.state < loadingButton.length) {
      loadingButton[this.state]();
    }

    this.state += 1;
  }
}

if (loadingButton && loadingButton.length > 0) {
  addOnStart(LoadDefault);
}
export { LoadDefault, loadingButton };
