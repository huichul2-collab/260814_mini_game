import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  백지(공방 벽) — P3 단서. UV 랜턴/아크릴판과의 상호작용(글자 드러남,
 *  겹치기)은 배치 2(퍼즐 로직)의 몫이다. 여기서는 벽에 거는 판만 만든다.
 *  frame.js와 같은 패턴 — 얇은 벽걸이라 solid 없음.
 * ------------------------------------------------------------------ */
export function makeBlankPaper(id) {
  const blankPaper = new THREE.Group();
  if (id) blankPaper.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.6, 0.8, 0.03), 0x7a4a2a, blankPaper, [0, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.5, 0.7, 0.01), 0xf5f0e6, blankPaper, [0, 0, 0.02]);

  return blankPaper;
}
