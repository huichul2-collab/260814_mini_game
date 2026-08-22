import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';
import { BOOKSHELF_BOOK_COUNTS } from '../../../story.js';

export function makeBookshelf(id) {
  const bookshelf = new THREE.Group();
  if (id) bookshelf.userData[TAG.INTERACTIVE] = id;

  // 4칸 책장 외곽 프레임 (3칸 → 4칸 변경, M9-escape §12.3)
  const totalH = 1.32;
  makeMesh(new THREE.BoxGeometry(0.28, totalH, 0.05), 0x7a4a2a, bookshelf, [0, totalH / 2, -0.375]);
  makeMesh(new THREE.BoxGeometry(0.28, totalH, 0.05), 0x7a4a2a, bookshelf, [0, totalH / 2, 0.375]);
  makeMesh(new THREE.BoxGeometry(0.28, 0.05, 0.8), 0x7a4a2a, bookshelf, [0, totalH, 0]);
  makeMesh(new THREE.BoxGeometry(0.28, 0.05, 0.8), 0x8a5a3c, bookshelf, [0, 0, 0], {}, { solid: true });

  // 4칸을 만드는 내부 선반 3개 (높이 0.32m, 0.64m, 0.96m)
  const shelfYList = [0.32, 0.64, 0.96];
  for (const sy of shelfYList) {
    makeMesh(new THREE.BoxGeometry(0.26, 0.04, 0.76), 0x8a5a3c, bookshelf, [0, sy, 0]);
  }

  // 칸별 바닥 높이 (위에서부터 0칸: 0.96m, 1칸: 0.64m, 2칸: 0.32m, 3칸: 0.00m)
  const tierBases = [0.96, 0.64, 0.32, 0.0];
  const counts = BOOKSHELF_BOOK_COUNTS || [0, 0, 3, 5];
  const bookColors = [0xd1553f, 0x5a8fd1, 0xe0b23f, 0x6fae5e, 0xb15fd1];

  for (let tier = 0; tier < 4; tier++) {
    const bookCount = counts[tier] || 0;
    if (bookCount <= 0) continue;

    const baseY = tierBases[tier];
    const spacing = 0.08;
    const startZ = -((bookCount - 1) * spacing) / 2;

    for (let i = 0; i < bookCount; i++) {
      const h = 0.20 + (i % 3) * 0.03;
      const w = 0.045;
      const bz = startZ + i * spacing;
      makeMesh(
        new THREE.BoxGeometry(w, h, 0.16),
        bookColors[(i + tier * 2) % bookColors.length],
        bookshelf,
        [0.08, baseY + 0.02 + h / 2, bz]
      );
    }
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
