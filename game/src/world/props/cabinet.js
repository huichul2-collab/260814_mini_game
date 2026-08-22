import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  캐비닛(보관소) — 퍼즐과 무관한 순수 배경 소품. 서 있는 큰 가구라 solid.
 * ------------------------------------------------------------------ */
export function makeCabinet(id) {
  const cabinet = new THREE.Group();
  if (id) cabinet.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.55, 1.7, 0.5), 0x6e4023, cabinet, [0, 0.85, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), 0xe6c875, cabinet, [-0.2, 0.9, 0.26]);
  makeMesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), 0xe6c875, cabinet, [0.2, 0.9, 0.26]);

  return cabinet;
}
