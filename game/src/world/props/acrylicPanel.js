import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  아크릴판(공방 벽) — P3 단서. 반투명 판 + 구멍은 텍스처 없이 작은
 *  박스 배열로 표현한다(docs/spec/M9-escape.md §7). "겹치기" 동작 자체는
 *  3D가 아니라 2D 팝업에서 처리하므로(§6.1) 여기서는 정적 조형만 만든다.
 * ------------------------------------------------------------------ */
export function makeAcrylicPanel(id) {
  const acrylicPanel = new THREE.Group();
  if (id) acrylicPanel.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.6, 0.8, 0.02), 0x5a3826, acrylicPanel, [0, 0, -0.015]);
  makeMesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.01),
    0xdfeaf5,
    acrylicPanel,
    [0, 0, 0.005],
    { transparent: true, opacity: 0.35 },
  );

  const dotOffsets = [
    [-0.15, 0.2],
    [0.1, 0.15],
    [-0.05, -0.1],
    [0.18, -0.18],
    [-0.18, -0.22],
  ];
  for (const [dx, dy] of dotOffsets) {
    makeMesh(new THREE.BoxGeometry(0.03, 0.03, 0.015), 0x2e2a3a, acrylicPanel, [dx, dy, 0.02]);
  }

  return acrylicPanel;
}
