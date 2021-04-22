import { Transform } from './transformation.js';
import { Widget } from './UI/widget.js';

const gameNodeGroup = [];
const emptyGameNodeIDs = [];
let nodeID = -1;

export default class GameNode {
  constructor(renderable, name = undefined) {
    this.renderable = renderable;
    if (this.renderable !== null && this.renderable !== undefined) this.renderable.gameNode = this;
    this.transform = new Transform();
    this.components = [];
    this.id = GameNode.getEmptyID();
    this.ui = this.renderable instanceof Widget;
    this.name = `node (${this.id}): `;
    if (name !== undefined) this.name += name;

    gameNodeGroup[this.id] = this;

    return this;
  }

  static getEmptyID() {
    if (emptyGameNodeIDs.length > 0) {
      return emptyGameNodeIDs.pop();
    }
    nodeID += 1;
    return nodeID;
  }

  static getGroup() {
    return gameNodeGroup;
  }

  static destroy(gameNode) {
    gameNodeGroup[gameNode.id] = null;
    emptyGameNodeIDs.push(gameNode.id);
    return true;
  }

  update(dt) {
    for (let c = this.components.length - 1; c >= 0; c -= 1) {
      const com = this.components[c];
      if (!com) {
        this.components.splice(c, 1);
      } else {
        com.update?.(dt);
      }
    }
  }

  render(camera, Light, viewMat, projMat, material) {
    if (this.renderable) {
      this.renderable.draw(this.transform.matrix, camera, Light, viewMat, projMat, material);
    }
  }

  addComponent(component) {
    if (component) {
      this.components.push(component);
    }
  }

  getComponent(componentName) {
    for (let c = this.components.length - 1; c >= 0; c -= 1) {
      if (this.components[c].constructor.name === componentName) return this.components[c];
    }
    return null;
  }

  removeComponent(componentName) {
    for (let c = this.components.length - 1; c >= 0; c -= 1) {
      if (this.components[c].constructor.name === componentName) {
        this.components.splice(c, 1);
        break;
      }
    }
  }
}

export { GameNode };
