import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeNightstand(id) {
  const nightstand = new THREE.Group();
  if (id) nightstand.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.42, 0.45, 0.42), 0x7a4a2a, nightstand, [0, 0.225, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.08, 0.03, 0.03), 0xe6c875, nightstand, [0, 0.28, 0.22]);
  makeMesh(new THREE.CylinderGeometry(0.06, 0.08, 0.02, 12), 0x333333, nightstand, [0, 0.46, 0]);
  makeMesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8), 0x444444, nightstand, [0, 0.57, 0]);
  makeMesh(new THREE.ConeGeometry(0.08, 0.12, 12), 0xffd9a0, nightstand, [0, 0.7, 0]);

  return nightstand;
}

export function makeSmallNightstand(id) {
  const nightstand = new THREE.Group();
  if (id) nightstand.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), 0x8a5a3c, nightstand, [0, 0.21, 0], {}, { solid: true });
  makeMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), 0xe0b23f, nightstand, [0, 0.435, 0]);

  return nightstand;
}
