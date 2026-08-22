import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  벽 선반 — 퍼즐과 무관한 순수 배경 소품. 얇은 벽걸이라 solid 없음.
 * ------------------------------------------------------------------ */
export function makeShelf(id) {
  const shelf = new THREE.Group();
  if (id) shelf.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.7, 0.04, 0.24), 0x7a4a2a, shelf, [0, 0, 0.1]);
  makeMesh(new THREE.BoxGeometry(0.03, 0.15, 0.03), 0x5a3826, shelf, [-0.3, -0.08, 0.02]);
  makeMesh(new THREE.BoxGeometry(0.03, 0.15, 0.03), 0x5a3826, shelf, [0.3, -0.08, 0.02]);
  makeMesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), 0x9a6a45, shelf, [0.15, 0.07, 0.1]);

  return shelf;
}
