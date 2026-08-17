import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeWardrobe(id) {
  const wardrobe = new THREE.Group();
  if (id) wardrobe.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.58, 1.85, 1.1), 0x6e4023, wardrobe, [0, 0.925, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), 0xe6c875, wardrobe, [-0.3, 0.95, -0.15]);
  makeMesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), 0xe6c875, wardrobe, [-0.3, 0.95, 0.15]);

  return wardrobe;
}
