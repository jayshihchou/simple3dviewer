import { vec3 } from '../lib/gl-matrix/index.js';
// import JSZip from '../lib/jszip.min.js';
import fbxloader from '../lib/fbxloader.js';

import { gl, initGL } from '../engine/gl.js';
import { logger } from '../engine/logger.js';
import { GameNode } from '../engine/gamenode.js';
import { Mesh } from '../engine/mesh.js';
import { Camera, allCameras } from '../engine/camera.js';
import { allLights, Light } from '../engine/light.js';
import { input } from '../engine/inputmanager.js';
import {
  setFrameDirty, getFrameDirty, screenSize,
  resizeListeners, realScreenSize, updateScreenSize,
} from '../engine/utils.js';
import { Texture2D } from '../engine/texture.js';
import { timer } from '../engine/timer.js';
import { ObjLoader } from '../engine/objLoader.js';
import { ReadFile } from '../engine/readFile.js';
import { resourceManager } from '../engine/resourcemanager.js';

let app = null;
const onStarts = [];

let cubeText = `
v -1.000000 -1.000000 1.000000
v 1.000000 -1.000000 1.000000
v -1.000000 1.000000 1.000000
v 1.000000 1.000000 1.000000
v -1.000000 1.000000 -1.000000
v 1.000000 1.000000 -1.000000
v -1.000000 -1.000000 -1.000000
v 1.000000 -1.000000 -1.000000
vt 0.000000 0.000000
vt 1.000000 0.000000
vt 0.000000 1.000000
vt 1.000000 1.000000
f 1/1/ 2/2/ 3/3/
f 3/3/ 2/2/ 4/4/
f 3/1/ 4/2/ 5/3/
f 5/3/ 4/2/ 6/4/
f 5/4/ 6/3/ 7/2/
f 7/2/ 6/3/ 8/1/
f 7/1/ 8/2/ 1/3/
f 1/3/ 8/2/ 2/4/
f 2/1/ 8/2/ 4/3/
f 4/3/ 8/2/ 6/4/
f 7/1/ 1/2/ 5/3/
f 5/3/ 1/2/ 3/4/`;
cubeText = cubeText
  .replace(/\sf+/g, '\nf')
  .replace(/\svn+/g, '\nvn')
  .replace(/\svt+/g, '\nvt')
  .replace(/\sv+/g, '\nv');

/*!
  An experiment in getting accurate visible viewport dimensions across devices
  (c) 2012 Scott Jehl.
  MIT/GPLv2 Licence
  */
function getViewportSize() {
  const test = document.createElement('div');

  test.style.cssText = 'position: fixed;top: 0;left: 0;bottom: 0;right: 0;';
  document.documentElement.insertBefore(test, document.documentElement.firstChild);

  const dims = [test.offsetWidth, test.offsetHeight];
  document.documentElement.removeChild(test);

  return dims;
}

function onResize(width, height) {
  const newSize = [width, height];
  logger.Resize(width, height);
  for (let i = allCameras.length - 1; i >= 0; i -= 1) {
    allCameras[i].onResize(width, height);
  }

  for (let i = resizeListeners.length - 1; i >= 0; i -= 1) {
    if (resizeListeners[i].OnResize !== undefined) resizeListeners[i].OnResize(screenSize, newSize);
  }
  updateScreenSize(newSize[0], newSize[1]);
}

function resizeToMatchDisplaySize(canvas) {
  // eslint-disable-next-line no-unused-vars
  realScreenSize[0] = canvas.clientWidth;
  realScreenSize[1] = canvas.clientHeight;
  // var displayWidth = canvas.clientWidth * window.devicePixelRatio;
  // var displayHeight = canvas.clientHeight * window.devicePixelRatio;
  const viewportSize = getViewportSize();
  const displayWidth = viewportSize[0];
  const displayHeight = viewportSize[1];
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    // eslint-disable-next-line no-param-reassign
    canvas.width = displayWidth;
    // eslint-disable-next-line no-param-reassign
    canvas.height = displayHeight;
    // console.log('re screen size : ' + canvas.width + ', ' + canvas.height);
    onResize(displayWidth, displayHeight);
    return true;
  }
  return false;
}

