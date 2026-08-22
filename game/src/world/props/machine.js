import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';
import { makeKeyPiece } from './keyPiece.js';

/* ------------------------------------------------------------------ *
 *  기계 장치(보관소) — P4(톱니바퀴 조립) 무대. 숨은 서랍은 이 조형의
 *  자식으로 포함한다(docs/spec/M9-escape.md §7, §11.2 — "keyPiece3는
 *  서랍 안에 있으므로 별도 furniture.js 항목이 아니라 machine 조형의
 *  자식이다"). 서랍이 실제로 열리는 애니메이션/상태 전환은 배치 2
 *  (퍼즐 로직) 소관이라 여기서는 닫힌 정적 위치로만 둔다 — 나중에
 *  찾기 쉽도록 이름표(machineDrawer)만 남겨둔다.
 *
 *  M9-C 배치1 보완: "뚜껑 덮인 드럼통"으로 보이던 문제 — 위쪽 홈을
 *  치우고, 거실 쪽(Z-) 앞면에 톱니 홈 + 놋쇠색 십자 요철을 뒀다.
 *  서랍도 앞면 아래쪽으로 옮기고 놋쇠 손잡이를 붙였다. 몸통은 단색
 *  청회색 대신 금속 몸통(gunmetal) + 놋쇠(brass) 대비로 바꿨다.
 * ------------------------------------------------------------------ */
export function makeMachine(id) {
  const machine = new THREE.Group();
  if (id) machine.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 16), 0x4a4d52, machine, [0, 0.45, 0], {}, { solid: true });
  makeMesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 16), 0x3a3d40, machine, [0, 0.92, 0]);

  // 톱니바퀴 홈 — 앞면(거실 쪽, Z-)에 어두운 원반 + 놋쇠 십자 요철.
  const socket = makeMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), 0x1c1c1c, machine, [0, 0.55, -0.365]);
  socket.rotation.x = Math.PI / 2;
  makeMesh(new THREE.BoxGeometry(0.14, 0.025, 0.015), 0x9c7a2e, machine, [0, 0.55, -0.385]);
  makeMesh(new THREE.BoxGeometry(0.025, 0.14, 0.015), 0x9c7a2e, machine, [0, 0.55, -0.385]);

  // 숨은 서랍 — 앞면 아래쪽, 닫힌 상태. 손잡이는 놋쇠색.
  const drawer = new THREE.Group();
  drawer.name = 'machineDrawer';
  machine.add(drawer);
  makeMesh(new THREE.BoxGeometry(0.32, 0.16, 0.06), 0x35383c, drawer, [0, 0.16, -0.37], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.16, 0.025, 0.03), 0x9c7a2e, drawer, [0, 0.16, -0.41]);

  const keyPiece3 = makeKeyPiece(id ? `${id.split('.')[0]}.keyPiece3` : null);
  keyPiece3.name = 'keyPiece3';
  keyPiece3.position.set(0, 0.16, -0.25);
  drawer.add(keyPiece3);

  return machine;
}
