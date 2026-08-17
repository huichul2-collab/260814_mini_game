import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeBookshelf(id) {
  const bookshelf = new THREE.Group();
  if (id) bookshelf.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.28, 1.3, 0.05), 0x7a4a2a, bookshelf, [0, 0.65, -0.375]);
  makeMesh(new THREE.BoxGeometry(0.28, 1.3, 0.05), 0x7a4a2a, bookshelf, [0, 0.65, 0.375]);
  makeMesh(new THREE.BoxGeometry(0.28, 0.05, 0.8), 0x7a4a2a, bookshelf, [0, 1.3, 0]);
  makeMesh(new THREE.BoxGeometry(0.28, 0.05, 0.8), 0x8a5a3c, bookshelf, [0, 0, 0], {}, { solid: true });

  for (const sy of [0.45, 0.9]) {
    makeMesh(new THREE.BoxGeometry(0.26, 0.04, 0.76), 0x8a5a3c, bookshelf, [0, sy, 0]);
  }

  const bookColors = [0xd1553f, 0x5a8fd1, 0xe0b23f, 0x6fae5e, 0xb15fd1];
  let bookZ = -0.3;
  for (let i = 0; i < 5; i++) {
    const h = 0.22 + (i % 3) * 0.05;
    const w = 0.045;
    makeMesh(new THREE.BoxGeometry(w, h, 0.16), bookColors[i], bookshelf, [0.1, 0.02 + h / 2, bookZ]);
    bookZ += 0.16;
  }

  return bookshelf;
}

export function makeLargeBookshelf(id) {
  const bookshelf = new THREE.Group();
  if (id) bookshelf.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.38, 1.85, 1.1), 0x7a4a2a, bookshelf, [0, 0.925, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.36, 1.75, 1.02), 0x5a3826, bookshelf, [-0.02, 0.925, 0]);

  const bookColors = [0xd1553f, 0x5a8fd1, 0x5f9e52, 0xe0b23f, 0xb15fd1];
  for (let s = 0; s < 3; s++) {
    const sy = 0.45 + s * 0.45;
    let bz = -0.4;
    for (let i = 0; i < 5; i++) {
      const bh = 0.2 + (i % 3) * 0.04;
      makeMesh(new THREE.BoxGeometry(0.24, bh, 0.05), bookColors[(i + s) % bookColors.length], bookshelf, [-0.02, sy + bh / 2, bz]);
      bz += 0.16;
    }
  }

  return bookshelf;
}
