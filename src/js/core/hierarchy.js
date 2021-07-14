/* eslint-disable class-methods-use-this */
import { GameNode } from '../engine/gamenode.js';
import { input } from '../engine/inputmanager.js';
import { Button } from '../engine/UI/button.js';
import { Text } from '../engine/UI/text.js';
import { Rect } from '../engine/UI/rect.js';
import { UIContainer, AnchorType } from '../engine/UI/uicontainer.js';
import { addOnStart } from './app.js';
import { Slider } from '../engine/UI/slider.js';
import { TextField } from '../engine/UI/textField.js';

export default class Hierarchy {
  constructor(a) {
    const app = a;
    this.hierarchy = new UIContainer(new Rect(0, 100, 300, 300));
    this.hierarchy.allowGrowth = true;
    this.hierarchy.title.setText('Nodes');
    this.hierarchy.pressedColor = this.hierarchy.color;
    this.addNodeButton = new Button(new Rect(0, 0, 300, 25));
    this.addNodeButton.setText('Create');
    this.addNodeButton.notify.push(this);
    this.CreateNewNode = function onCreateNewNode() {
      this.RefreshLater();
      return app.GetNextNode();
    };
    this.hierarchy.addWidget(this.addNodeButton);
    this.itemButtons = [];
    this.nodeStatus = {};

    this.lastClicked = undefined;
    app.addEvent('PosToNode', this.PosToNode, this);
    app.addEvent('OnLoadMesh', this.RefreshLater, this);

    this.currentIndex = undefined;
    this.currentNode = undefined;

    this.inspector = new UIContainer(new Rect(400, 100, 300, 100));
    this.inspector.allowGrowth = true;
    this.inspector.title.setText('Inspector');
    this.inspector.pressedColor = this.inspector.color;
    this.inspEnableBtn = new Button(new Rect(0, 0, 300, 25));
    this.inspEnableBtn.onClick = () => {
      if (this.currentNode !== undefined) {
        this.currentNode.renderable.enabled = !this.currentNode.renderable.enabled;
      }
    };
    this.inspector.addWidget(this.inspEnableBtn);
    this.inspRenderingModelBtn = new Button(new Rect(0, 0, 300, 50));
    this.inspRenderingModelBtn.onClick = () => {
      if (this.currentIndex !== undefined && this.currentNode !== undefined) {
        const i = this.currentIndex;
        const nodeStatus = this.nodeStatus[i];
        if (!nodeStatus.renderingStatus) {
          nodeStatus.renderingStatus = this.currentNode.renderable.material.blendType;
        }
        nodeStatus.renderingStatus += 1;
        if (nodeStatus.renderingStatus === 4) {
          nodeStatus.renderingStatus = 0;
        }
        this.currentNode.renderable.material.setBlendType(nodeStatus.renderingStatus);
        let typeStr;
        switch (nodeStatus.renderingStatus) {
          case 1:
            typeStr = 'Alpha';
            break;
          case 2:
            typeStr = 'Add';
            break;
          default:
            typeStr = 'No Blend';
            break;
        }
        this.inspRenderingModelBtn.setText(typeStr);
      }
    };
    this.inspector.addWidget(this.inspRenderingModelBtn);
    this.inspChangeCulling = new Button(new Rect(0, 0, 300, 50));
    this.inspChangeCulling.onClick = () => {
      if (this.currentIndex !== undefined && this.currentNode !== undefined) {
        const i = this.currentIndex;
        const nodeStatus = this.nodeStatus[i];
        if (!nodeStatus.CullingStatus) {
          nodeStatus.CullingStatus = this.currentNode.renderable.material.cullingType;
        }
        nodeStatus.CullingStatus += 1;
        if (nodeStatus.CullingStatus === 4) {
          nodeStatus.CullingStatus = 0;
        }
        let cullingStr;
        switch (nodeStatus.CullingStatus) {
          case 1:
            cullingStr = 'CullingMode: Front';
            break;
          case 2:
            cullingStr = 'CullingMode: Front And Back';
            break;
          case 3:
            cullingStr = 'CullingMode: Off';
            break;
          default:
            cullingStr = 'CullingMode: Back';
            break;
        }
        this.currentNode.renderable.material.setCullingType(nodeStatus.CullingStatus);
        this.inspChangeCulling.setText(cullingStr);
      }
    };
    this.inspector.addWidget(this.inspChangeCulling);
    this.inspScaleMin = 1e-3;
    this.inspScaleMax = 10.0;
    this.inspScaleText = new GameNode(new TextField().setText(`Scale[${this.inspScaleMin}, ${this.inspScaleMax}]: 1.0`).setTextColor([0.6, 0.6, 0.9, 1.0]), 'inspector_scale_text').renderable;
    this.inspScaleText.rect = new Rect(0, 0, 300, 50);
    this.inspScaleText.onInputTextTargets.push(this);
    this.inspector.addWidget(this.inspScaleText);
    this.inspScaleSlider = new Slider(new Rect(0, 0, 300, 50));
    this.inspScaleSlider.onChangeTargets.push(this);
    this.inspector.addWidget(this.inspScaleSlider);
    this.inspVertexInfoText = new GameNode(new Text().setText('').setTextColor([0.6, 0.6, 0.9, 1.0]), 'inspector_vertex_text').renderable;
    this.inspVertexInfoText.rect = new Rect(0, 0, 300, 50);
    // this.inspRenderingModelBtn = new Button(new Rect(0, 0, 300, 50));
    this.inspector.addWidget(this.inspVertexInfoText);
    this.inspector.anchorType = AnchorType.Right;

    this.Refresh();
    this.hierarchy.Refresh();
    this.hierarchy.enabled = false;
    this.inspector.enabled = false;
    this.inspectorEnable = false;
    input.eventListeners.push(this);
  }

