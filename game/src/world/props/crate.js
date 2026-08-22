import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  나무 상자 — 퍼즐과 무관한 순수 배경 소품. 작아서 solid 없음.
 * ------------------------------------------------------------------ */
export function makeCrate(id) {
  const crate = new THREE.Group();
  if (id) crate.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), 0x8a5a3c, crate, [0, 0.2, 0]);
  makeMesh(new THREE.BoxGeometry(0.42, 0.04, 0.04), 0x5a3826, crate, [0, 0.2, 0.21]);
  makeMesh(new THREE.BoxGeometry(0.04, 0.42, 0.04), 0x5a3826, crate, [0, 0.2, 0.21]);

  return crate;
}

// 쌓아둔 상자 2개 — 배경 하나로 뭉쳐서 furniture.js에 한 줄만 차지한다.
export function makeCrateStack(id) {
  const stack = new THREE.Group();
  if (id) stack.userData[TAG.INTERACTIVE] = id;

  const bottom = makeCrate(null);
  stack.add(bottom);

  const top = makeCrate(null);
  top.position.set(0.05, 0.4, -0.04);
  top.rotation.y = 0.3;
  stack.add(top);

  return stack;
}
