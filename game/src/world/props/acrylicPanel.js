import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  아크릴판(공방 벽) — P3 단서. 반투명 판 + 구멍은 텍스처 없이 작은
 *  박스 배열로 표현한다(docs/spec/M9-escape.md §7). "겹치기" 동작 자체는
 *  3D가 아니라 2D 팝업에서 처리하므로(§6.1) 여기서는 정적 조형만 만든다.
 *
 *  M9-C 배치1 보완: 옅은 청록 반투명 + 짙은 구멍으로 대비를 올려서
 *  백지·창문과 한눈에 구분되게 한다(백지와는 같은 크기대에서 서로
 *  "한 세트"로, 창문과는 색·재질로 뚜렷이 다르게).
 * ------------------------------------------------------------------ */
export function makeAcrylicPanel(id) {
  const acrylicPanel = new THREE.Group();
  if (id) acrylicPanel.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.66, 0.86, 0.04), 0x2c3436, acrylicPanel, [0, 0, -0.01]);
  makeMesh(
    new THREE.BoxGeometry(0.54, 0.74, 0.015),
    0x9fd8cf,
    acrylicPanel,
    [0, 0, 0.02],
    { transparent: true, opacity: 0.45 },
  );

  const dotOffsets = [
    [-0.16, 0.22],
    [0.12, 0.16],
    [-0.06, -0.1],
    [0.19, -0.2],
    [-0.2, -0.24],
  ];
  for (const [dx, dy] of dotOffsets) {
    makeMesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), 0x12181a, acrylicPanel, [dx, dy, 0.035]);
  }

  return acrylicPanel;
}