function onFilesEnter(files, p) {
  const self = app;
  const pos = p;
  const nls = [[undefined], pos];
  self.triggerEvent('PosToNode', nls);
  const [[node]] = nls;

  for (let i = 0, max = files.length; i < max; i += 1) {
    const f = files[i];
    if (f) {
      const filelower = f.name.toLowerCase();
      const filenamelist = f.name.split('.');
      const ext = filenamelist[filenamelist.length - 1].toLowerCase();
      if (ext === 'png' || ext === 'jpg') {
        const reader = new FileReader();
        reader.addEventListener('load', function loadtexture() {
          const tex = new Texture2D();
          const url = this.result;
          let uniforName = 'uAlbedo';
          if (filelower.includes('normal')) {
            uniforName = 'uNormal';
          } else if (filelower.includes('spec')) {
            uniforName = 'uSpecular';
          } else if (filelower.includes('gloss')) {
            uniforName = 'uGloss';
          } else if (filelower.includes('translucency')) {
            uniforName = 'uTranslucency';
          } else if (filelower.includes('env')) {
            uniforName = 'uEnvir';
          }
          tex.loadFromUrl(url, () => {
            if (node.renderable.material.setUniformData(uniforName, tex, true)) {
              // console.log(`set ${uniforName} for ${f.name}`);
              // console.log(node);
              // console.log(tex);
              // console.log(node.renderable.material);
            }
          });
        }, false);
        reader.readAsDataURL(f);
      } else {
        node.name = f.name;
        if (ext === 'obj') {
          const reader = new FileReader();
          reader.onloadend = (function onloadend(r) {
            return () => {
              self.loadObj(r.result, node);
            };
          }(reader));
          reader.readAsText(f);
        } else if (ext === 'fbx') {
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            self.loadFBX(reader.result, undefined, node);
          }, false);
          reader.readAsDataURL(f);
        } else if (ext === 'hair') {
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            self.loadHair(reader.result, undefined, node);
          }, false);
          reader.readAsDataURL(f);
        }
      }
    }
  }
}

export default class Application {
  constructor() {
    this.container = document.getElementById('container');
    this.canvas = document.querySelector('#glcanvas');

    if (!this.canvas) {
      // eslint-disable-next-line no-alert
      alert('Unhandle Exception!');
      return;
    }

    if (!initGL(this.canvas)) {
      return;
    }

    screenSize[0] = gl.canvas.clientWidth;
    screenSize[1] = gl.canvas.clientHeight;

    // input
    input.onFilesEnter = onFilesEnter;

    // camera
    this.camera = new Camera(gl.canvas.clientWidth, gl.canvas.clientHeight);

    this.camera.transform.position = [0.0, 0.0, 0.0];
    this.camera.clearColor = true;
    this.camera.clearDepth = false;
    // this.camera.backgroundColor = [0.014, 0.014, 0.014];

    // camera
    this.camera2D = new Camera(gl.canvas.clientWidth, gl.canvas.clientHeight);
    this.camera2D.ui = true;
    this.camera2D.transform.position = [0.0, 0.0, 0.0];

    this.events = {};

    this.node = new GameNode(new Mesh(
      'default',
      cubeText,
    ), 'main_node', true);
    this.node.transform.scale = [0.1, 0.1, 0.1];
    this.nodeCount = 1;

    this.nodes = [this.node];

    this.nodeGroup = GameNode.getGroup();

    this.onLoadMesh = [];

    this.mainLight = new Light();
    this.mainLight.transform.euler = [-15.0, -30.0, 0.0];
    this.mainLight.transform.position = vec3.scale(
      vec3.create(), this.mainLight.transform.forward, 3.0,
    );
    // this.mainLight.transform.position = [0.5292444229125977, -0.0104089947, -0.848405599594];
    // console.log(this.mainLight.transform);
    this.mainLight.color = [3.3609302043914795, 3.33353328704834, 3.3016586303710938];
    this.mainLight.color = vec3.scale(this.mainLight.color, this.mainLight.color, 0.3333);
    // this.mainLight.color = [0.0, 0.0, 0.0];
    // this.mainLight.debugRenderTexture();

    const light2 = new Light();
    light2.transform.euler = [13.0, 157.0, 0.0];
    light2.transform.position = [0.2924443483352661, 0.3231116235256195, 0.9000418782234192];
    light2.transform.position = vec3.scale(vec3.create(), light2.transform.position, 30.0);
    light2.color = [0.2, 0.3, 0.4];
    // light2.debugRenderTexture();

    // const a = new GameNode(new Sprite('resources/i_src.png'), `debug_shadowmap_${this.index}`);
    // a.renderable.rect = new Rect(0, 300, 300, 300);

    this.addEvent('PosToNode', this.PosToNode, this);

    for (let i = 0; i < onStarts.length; i += 1) {
      this.node.addComponent(new onStarts[i](this));
    }

    this.triggerEvent('OnLoadMesh', [[this.node]]);
  }

