let frameDirty = true;

const screenSize = [0, 0];
const realScreenSize = [0, 0];
const resizeListeners = [];
const { devicePixelRatio } = window;
const inverseDevicePixelRatio = 1.0 / devicePixelRatio;

function updateScreenSize(x, y) {
  screenSize[0] = x;
  screenSize[1] = y;
}

function setFrameDirty() {
  frameDirty = true;
}

function getFrameDirty() {
  const isDirty = frameDirty;
  if (isDirty) {
    frameDirty = false;
  }
  return isDirty;
}

function clamp(v, min, max) {
  let val = v;
  if (val > max) val = max;
  if (val < min) val = min;
  return val;
}

export {
  setFrameDirty,
  getFrameDirty,
  clamp,
  updateScreenSize,
  screenSize,
  realScreenSize,
  resizeListeners,
  devicePixelRatio,
  inverseDevicePixelRatio,
};
