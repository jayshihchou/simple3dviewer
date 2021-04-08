import { vec3 } from '../lib/gl-matrix/index.js';
import JSZip from '../lib/jszip.min.js';
import fbxloader from '../lib/fbxloader.js';

import { gl, initGL } from '../engine/gl.js';
import { isMobile, logger } from '../engine/logger.js';
import { GameNode } from '../engine/gamenode.js';
import { Mesh } from '../engine/mesh.js';
import { Camera, allCameras } from '../engine/camera.js';
import { allLights, Light } from '../engine/light.js';
import {
  input, screenSize, resizeListeners, realScreenSize,
  setFrameDirty, getFrameDirty, updateScreenSize,
} from '../engine/inputmanager.js';
import { Texture2D } from '../engine/texture.js';
import { timer } from '../engine/timer.js';
import { ObjLoader } from '../engine/objLoader.js';
import { ReadFile } from '../engine/readFile.js';
import { resourceManager } from '../engine/resourcemanager.js';

let app = null;
const onloadDefault = [];
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
vn 0.000000 0.000000 1.000000
vn 0.000000 1.000000 0.000000
vn 0.000000 0.000000 -1.000000
vn 0.000000 -1.000000 0.000000
vn 1.000000 0.000000 0.000000
vn -1.000000 0.000000 0.000000
f 1/1/1 2/2/1 3/3/1
f 3/3/1 2/2/1 4/4/1
f 3/1/2 4/2/2 5/3/2
f 5/3/2 4/2/2 6/4/2
f 5/4/3 6/3/3 7/2/3
f 7/2/3 6/3/3 8/1/3
f 7/1/4 8/2/4 1/3/4
f 1/3/4 8/2/4 2/4/4
f 2/1/5 8/2/5 4/3/5
f 4/3/5 8/2/5 6/4/5
f 7/1/6 1/2/6 5/3/6
f 5/3/6 1/2/6 3/4/6`;
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

function onFilesEnter(files) {
  const self = app;
  for (let i = 0, max = files.length; i < max; i += 1) {
    const f = files[i];
    if (f) {
      const filenamelist = f.name.split('.');
      const ext = filenamelist[filenamelist.length - 1].toLowerCase();
      if (ext === 'obj') {
        const reader = new FileReader();
        reader.onloadend = (function onloadend(r) {
          return function afterload() {
            self.loadObj(r.result);
          };
        }(reader));
        reader.readAsText(f);
      } else if (ext === 'png' || ext === 'jpg') {
        const reader = new FileReader();
        reader.addEventListener('load', function loadtexture() {
          const tex = new Texture2D();
          const url = this.result;
          tex.loadFromUrl(url, () => {
            self.node.renderable.material.setUniformData('texture', tex);
          });
        }, false);
        reader.readAsDataURL(f);
      } else if (ext === 'blendshape' || ext === 'bin') {
        const reader = new FileReader();
        reader.addEventListener('load', function loadblendshape() {
          self.loadBlendShape(this.result);
        }, false);
        reader.readAsDataURL(f);
      } else if (ext === 'zip') {
        const reader = new FileReader();
        reader.addEventListener('load', function loadzip() {
          self.loadZip(this.result, undefined);
        }, false);
        reader.readAsDataURL(f);
      } else if (ext === 'fbx') {
        const reader = new FileReader();
        reader.addEventListener('load', function loadfbx() {
          self.loadFBX(this.result);
        }, false);
        reader.readAsDataURL(f);
      } else if (ext === 'hair') {
        const reader = new FileReader();
        reader.addEventListener('load', function loadfbx() {
          self.loadHair(this.result);
        }, false);
        reader.readAsDataURL(f);
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

    // camera
    this.camera2D = new Camera(gl.canvas.clientWidth, gl.canvas.clientHeight);
    this.camera2D.ui = true;
    this.camera2D.transform.position = [0.0, 0.0, 0.0];

    this.node = new GameNode(new Mesh(
      'default_orig',
      cubeText,
    ), 'main_mesh');

    this.other_nodes = [];

    this.nodeGroup = GameNode.getGroup();

    this.onLoadMesh = [];

    this.mainLight = new Light();
    this.mainLight.transform.euler = [-30.0, 135.0, 0.0];
    this.mainLight.transform.position = vec3.scale(
      vec3.create(), this.mainLight.transform.forward, 3.0,
    );
    this.mainLight.color = [0.4, 0.38, 0.28];
    // this.addOnLoadMesh(() => {
    //   const self = app;
    //   const min = self.node.renderable.aabb[0];
    //   const max = self.node.renderable.aabb[1];
    //   let center = vec3.add(vec3.create(), min, max);
    //   center = vec3.scale(center, center, 0.5);
    //   const dist = vec3.distance(min, max);
    //   // console.log(`${this.mainLight.camera.zNear} to ${this.mainLight.camera.zFar}`);
    //   self.mainLight.transform.position = vec3.scaleAndAdd(
    //     vec3.create(), center, self.mainLight.transform.forward, dist * 0.5,
    //   );
    // });
    // this.mainLight.debugRenderTexture();

    for (let i = 0; i < onStarts.length; i += 1) {
      this.node.addComponent(new onStarts[i](this));
    }

    for (let i = onloadDefault.length - 1; i >= 0; i -= 1) {
      onloadDefault[i]();
    }
  }

  update(dt) {
    for (let c = this.nodeGroup.length - 1; c >= 0; c -= 1) {
      if (this.nodeGroup[c]) this.nodeGroup[c].update(dt);
    }

    if (resizeToMatchDisplaySize(gl.canvas)) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      setFrameDirty();
    }
  }

  render() {
    for (let i = 0, max = allLights.length; i < max; i += 1) {
      allLights[i].render(this.nodeGroup);
    }
    Light.Update();
    gl.viewport(0, 0, screenSize[0], screenSize[1]);
    for (let i = 0, max = allCameras.length; i < max; i += 1) {
      allCameras[i].render(this.nodeGroup, i === 0, Light);
    }

    const err = gl.getError();
    if (err !== gl.NO_ERROR) {
      // eslint-disable-next-line no-console
      console.error(`error code : ${err}`);
    }
  }

  loadTexture(url, token) {
    const self = this;
    const tex = new Texture2D();
    tex.loadFromUrl(url, () => {
      self.node.renderable.material.setUniformData('texture', tex);
    }, token);
  }

  loadObj(contents) {
    const meshData = ObjLoader(contents);
    // console.log(meshData);
    const min = meshData.aabb[0];
    const max = meshData.aabb[1];
    const diff = vec3.distance(min, max);
    let scale = 1.0;
    if (diff > 100.0) {
      scale = 5.0 / diff;
    }

    const objs = Object.keys(meshData.meshDict);
    let size = objs.length;
    size = size || 1;
    let name = objs.length === 0 ? undefined : objs[0];
    // console.log(name);
    this.node.renderable.LoadMesh(meshData, name);
    this.node.transform.scale = [scale, scale, scale];
    this.node.transform.position = [0.0, 0.0, 0.0];
    this.node.transform.euler = [0, 0, 0];

    for (let i = this.other_nodes.length - 1; i >= 0; i -= 1) {
      for (let c = this.nodeGroup.length - 1; c >= 0; c -= 1) {
        if (this.nodeGroup[c] === this.other_nodes[i]) {
          this.nodeGroup.splice(c, 1);
        }
      }
    }
    this.other_nodes.splice(0, this.other_nodes.length);
    for (let i = 1; i < size; i += 1) {
      name = objs[i];
      // console.log(name);
      const node = new GameNode(new Mesh('default_orig', cubeText), `mesh_${name}`);
      node.renderable.LoadMesh(meshData, name);
      node.transform.scale = [scale, scale, scale];
      node.transform.position = [0.0, 0.0, 0.0];
      node.transform.euler = [0, 0, 0];
      this.other_nodes.push(node);
    }
    // console.log(this.other_nodes);
    // this.node.renderable.LoadObj(contents);
    this.triggerOnLoadMesh();
  }

  addOnLoadMesh(func, obj = undefined) {
    this.onLoadMesh.push({ func, obj });
  }

  triggerOnLoadMesh(mesh) {
    const meshArr = [mesh];
    for (let i = this.onLoadMesh.length - 1; i >= 0; i -= 1) {
      this.onLoadMesh[i].func.apply(this.onLoadMesh[i].obj, meshArr);
    }
    setFrameDirty();
  }

  loadMesh(url, token) {
    const self = this;
    ReadFile.read(url, (contents) => {
      self.loadObj(contents);
    }, undefined, token);
  }

  loadHair(url, token) {
    const self = this;
    ReadFile.readBinary(url, (contents) => {
      self.node.renderable.LoadHair(contents);
      self.triggerOnLoadMesh(self.node.renderable);
    }, undefined, token);
  }

  loadBlendShape(url, token) {
    const self = this;
    ReadFile.readBinary(url, (contents) => {
      self.loadBlendShapeContents(contents);
    }, undefined, token);
  }

  loadBlendShapeContents(contents) {
    this.node.renderable.LoadBlendShape(contents);
  }

  loadBlendShapeJson(json, tex) {
    this.node.renderable.LoadBlendShapeJson(json, tex);
  }

  loadZip(url, token) {
    const self = this;
    ReadFile.readBinary(url, (b) => {
      JSZip.loadAsync(b).then((contents) => {
        if (contents.file('blendshape.json') === null) {
          contents.file('blendshapes.bin').async('arraybuffer').then((content) => {
            resourceManager.addData('blendshapes.bin', content);
            self.loadBlendShapeFromResource();
          });
        } else {
          contents.file('blendshape.json').async('string').then((jsonContent) => {
            resourceManager.addData('blendshape.json', jsonContent);
            contents.file('blendshape.png').async('base64').then((content) => {
              const tex = new Texture2D();
              tex.loadFromUrl(`data:png;base64,${content}`, () => {
                resourceManager.addData('blendshape.png', tex);
                self.loadBlendShapeFromResource();
              });
            });
          });
        }
      });
    }, undefined, token);
  }

  loadBlendShapeFromResource() {
    // const self = this;
    if (isMobile) {
      const json = resourceManager.getFile('blendshape.json');
      const texture = resourceManager.getFile('blendshape.png');
      if (json !== null && texture !== null) {
        this.loadBlendShapeJson(json.data, texture.data);
      }
    } else {
      const content = resourceManager.getFile('blendshapes.bin');
      if (content !== null) {
        this.loadBlendShapeContents(content.data);
      }
    }
    this.triggerOnLoadMesh(this.node.renderable);
  }

  loadFBX(url, token) {
    const self = this;
    fbxloader.fbxloader.load(url, (fbxTree) => {
      const meshes = [];
      fbxTree.forEach((value) => {
        if (value.morphTargets !== undefined) {
          meshes.push(value);
        }
      });

      if (meshes.length > 0) {
        self.node.renderable.LoadFBX(meshes[0], fbxTree);
        const t = meshes[0].transform;
        if ('euler' in t) self.node.transform.euler = t.euler;
        if ('scale' in t) self.node.transform.scale = t.scale;
        if ('position' in t) self.node.transform.position = t.position;
      }
      if (meshes.length > 1) {
        for (let i = self.other_nodes.length - 1; i >= 0; i -= 1) {
          for (let c = self.nodeGroup.length - 1; c >= 0; c -= 1) {
            if (self.nodeGroup[c] === self.other_nodes[i]) {
              self.nodeGroup.splice(c, 1);
            }
          }
        }
        self.other_nodes.splice(0, self.other_nodes.length);
        for (let i = 1; i < meshes.length; i += 1) {
          const node = new GameNode(new Mesh('default', cubeText), `mesh_${i}`);
          node.renderable.LoadFBX(meshes[i], fbxTree);
          const t = meshes[i].transform;
          if ('euler' in t) node.transform.euler = t.euler;
          if ('scale' in t) node.transform.scale = t.scale;
          if ('position' in t) node.transform.position = t.position;
          self.other_nodes.push(node);
        }
      }
      self.triggerOnLoadMesh(self.node.renderable);
    }, token);
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
    // logger.oldLog(app);
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
