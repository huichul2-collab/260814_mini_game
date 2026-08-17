import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeDoubleBed(id) {
  const bed = new THREE.Group();
  if (id) bed.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(1.5, 0.85, 0.1), 0x6e4023, bed, [0, 0.425, -0.95], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(1.4, 0.38, 1.9), 0x7a4a2a, bed, [0, 0.19, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(1.32, 0.22, 1.8), 0xf2ebe1, bed, [0, 0.49, 0.02]);
  makeMesh(new THREE.BoxGeometry(1.34, 0.05, 1.2), 0x5a8fd1, bed, [0, 0.61, 0.3]);
  makeMesh(new THREE.BoxGeometry(0.5, 0.1, 0.35), 0xffffff, bed, [-0.33, 0.65, -0.65]);
  makeMesh(new THREE.BoxGeometry(0.5, 0.1, 0.35), 0xffffff, bed, [0.33, 0.65, -0.65]);

  return bed;
}

export function makeSingleBed(id) {
  const bed = new THREE.Group();
  if (id) bed.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(1.05, 0.8, 0.1), 0x5a3826, bed, [0, 0.4, -0.95], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(1.0, 0.36, 1.9), 0x6e4023, bed, [0, 0.18, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.94, 0.2, 1.8), 0xffffff, bed, [0, 0.46, 0.02]);
  makeMesh(new THREE.BoxGeometry(0.96, 0.05, 1.1), 0xd1553f, bed, [0, 0.585, 0.35]);
  makeMesh(new THREE.BoxGeometry(0.48, 0.09, 0.32), 0x5a8fd1, bed, [0, 0.605, -0.65]);

  return bed;
}
