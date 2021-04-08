import { Rect } from '../engine/UI/rect.js';
import { Button } from '../engine/UI/button.js';
import { Slider } from '../engine/UI/slider.js';
import { DrawingMode } from '../engine/renderable.js';
import { addOnStart } from './app.js';

export default class SwitchRenderingMode {
  constructor(app) {
    this.app = app;
    this.node = app.node;

    let rect = new Rect(0, 0, 0, 0);
    rect.setRelative(0.0, 0.0, 0.2, 0.05);
    this.button1 = new Button(rect);
    if (this.node.renderable.drawingMode === DrawingMode.Normal) {
      this.button1.setText('Shading');
    } else if (this.node.renderable.drawingMode === DrawingMode.WireFrame) {
      this.button1.setText('WireFrame');
    } else {
      this.button1.setText('Shading + WireFrame');
    }
    this.button1.setTextColor([1.0, 0.0, 0.0, 1.0]);
    this.button1.notify.push(this);

    rect = new Rect(0, 0, 0, 0);
    rect.setRelative(0.2, 0.0, 0.2, 0.05);
    this.slider = new Slider(rect);
    this.slider.onChangeTargets.push(this);
    this.slider.enabled = false;
    this.slider.setSliderValue(1.0);
  }

  OnClick() {
    this.node.renderable.drawingMode += 1;
    if (this.node.renderable.drawingMode === DrawingMode.Points) {
      this.node.renderable.drawingMode = DrawingMode.Normal;
    }
    for (let c = this.app.nodeGroup.length - 1; c >= 0; c -= 1) {
      if (this.app.nodeGroup[c] && !this.app.nodeGroup[c].renderable.rect) {
        this.app.nodeGroup[c].renderable.drawingMode = this.node.renderable.drawingMode;
      }
    }
    if (this.node.renderable.drawingMode === DrawingMode.Normal) {
      this.button1.setText('Shading');
    } else if (this.node.renderable.drawingMode === DrawingMode.WireFrame) {
      this.button1.setText('WireFrame');
    } else {
      this.button1.setText('Shading + WireFrame');
    }
    this.slider.enabled = this.node.renderable.drawingMode === DrawingMode.ShadingWithWireFrame;
  }

  OnValue(slider, value) {
    if (this.slider === slider) {
      const val = [0.0, value, 0.0, 1.0];
      // this.node.renderable.wireframeMaterial.setUniformData("color", val);
      for (let c = this.app.nodeGroup.length - 1; c >= 0; c -= 1) {
        if (this.app.nodeGroup[c] && !this.app.nodeGroup[c].renderable.rect) this.app.nodeGroup[c].renderable.wireframeMaterial.setUniformData('color', val);
      }
    }
  }
}

addOnStart(SwitchRenderingMode);

export { SwitchRenderingMode };
