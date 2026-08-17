import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeChair(id) {
  const chair = new THREE.Group();
  if (id) chair.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), 0xd1553f, chair, [0, 0.42, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.42, 0.42, 0.05), 0xd1553f, chair, [0, 0.63, 0.19]);
  for (const [lx, lz] of [
    [0.17, -0.17],
    [-0.17, -0.17],
    [0.17, 0.17],
    [-0.17, 0.17],
  ]) {
    makeMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), 0x5a3826, chair, [lx, 0.21, lz]);
  }

  return chair;
}

export function makeOfficeChair(id) {
  const chair = new THREE.Group();
  if (id) chair.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.44, 0.06, 0.44), 0x3a5f8a, chair, [0, 0.45, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.44, 0.45, 0.05), 0x3a5f8a, chair, [0, 0.68, -0.2]);
  makeMesh(new THREE.CylinderGeometry(0.03, 0.22, 0.42, 8), 0x222222, chair, [0, 0.21, 0]);

  return chair;
}
