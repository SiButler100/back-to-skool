// ============================================================================
// THE 3D VIEW (the school as a lit model: the entry point)
// ----------------------------------------------------------------------------
// Owns the 3D picture. The renderer hands it, every frame, the rectangle of
// the school to show and the list of people and things to stand in it, and it
// draws them into its own canvas, which the renderer then copies under the
// speech bubbles and the rest of the flat overlay.
//
//   camera.js   the shift lens: why a cell is still a cell
//   scene.js    the building, built once from the map
//   actors.js   everyone who moves, as cut-outs
//   parts.js    the rectangles it is all made of
//
// Light: one sun, in front of the school and above it, which swings from the
// left in the morning to the right by the end of the day and warms as it
// goes; and an even fill light so that nothing is ever lost in darkness.
// The room paintings are not lit (they were painted with their own light);
// the floors, stairs and walls are, and everybody casts a shadow.
// ============================================================================

import * as THREE from './three.js';
import { frameShiftLens, ACTION_Z } from './camera.js';
import { buildSchool } from './scene.js';
import { Actors } from './actors.js';

export class World3D {
  // Can this machine draw it at all? (If not, the flat illustrated view is used.)
  static supported() {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
  }

  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.setClearColor(0x9fd3ff);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();

    this.fill = new THREE.AmbientLight(0xffffff, 1.7);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.radius = 2.2;        // soft-edged shadows
    this.scene.add(this.fill, this.sun, this.sun.target);

    this.school = null;
    this.actors = new Actors(this.scene);
  }

  // Build the school (once the artwork has loaded, and again if the theme changes).
  build(assets, theme) {
    if (this.school) this.scene.remove(this.school.root);
    this.school = buildSchool(assets, theme);
    this.scene.add(this.school.root);
  }
  get ready() { return !!this.school; }

  // Draw one frame.
  //   view     { x0, y0, w, h }: the rectangle of the school to show, in cells
  //   size     [width, height] of the picture in pixels
  //   actors   the list for actors.js
  //   game     for the state of doors, cups and windows
  //   seconds  time, for the drifting clouds
  //   day      0..1 through the school day, for the sun
  render({ view, size, actors, game, seconds = 0, day = 0.35 }) {
    if (this.canvas.width !== size[0] || this.canvas.height !== size[1]) this.gl.setSize(size[0], size[1], false);
    const lens = frameShiftLens(this.camera, view);
    const cx = view.x0 + view.w / 2, cy = -(view.y0 + view.h / 2);
    this.school.setFixtures(game);
    this.school.update(lens, cx, seconds);
    this.actors.sync(actors);
    this.light(day, cx, cy, view);
    this.gl.render(this.scene, this.camera);
  }

  // The sun follows the view (its shadows are only worked out for what is on
  // screen) and moves across the sky through the day.
  light(day, cx, cy, view) {
    const swing = -0.5 + day;                                   // left of the school in the morning, right by home time
    // Mostly from the front, so that each shadow lands on the wall just behind
    // and below whoever casts it, like a card standing in front of a backdrop.
    const dir = new THREE.Vector3(swing * 0.7, 0.42, 0.9).normalize();
    this.sun.target.position.set(cx, cy, ACTION_Z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 90);
    const cam = this.sun.shadow.camera, halfW = view.w / 2 + 8, halfH = view.h / 2 + 8;
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH; cam.near = 10; cam.far = 200;
    cam.updateProjectionMatrix();
    // Cool and clear early, golden late.
    const warm = Math.max(0, day - 0.45) / 0.55;
    this.sun.color.setRGB(1, 0.98 - 0.16 * warm, 0.94 - 0.38 * warm);
    this.fill.color.setRGB(0.97 + 0.03 * warm, 0.98, 1 - 0.1 * warm);
  }

  dispose() { this.gl.dispose(); }
}
