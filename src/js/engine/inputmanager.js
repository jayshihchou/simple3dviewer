// eslint-disable-next-line import/no-mutable-exports
let input;
let frameDirty = true;
const screenSize = [0, 0];
const realScreenSize = [0, 0];
const resizeListeners = [];
const { devicePixelRatio } = window;
const inverseDevicePixelRatio = 1.0 / devicePixelRatio;

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

function updateScreenSize(x, y) {
  screenSize[0] = x;
  screenSize[1] = y;
}

function clamp(v, min, max) {
  let val = v;
  if (val > max) val = max;
  if (val < min) val = min;
  return val;
}

function onMouseWheel(event) {
  setFrameDirty();
  const e = window.event || event; // old IE support
  input.wheelDelta = -clamp((e.wheelDelta || -e.detail), -1, 1);

  if (input.eventListeners.length > 0) {
    for (let i = input.eventListeners.length - 1; i >= 0; i -= 1) {
      if (input.eventListeners[i].OnMouseWheel !== undefined) {
        input.eventListeners[i].OnMouseWheel(input.wheelDelta);
      }
    }
  }
}

function onMouseDown(event) {
  setFrameDirty();
  const e = window.event || event; // old IE support
  if (e.touches !== undefined) {
    e.preventDefault();
  }
  input.mouseDown = true;
  if (e.touches !== undefined) {
    input.lastMouseX = e.touches[0].clientX * devicePixelRatio;
    input.lastMouseY = e.touches[0].clientY * devicePixelRatio;
  } else {
    input.lastMouseX = e.clientX;
    input.lastMouseY = e.clientY;
  }
  const touchEvent = {
    x: input.lastMouseX,
    y: screenSize[1] - input.lastMouseY,
    type: e.buttons,
  };

  if (input.eventListeners.length > 0) {
    for (let i = input.eventListeners.length - 1; i >= 0; i -= 1) {
      if (input.eventListeners[i].OnTouchStart !== undefined) {
        if (input.eventListeners[i].OnTouchStart(touchEvent)) {
          input.anyObjectTouched = true;
        }
      }
    }
  }

  return true;
}

function onMouseUp(e) {
  setFrameDirty();
  input.mouseDown = false;
  const touchEvent = {
    x: input.lastMouseX,
    y: screenSize[1] - input.lastMouseY,
    type: e.buttons,
  };

  if (input.eventListeners.length > 0) {
    for (let i = input.eventListeners.length - 1; i >= 0; i -= 1) {
      if (input.eventListeners[i].OnTouchEnd !== undefined) {
        input.eventListeners[i].OnTouchEnd(touchEvent);
      }
    }
  }
  input.anyObjectTouched = false;
  return true;
}

function onMouseMove(e) {
  if (!input.mouseDown) {
    input.checkHover(e);
    return false;
  }
  setFrameDirty();

  const newX = e.clientX;
  const newY = e.clientY;

  const deltaX = newX - input.lastMouseX;
  const deltaY = newY - input.lastMouseY;
  const touchEvent = {
    x: newX,
    y: screenSize[1] - newY,
    type: e.buttons,
    deltaX,
    deltaY,
  };

  if (input.eventListeners.length > 0) {
    for (let i = input.eventListeners.length - 1; i >= 0; i -= 1) {
      if (input.eventListeners[i].OnTouch !== undefined) {
        input.eventListeners[i].OnTouch(touchEvent);
      }
    }
  }

  input.lastMouseX = newX;
  input.lastMouseY = newY;
  return true;
}

function onMouseEnterEvent(e) {
  input.mouseDown = input.mouseDownOut !== 0 && input.mouseDownOut === e.buttons;
  input.anyObjectTouched = input.mouseDown && input.anyObjectTouchedOut;
  if (input.eventListeners.length > 0) {
    for (let i = input.eventListeners.length - 1; i >= 0; i -= 1) {
      if (input.eventListeners[i].OnMouseEnterWindow !== undefined) {
        input.eventListeners[i].OnMouseEnterWindow();
      }
    }
  }
}

function onMouseOutEvent(e) {
  input.mouseDownOut = e.buttons;
  input.anyObjectTouchedOut = input.anyObjectTouched;
  input.mouseDown = false;
  input.anyObjectTouched = false;

  if (input.onMouseOut !== undefined) input.onMouseOut();

  if (input.eventListeners.length > 0) {
    for (let i = input.eventListeners.length - 1; i >= 0; i -= 1) {
      if (input.eventListeners[i].OnMouseOutWindow !== undefined) {
        input.eventListeners[i].OnMouseOutWindow();
      }
    }
  }
}