  update(dt) {
    // setFrameDirty();
    // const e = this.mainLight.transform.euler;
    // e[1] += dt * 30.0;
    // this.mainLight.transform.euler = e;
    // this.mainLight.transform.position = vec3.scale(
    //   vec3.create(), this.mainLight.transform.forward, 3.0,
    // );
    for (let c = this.nodeGroup.length - 1; c >= 0; c -= 1) {
      if (this.nodeGroup[c]) this.nodeGroup[c].update(dt);
    }

    if (resizeToMatchDisplaySize(gl.canvas)) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      setFrameDirty();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  render() {
    const group = GameNode.getRenderingGroup();
    const uigroup = GameNode.getRenderingGroupUI();

    allLights.forEach((light) => {
      light.render(group);
    });

    Light.Update();

    gl.viewport(0, 0, screenSize[0], screenSize[1]);
    allCameras.forEach((cam, i) => {
      if (!cam.ui) {
        cam.render(group, i === 0, Light);
      }
    });
    allCameras.forEach((cam) => {
      if (cam.ui) {
        cam.render2D(uigroup, false, Light);
      }
    });

    const err = gl.getError();
    if (err !== gl.NO_ERROR) {
      // eslint-disable-next-line no-console
      console.error(`error code : ${err}`);
    }
  }

  loadObj(contents, inputNode) {
    const nodeTar = inputNode;
    const meshData = ObjLoader(contents);
    // console.log(meshData);
    const min = meshData.aabb[0];
    const max = meshData.aabb[1];
    const diff = vec3.distance(min, max);
    const allNodes = [nodeTar];
    let scale = 1.0;
    if (diff > 100.0) {
      scale = 5.0 / diff;
    }

    const objs = Object.keys(meshData.meshDict);
    let size = objs.length;
    size = size || 1;
    let name = objs.length === 0 ? undefined : objs[0];
    // console.log(name);
    nodeTar.renderable.LoadMesh(meshData, name);
    nodeTar.transform.scale = [scale, scale, scale];
    nodeTar.transform.position = [0.0, 0.0, 0.0];
    nodeTar.transform.euler = [0, 0, 0];
    // console.log(`find ${size} objects`);

    for (let i = 1; i < size; i += 1) {
      name = objs[i];
      // console.log(name);
      const node = this.GetNextNode();
      // console.log(node);
      node.name = `mesh_${name}`;
      node.renderable.LoadMesh(meshData, name);
      node.transform.scale = [scale, scale, scale];
      node.transform.position = [0.0, 0.0, 0.0];
      node.transform.euler = [0, 0, 0];
      allNodes.push(node);
    }
    // console.log(this.nodes);
    // this.node.renderable.LoadObj(contents);
    this.triggerEvent('OnLoadMesh', [allNodes]);
  }

  addEvent(event, func, obj = undefined) {
    if (!(event in this.events)) {
      this.events[event] = [];
    }
    this.events[event].push({ func, obj });
  }

  triggerEvent(event, data) {
    if (event in this.events) {
      const dataArr = Array.isArray(data) ? data : [data];
      const ls = this.events[event];
      // console.log(dataArr);
      for (let i = ls.length - 1; i >= 0; i -= 1) {
        const { func, obj } = ls[i];
        func.apply(obj, dataArr);
      }
      setFrameDirty();
    }
  }

  loadMesh(url, token, callback, onfailed, createNewNode = false) {
    const self = this;
    ReadFile.read(url, (contents) => {
      if (contents) {
        let { node } = self;
        if (createNewNode) node = self.GetNextNode();
        self.loadObj(contents, node);
        if (callback) callback();
      } else if (onfailed) onfailed();
    }, undefined, token);
  }

  loadHair(url, token, inputNode) {
    const self = this;
    let nodeTar = inputNode;
    if (nodeTar === undefined) nodeTar = self.node;
    ReadFile.readBinary(url, (contents) => {
      nodeTar.renderable.LoadHair(contents);
      self.triggerEvent('OnLoadMesh', [[nodeTar]]);
    }, undefined, token);
  }

  loadBlendShape(url, token) {
    const self = this;
    ReadFile.readBinary(url, (contents) => {
      self.loadBlendShapeContents(contents);
    }, undefined, token);
  }

  loadFBX(url, token, inputNode) {
    const self = this;
    let nodeTar = inputNode;
    if (nodeTar === undefined) nodeTar = self.node;
    const allNodes = [nodeTar];
    fbxloader.fbxloader.load(url, (fbxTree) => {
      const meshes = [];
      fbxTree.forEach((value) => {
        if (value.morphTargets !== undefined) {
          meshes.push(value);
        }
      });
      // console.log(meshes);

      if (meshes.length > 0) {
        nodeTar.renderable.LoadFBX(meshes[0], fbxTree);
        const t = meshes[0].transform;
        if (('name' in t) && t.name) nodeTar.name = t.name;
        if ('euler' in t) nodeTar.transform.euler = t.euler;
        if ('scale' in t) nodeTar.transform.scale = t.scale;
        if ('position' in t) nodeTar.transform.position = t.position;
      }
      if (meshes.length > 1) {
        for (let i = 1; i < meshes.length; i += 1) {
          const node = self.GetNextNode();
          node.renderable.LoadFBX(meshes[i], fbxTree);
          const t = meshes[i].transform;
          if (('name' in t) && t.name) node.name = t.name;
          if ('euler' in t) node.transform.euler = t.euler;
          if ('scale' in t) node.transform.scale = t.scale;
          if ('position' in t) node.transform.position = t.position;
          allNodes.push(node);
        }
      }
      self.triggerEvent('OnLoadMesh', [allNodes]);
    }, token);
  }

  loadTexture(url, token = undefined, toNodes = undefined) {
    const self = this;
    const tex = new Texture2D();
    const filelower = url.toLowerCase();
    let uniforName = 'uAlbedo';
    let nodes = toNodes;
    if (!nodes) nodes = self.nodes;
    if (filelower.includes('normal')) {
      uniforName = 'uNormal';
    } else if (filelower.includes('spec')) {
      uniforName = 'uSpecular';
    } else if (filelower.includes('gloss')) {
      uniforName = 'uGloss';
    } else if (filelower.includes('translucency')) {
      uniforName = 'uTranslucency';
    } else if (filelower.includes('env')) {
      uniforName = 'uEnvir';
    }
    tex.loadFromUrl(url, () => {
      // console.log(`loadTexture: ${url}`);
      nodes.forEach((n) => {
        n.renderable.material.setUniformData(uniforName, tex, true);
      });
    }, token);
  }

  PosToNode(...args) {
    const ls = args;
    if (ls[0][0] === undefined) {
      const node = this.nodes[0];
      ls[0][0] = node;
    }
    return ls[0][0];
  }

  GetNextNode() {
    if (this.nodes.length <= this.nodeCount) {
      const next = new GameNode(new Mesh('default', cubeText), `mesh_${this.nodeCount}`, true);
      this.nodes.push(next);
    }
    if (this.nodeCount < 0) this.nodeCount = 0;
    const node = this.nodes[this.nodeCount];
    this.nodeCount += 1;

    return node;
  }

  GetLastNode() {
    return this.nodes[this.nodes.length - 1];
  }
}

function frame(time) {
  const now = time * 0.001;
  timer.deltaTime = now - timer.time;
  const dt = timer.deltaTime;
  timer.time = now;

  timer.frame += 1;

  app.update(dt);
  if (getFrameDirty()) {
    app.render();
  }
  requestAnimationFrame(frame);
}

function loading() {
  // load shaders
  // resourceManager.add(
  // 'shaders/defaultvs.glsl', 'shaders/defaultfs.glsl',
  // 'shaders/spritevs.glsl', 'shaders/spritefs.glsl',
  // 'shaders/debugvs.glsl', 'shaders/debugfs.glsl',
  // 'shaders/errorvs.glsl', 'shaders/errorfs.glsl',
  // 'shaders/pointcloudvs.glsl', 'shaders/pointcloudfs.glsl',
  // 'shaders/modelvs.glsl', 'shaders/modelfs.glsl',
  // 'shaders/matcapvs.glsl', 'shaders/matcapfs.glsl'
  // );

  // load objs
  // resourceManager.add('objs/untitled.obj');
  // resourceManager.add('objs/male.obj');

  // resourceManager.add_zip('objs/blend_shapes.zip');
  // resourceManager.add_zip('objs/outputs.zip');

  resourceManager.load();

  if (!resourceManager.loadFinished) {
    requestAnimationFrame(loading);
  } else {
    app = new Application();
    requestAnimationFrame(frame);
    // logger.log(app);
  }
}

function main() {
  requestAnimationFrame(loading);
}

function addOnStart(component) {
  onStarts.push(component);
}

function insertOnStart(component) {
  onStarts.splice(0, 0, component);
}

export { main, addOnStart, insertOnStart };
