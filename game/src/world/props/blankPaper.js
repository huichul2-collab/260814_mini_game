import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  백지(공방 벽) — P3 단서. UV 랜턴/아크릴판과의 상호작용(글자 드러남,
 *  겹치기)은 배치 2(퍼즐 로직)의 몫이다. 여기서는 벽에 거는 판만 만든다.
 *
 *  M9-C 배치1 보완: 창문(어두운 사각, y중심 1.4)과 같은 높이·색 톤이라
 *  "창문 3개"로 보이는 문제가 있었다 — 창문보다 낮은 y(furniture.js에서
 *  1.15로 배치)와 눈에 띄는 두꺼운 나무 액자 테두리로 구분한다.
 * ------------------------------------------------------------------ */
export function makeBlankPaper(id) {
  const blankPaper = new THREE.Group();
  if (id) blankPaper.userData[TAG.INTERACTIVE] = id;

  // 두꺼운(0.07) 어두운 액자 테두리 — 창문과 헷갈리지 않게 확실히 다른 실루엣
  makeMesh(new THREE.BoxGeometry(0.66, 0.86, 0.05), 0x3d2818, blankPaper, [0, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.52, 0.72, 0.015), 0xfaf6ec, blankPaper, [0, 0, 0.03]);

  return blankPaper;
}
