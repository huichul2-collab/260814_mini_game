import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeArmchair(id) {
  const lounge = new THREE.Group();
  if (id) lounge.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.75, 0.4, 0.7), 0x5f9e52, lounge, [0, 0.2, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.75, 0.45, 0.16), 0x5f9e52, lounge, [0, 0.525, 0.27]);

  return lounge;
}

export function makeTeaTable(id) {
  return makeMesh(new THREE.CylinderGeometry(0.24, 0.22, 0.45, 16), 0xc98a52, null, [0, 0, 0], {}, { solid: true, ...(id ? { interactive: id } : {}) });
}
