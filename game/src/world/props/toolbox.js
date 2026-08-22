import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  공구 상자 — 퍼즐과 무관한 순수 배경 소품. 작아서 solid 없음.
 * ------------------------------------------------------------------ */
export function makeToolbox(id) {
  const toolbox = new THREE.Group();
  if (id) toolbox.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.45, 0.22, 0.28), 0xb5451f, toolbox, [0, 0.11, 0]);
  makeMesh(new THREE.BoxGeometry(0.47, 0.03, 0.3), 0x7a2f14, toolbox, [0, 0.225, 0]);
  makeMesh(new THREE.BoxGeometry(0.04, 0.08, 0.02), 0x333333, toolbox, [0, 0.28, 0]);

  return toolbox;
}
