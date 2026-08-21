import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeDiary(id) {
  const diary = new THREE.Group();
  if (id) diary.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), 0xf2ebe1, diary, [-0.11, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), 0xf2ebe1, diary, [0.11, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.46, 0.01, 0.17), 0x8a5a3c, diary, [0, -0.015, 0]);

  return diary;
}