function onTouchMove(e) {
  setFrameDirty();
  if (e.touches) {
    e.preventDefault();
  }
  if (!input.mouseDown) {
    input.checkHover(e);
    return false;
  }

  const newX = e.touches[0].clientX * devicePixelRatio;
  const newY = e.touches[0].clientY * devicePixelRatio;
  let deltaX = newX - input.lastMouseX;
  let deltaY = newY - input.lastMouseY;
  if (deltaX === undefined || Number.isNaN(deltaX)) deltaX = 0;
  if (deltaY === undefined || Number.isNaN(deltaY)) deltaY = 0;
  let touchEvent;
  if (e.touches.length > 1) {
    const touch2X = e.touches[1].clientX * devicePixelRatio;
    const touch2Y = e.touches[1].clientY * devicePixelRatio;
    touchEvent = {
      type: 1,
      x: newX,
      y: screenSize[1] - newY,
      deltaX,
      deltaY,
      x2: touch2X,
      y2: screenSize[1] - touch2Y,
    };
  } else {
    touchEvent = {
      type: 1,
      x: newX,
      y: screenSize[1] - newY,
      deltaX,
      deltaY,
    };
  }

  if (input.eventListeners.length > 0) {
    for (let i = input.eventListeners.length - 1; i >= 0; i -= 1) {
      if (input.eventListeners[i].OnTouch !== undefined) {
        input.eventListeners[i].OnTouch(touchEvent);
      }
    }
  }

  input.lastMouseX = newX;
  input.lastMouseY = newY;

  return true;
}

function onDragFile(e) {
  setFrameDirty();
  input.mouseDown = false;
  input.anyObjectTouched = false;
  e.preventDefault();
  e.stopPropagation();

  const dt = e.dataTransfer;
  const { files } = dt;

  if (files.length > 0) {
    if (input.onFilesEnter !== undefined) {
      input.onFilesEnter(files);
    }
  }
}

function preventDefaultEvents(e) {
  e.preventDefault();
  e.stopPropagation();
}

class InputManager {
  constructor() {
    this.container = document.getElementById('container');

    this.container.addEventListener('touchstart', onMouseDown, false);
    this.container.addEventListener('touchend', onMouseUp, false);
    this.container.addEventListener('touchcancel', onMouseUp, false);
    this.container.addEventListener('touchmove', onTouchMove, false);

    this.container.addEventListener('mouseenter', onMouseEnterEvent, false);
    this.container.addEventListener('mouseout', onMouseOutEvent, false);

    this.container.addEventListener('mousewheel', onMouseWheel, false); // others
    this.container.addEventListener('DOMMouseScroll', onMouseWheel, false); // firefox

    this.container.addEventListener('dragenter', preventDefaultEvents, false);
    this.container.addEventListener('dragover', preventDefaultEvents, false);
    this.container.addEventListener('dragleave', preventDefaultEvents, false);
    this.container.addEventListener('drop', onDragFile, false);

    this.container.addEventListener('dblclick', preventDefaultEvents, false);

    this.container.onmousedown = onMouseDown;
    this.container.onmouseup = onMouseUp;
    this.container.onmousemove = onMouseMove;

    this.wheelDelta = 0.0;

    this.mouseDown = false;
    this.mouseDownOut = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.onMouseOut = undefined;

    this.onFilesEnter = undefined;

    this.anyObjectTouched = false;
    this.anyObjectTouchedOut = false;
    this.eventListeners = [];
  }

  checkHover(e) {
    let newX;
    let newY;
    if (e.touches) {
      newX = e.touches[0].clientX * devicePixelRatio;
      newY = e.touches[0].clientY * devicePixelRatio;
    } else {
      newX = e.clientX;
      newY = e.clientY;
    }
    const touchEvent = {
      type: 1,
      x: newX,
      y: screenSize[1] - newY,
    };
    for (let i = this.eventListeners.length - 1; i >= 0; i -= 1) {
      if (input.eventListeners[i].OnMouse !== undefined) {
        input.eventListeners[i].OnMouse(touchEvent);
      }
    }
  }
}

input = new InputManager();

// export default { input };

export {
  input,
  clamp,
  updateScreenSize,
  setFrameDirty,
  getFrameDirty,
  screenSize,
  realScreenSize,
  resizeListeners,
  devicePixelRatio,
  inverseDevicePixelRatio,
};
