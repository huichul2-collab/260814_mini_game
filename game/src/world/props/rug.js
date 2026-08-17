import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';

export function makeRug(id) {
  return makeMesh(new THREE.CylinderGeometry(1.1, 1.1, 0.02, 24), 0xd1553f, null, [0, 0, 0], {}, { interactive: id });
}

export function makeCushion(id) {
  return makeMesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 16), 0x5a8fd1, null, [0, 0, 0], {}, { interactive: id });
}

export function makeCircleRug(id) {
  return makeMesh(new THREE.CylinderGeometry(0.9, 0.9, 0.01, 24), 0xe8c89b, null, [0, 0, 0], {}, id ? { interactive: id } : {});
}

export function makeRectRug(id) {
  return makeMesh(new THREE.BoxGeometry(1.5, 0.01, 1.8), 0xd4a373, null, [0, 0, 0], {}, id ? { interactive: id } : {});
}

export function makeSquareRug(id) {
  return makeMesh(new THREE.BoxGeometry(1.3, 0.01, 1.3), 0x5a8fd1, null, [0, 0, 0], {}, id ? { interactive: id } : {});
}
