import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  열쇠 조립 머신(거실) — P5 무대. 홈 3개는 열쇠조각 3개가 들어갈
 *  자리를 시각적으로 표시만 한다(오목 박스). 실제 조립 판정은 배치 2
 *  (퍼즐 로직) 소관.
 * ------------------------------------------------------------------ */
export function makeAssembler(id) {
  const assembler = new THREE.Group();
  if (id) assembler.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.7, 0.9, 0.35), 0x5a5a5a, assembler, [0, 0.45, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.6, 0.15, 0.02), 0x3a3a3a, assembler, [0, 0.9, 0.18]);

  const slotOffsets = [-0.2, 0, 0.2];
  for (const sx of slotOffsets) {
    makeMesh(new THREE.BoxGeometry(0.12, 0.06, 0.03), 0x1e1e1e, assembler, [sx, 0.5, 0.18]);
  }

  return assembler;
}
