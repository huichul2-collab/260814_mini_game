import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makePlant(id) {
  const plant = new THREE.Group();
  if (id) plant.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 12), 0xc9683f, plant, [0, 0.11, 0], {}, { solid: true });
  makeMesh(new THREE.IcosahedronGeometry(0.22, 0), 0x5f9e52, plant, [0, 0.42, 0]);
  makeMesh(new THREE.IcosahedronGeometry(0.15, 0), 0x74b463, plant, [0.12, 0.58, 0.05]);

  return plant;
}

export function makeLargePlant(id) {
  const plant = new THREE.Group();
  if (id) plant.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 12), 0xc9683f, plant, [0, 0.13, 0], {}, { solid: true });
  makeMesh(new THREE.IcosahedronGeometry(0.24, 0), 0x5f9e52, plant, [0, 0.44, 0]);
  makeMesh(new THREE.IcosahedronGeometry(0.17, 0), 0x74b463, plant, [-0.08, 0.58, 0.05]);

  return plant;
}
