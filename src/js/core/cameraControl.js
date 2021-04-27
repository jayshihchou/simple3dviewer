import { input } from '../engine/inputmanager.js';
import { setFrameDirty, clamp } from '../engine/utils.js';
import { vec3 } from '../lib/gl-matrix/index.js';
import { isMobile } from '../engine/logger.js';
import { Rect } from '../engine/UI/rect.js';
import { Button } from '../engine/UI/button.js';
import { DebugDraw } from '../engine/debugDraw.js';
import { timer } from '../engine/timer.js';
import { addOnStart } from './app.js';

export default class CameraControl {
  constructor(app) {
    this.lastTouchDistSqr = undefined;
    this.distance_to_object = 9.0;
    this.target_dist = 10.0;

    this.node = app.node;
    this.camera = app.camera;

    input.eventListeners.push(this);

    this.scale_min = 0.4;
    this.scale_max = 20.0;
    this.scale_speed = 1.0;
    this.scale_update_speed = 200.0;
    this.move_speed = 0.1;

    this.setScale();
    this.distance_to_object = this.target_dist - 0.01;
    this.look_at_target = vec3.create();
    this.look_at_target_offset = vec3.create();

    if (!isMobile) {
      const rect = new Rect(0, 0, 0, 0);
      rect.setRelative(0.0, 0.9, 0.2, 0.05);
      this.button1 = new Button(rect);
      this.button1.setText('Reset Camera');
      this.button1.setTextColor([1.0, 0.0, 0.0, 1.0]);
      this.button1.notify.push(this);
      this.button1.enabled = false;
    }
    app.addOnLoadMesh(this.setScale, this);
  }

  OnClick(button) {
    if (this.button1 === button) {
      setFrameDirty();
      this.look_at_target_offset = vec3.create();
      this.distance_to_object = this.target_dist;
      const pos = vec3.scale(vec3.create(), this.camera.transform.forward, this.distance_to_object);
      vec3.add(pos, pos, this.look_at_target);
      vec3.add(this.camera.transform.position, pos, this.look_at_target_offset);
      this.button1.enabled = false;
    }
  }

  OnTouchStart(e) {
    setFrameDirty();
    this.lastTouchDistSqr = undefined;

    if (e.type === 4) {
      // wheel button
      DebugDraw.get()?.addLine([0.0, 0.0, 0.0], [2.0, 0.0, 0.0], [1.0, 0.0, 0.0, 1.0]);
      DebugDraw.get()?.addLine([0.0, 0.0, 0.0], [0.0, 2.0, 0.0], [0.0, 1.0, 0.0, 1.0]);
      DebugDraw.get()?.addLine([0.0, 0.0, 0.0], [0.0, 0.0, 2.0], [0.0, 0.0, 1.0, 1.0]);
    }

    return false;
  }

  // eslint-disable-next-line class-methods-use-this
  OnTouchEnd() {
    DebugDraw.get()?.clear();
  }

  update(dt) {
    if (this.distance_to_object !== this.target_dist) {
      setFrameDirty();
      const dir = Math.sign(this.target_dist - this.distance_to_object);
      this.distance_to_object += dir * dt * this.scale_update_speed;
      const newDir = Math.sign(this.target_dist - this.distance_to_object);
      if (dir !== newDir) this.distance_to_object = this.target_dist;
      const pos = vec3.scale(vec3.create(), this.camera.transform.forward, this.distance_to_object);
      vec3.add(pos, pos, this.look_at_target);
      vec3.add(this.camera.transform.position, pos, this.look_at_target_offset);
    }
  }

  OnMouseWheel(d) {
    setFrameDirty();
    let delta = d;
    if (delta === undefined || Number.isNaN(delta)) delta = 0;
    else delta = clamp(delta, -1.0, 1.0);

    delta *= this.scale_speed;
    this.target_dist = clamp(this.target_dist - delta, this.scale_min, this.scale_max);
  }

  OnTouch(e) {
    setFrameDirty();
    if (input.anyObjectTouched) return;

    if (e.x2 !== undefined && e.y2 !== undefined) {
      // two finger
      let dx = e.x - e.x2;
      let dy = e.y - e.y2;
      if (dx === undefined || Number.isNaN(dx)) dx = 0;
      if (dy === undefined || Number.isNaN(dy)) dy = 0;
      const distSqr = dx * dx + dy * dy;
      if (this.lastTouchDistSqr !== undefined) {
        this.OnMouseWheel((this.lastTouchDistSqr - distSqr) * timer.deltaTime * 0.0001);
      }
      this.lastTouchDistSqr = distSqr;
      return;
    }

    const { deltaX, deltaY } = e;
    if (e.type === 4) {
      // wheel button
      const target = this.look_at_target_offset;
      target[1] += deltaY * this.move_speed;
      const right = vec3.create();
      vec3.scale(right, this.camera.transform.right, -deltaX * this.move_speed);
      vec3.add(target, target, right);
      this.look_at_target_offset = target;
      this.button1.enabled = true;
    } else {
      // left / right button
      const qEuler = this.camera.transform.euler;

      qEuler[0] = clamp(qEuler[0] - (deltaY * 0.2), -90.0, 90.0);
      qEuler[1] -= deltaX * 0.2;

      this.camera.transform.euler = qEuler;
    }
    const pos = vec3.scale(vec3.create(), this.camera.transform.forward, this.distance_to_object);
    vec3.add(pos, pos, this.look_at_target);
    vec3.add(this.camera.transform.position, pos, this.look_at_target_offset);
  }

  setScale() {
    setFrameDirty();
    if (!this.node) return;
    // console.log(this.node.renderable.aabb);
    const min = this.node.renderable.aabb[0];
    const max = this.node.renderable.aabb[1];
    // console.log(this.node.transform);
    vec3.add(min, min, this.node.transform.position);
    vec3.add(max, max, this.node.transform.position);
    vec3.multiply(min, min, this.node.transform.scale);
    vec3.multiply(max, max, this.node.transform.scale);

    this.look_at_target = vec3.set(
      vec3.create(),
      (min[0] + max[0]) * 0.5,
      (min[1] + max[1]) * 0.5,
      (min[2] + max[2]) * 0.5,
    );

    // console.log(`min: ${min}, max: ${max}, look_at: ${this.look_at_target}`);
    const dist = vec3.distance(min, max);
    // console.log(`dist: ${dist}`);
    this.scale_min = 0.2 * dist;
    this.scale_max = 2 * dist;
    this.scale_speed = clamp(dist * 0.1, 0.000001, 1000000.0);
    this.scale_update_speed = this.scale_speed * 20.0;
    // console.log(this.scale_update_speed);
    this.target_dist = dist;
    this.move_speed = dist * 0.001;
    this.distance_to_object = this.target_dist - 0.01;
    if (this.camera.zFar < dist) {
      this.camera.zFar = dist * 2.0;
      // console.log(`zFar: ${this.camera.zFar}`);
      this.camera.updateProjectionMatrix();
    }
  }
}

addOnStart(CameraControl);

export { CameraControl };
