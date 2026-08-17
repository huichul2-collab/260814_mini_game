import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeDresser(id) {
  const dresser = new THREE.Group();
  if (id) dresser.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.95, 0.85, 0.45), 0x8a5a3c, dresser, [0, 0.425, 0], {}, { solid: true });
  for (const dy of [0.22, 0.45, 0.68]) {
    makeMesh(new THREE.BoxGeometry(0.85, 0.02, 0.01), 0x5a3826, dresser, [0, dy, -0.226]);
    makeMesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), 0xe6c875, dresser, [0, dy, -0.235]);
  }
  makeMesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), 0x5f9e52, dresser, [0.25, 0.91, 0]);

  return dresser;
}
