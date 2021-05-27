/* eslint-disable class-methods-use-this */
import { GameNode } from '../engine/gamenode.js';
import { input } from '../engine/inputmanager.js';
import { Button } from '../engine/UI/button.js';
import { Rect } from '../engine/UI/rect.js';
import { UIContainer } from '../engine/UI/uicontainer.js';
import { addOnStart } from './app.js';

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
      return app.GetNextNode();
    };
    this.hierarchy.addWidget(this.addNodeButton);
    this.itemButtons = [];
    this.Refresh();
    this.hierarchy.Refresh();
    this.lastClicked = undefined;
    app.addEvent('PosToNode', this.PosToNode, this);
    app.addEvent('OnLoadMesh', this.Refresh, this);
    this.hierarchy.enabled = false;
    this.renderingStatus = [];
    input.eventListeners.push(this);
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
      }
    }
    for (i = 0; i < imax; i += 1) {
      this.itemButtons[i].setText(`${nodes[i].name} : No Blend`);
    }
    this.hierarchy.Refresh();
  }

  // update() {
  //   // console.log('here');
  //   this.Refresh();
  // }

  OnClick(button) {
    if (this.addNodeButton === button) {
      this.CreateNewNode();
      this.Refresh();
      return;
    }
    let i;
    const imax = this.itemButtons.length;
    for (i = 0; i < imax; i += 1) {
      if (button === this.itemButtons[i]) {
        const nodes = GameNode.getDebugGroup();
        if (!this.renderingStatus[i]) {
          this.renderingStatus[i] = 0;
        }
        this.renderingStatus[i] += 1;
        if (this.renderingStatus[i] === 4) {
          this.renderingStatus[i] = 0;
        }
        nodes[i].renderable.enabled = this.renderingStatus[i] < 3;
        let typeStr = 'Disabled';
        if (nodes[i].renderable.enabled) {
          nodes[i].renderable.material.setBlendType(this.renderingStatus[i]);
          switch (this.renderingStatus[i]) {
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
        }
        // console.log(button);
        button.setText(`${nodes[i].name} : ${typeStr}`);
        this.lastClicked = i;
        break;
      }
    }
  }

  PosToNode(...args) {
    const ls = args;
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
          return;
        }
      }
    }
    ls[0][0] = undefined;
  }

  OnKeyDown(e) {
    if (e.key === 'h') {
      this.hierarchy.enabled = !this.hierarchy.enabled;
    }
  }
}

addOnStart(Hierarchy);

export { Hierarchy };
