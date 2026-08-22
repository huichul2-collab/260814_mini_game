import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  "알 수 없는 기계"(거실) — P5 무대. 홈 3개는 열쇠조각 3개가 들어갈
 *  자리를 시각적으로 표시만 한다. 실제 조립 판정은 배치 2(퍼즐 로직)
 *  소관.
 *
 *  M9-E(E-1, docs/spec/M9-escape.md §12.8): 이름이 "알 수 없는 기계"로
 *  바뀌면서(§12.2) 처음 보는 사람도 "구멍 세 개"만은 겉에서 바로
 *  알아봐야 한다 — 납작한 박스 슬롯 대신 원형 소켓(밝은 테두리 링 +
 *  어두운 구멍)으로 대비를 올렸다. machine.js의 톱니 홈과 같은 "원통을
 *  rotation.x=π/2로 눕혀 앞을 보게" 기법.
 * ------------------------------------------------------------------ */
export function makeAssembler(id) {
  const assembler = new THREE.Group();
  if (id) assembler.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.7, 0.9, 0.35), 0x5a5a5a, assembler, [0, 0.45, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.6, 0.15, 0.02), 0x3a3a3a, assembler, [0, 0.9, 0.18]);

  const slotOffsets = [-0.2, 0, 0.2];
  for (const sx of slotOffsets) {
    const rim = makeMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16), 0x8a8a8a, assembler, [sx, 0.5, 0.18]);
    rim.rotation.x = Math.PI / 2;
    const hole = makeMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 16), 0x0a0a0a, assembler, [sx, 0.5, 0.19]);
    hole.rotation.x = Math.PI / 2;
  }

  return assembler;
}