  RefreshLater() {
    this.update = this.Refresh;
  }

  Refresh() {
    const nodes = GameNode.getDebugGroup();
    let i;
    const imax = nodes.length;
    if (this.itemButtons.length < nodes.length) {
      i = this.itemButtons.length;
      let b;
      for (; i < imax; i += 1) {
        b = new Button(new Rect(0, 0, 300, 50));
        // b.setColor([1.0, 1.0, 1.0, 0.7]);
        b.notify.push(this);
        b.enabled = this.hierarchy.enabled;
        this.hierarchy.addWidget(b);
        this.itemButtons.push(b);
        this.nodeStatus[i] = {};
      }
    }
    this.itemButtons.forEach((button, j) => {
      button.setText(`${nodes[j].name}`);
    });
    this.hierarchy.Refresh();
    this.RefreshInspector();
    this.update = undefined;
  }

  // update() {
  //   // console.log('here');
  //   this.Refresh();
  // }

  OnClick(button) {
    if (this.addNodeButton === button) {
      this.CreateNewNode();
      return;
    }
    let i;
    const imax = this.itemButtons.length;
    for (i = 0; i < imax; i += 1) {
      if (button === this.itemButtons[i]) {
        const nodes = GameNode.getDebugGroup();
        if (this.currentIndex === undefined || this.currentIndex !== i) {
          this.inspector.enabled = true;
        } else {
          this.inspector.enabled = !this.inspector.enabled;
        }
        this.inspectorEnable = this.inspector.enabled;
        this.currentIndex = i;
        this.currentNode = nodes[i];
        this.RefreshInspector();
        this.lastClicked = i;
        break;
      }
    }
  }

  RefreshInspector() {
    if (this.currentNode === undefined || this.currentIndex === undefined) return;
    this.inspector.title.setText(this.currentNode.name);
    this.inspEnableBtn.setText(`${this.currentNode.renderable.enabled ? 'enabled' : 'disabled'}`);
    const nodeStatus = this.nodeStatus[this.currentIndex];
    if (!nodeStatus.renderingStatus) {
      nodeStatus.renderingStatus = this.currentNode.renderable.material.blendType;
    }
    let typeStr = 'BlendMode : ';
    switch (nodeStatus.renderingStatus) {
      case 1:
        typeStr += 'Alpha';
        break;
      case 2:
        typeStr += 'Add';
        break;
      default:
        typeStr += 'No Blend';
        break;
    }
    this.inspRenderingModelBtn.setText(typeStr);
    this.inspVertexInfoText.setText(`vertex : ${this.currentNode.renderable.meshVertexCount}, face : ${this.currentNode.renderable.meshFaceCount}`);

    let cullingStr;
    switch (nodeStatus.CullingStatus) {
      case 1:
        cullingStr = 'CullingMode: Front';
        break;
      case 2:
        cullingStr = 'CullingMode: Front And Back';
        break;
      case 3:
        cullingStr = 'CullingMode: Off';
        break;
      default:
        cullingStr = 'CullingMode: Back';
        break;
    }
    this.inspChangeCulling.setText(cullingStr);

    const scale = this.currentNode.transform.scale[0];
    this.inspScaleText.setText(`Scale[${this.inspScaleMin}, ${this.inspScaleMax}]:`);
    this.inspScaleText.setFieldText(`${scale.toFixed(2)}`);
    const range = this.inspScaleMax - this.inspScaleMin;
    const val = (scale - this.inspScaleMin) / range;
    this.inspScaleSlider.setSliderValue(val);
    // this.inspector.enabled = !this.inspector.enabled;
    this.inspector.Refresh();
  }

  PosToNode(...args) {
    const ls = args;
    this.RefreshLater();
    if (this.hierarchy.enabled) {
      // console.log(this);
      // console.log(ls[1]);
      if (this.addNodeButton.rect.contains(ls[1])) {
        ls[0][0] = this.CreateNewNode();
        return;
      }
      let i;
      const imax = this.itemButtons.length;
      for (i = 0; i < imax; i += 1) {
        if (this.itemButtons[i].rect.contains(ls[1])) {
          const nodes = GameNode.getDebugGroup();
          ls[0][0] = nodes[i];
          // console.log(ls[0][0].name);
          return;
        }
      }
    }
    ls[0][0] = undefined;
  }

  OnKeyDown(e) {
    if (e.key === 'h') {
      this.hierarchy.enabled = !this.hierarchy.enabled;
      this.inspector.enabled = this.inspectorEnable && this.hierarchy.enabled;
    }
  }

  OnValue(slider, value) {
    if (slider === this.inspScaleSlider) {
      if (this.currentIndex !== undefined && this.currentNode !== undefined) {
        const range = this.inspScaleMax - this.inspScaleMin;
        const scale = this.inspScaleMin + range * value;
        this.inspScaleText.setFieldText(`${scale.toFixed(2)}`);
        this.currentNode.transform.scale = [scale, scale, scale];
      }
    }
  }

  OnInputText(textField, text) {
    if (textField === this.inspScaleText) {
      if (this.currentIndex !== undefined && this.currentNode !== undefined) {
        const scaleNext = parseFloat(text);
        const scale = this.currentNode.transform.scale[0];
        if (scaleNext !== scale) {
          this.currentNode.transform.scale = [scaleNext, scaleNext, scaleNext];
        }
      }
    }
  }
}

addOnStart(Hierarchy);

export { Hierarchy };
