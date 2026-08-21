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
 * ------------------------------------------------------------------ */
export function makeMachine(id) {
  const machine = new THREE.Group();
  if (id) machine.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 16), 0x5a5a5a, machine, [0, 0.45, 0], {}, { solid: true });
  makeMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16), 0x3a3a3a, machine, [0, 0.925, 0]);
  // 톱니바퀴를 끼울 홈 — 오목해 보이게 어두운 색의 작은 원판을 얹는다
  makeMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), 0x1e1e1e, machine, [0, 0.955, 0]);

  const drawer = new THREE.Group();
  drawer.name = 'machineDrawer';
  machine.add(drawer);
  makeMesh(new THREE.BoxGeometry(0.3, 0.15, 0.06), 0x444444, drawer, [0, 0.15, 0.38], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.04, 0.03, 0.03), 0xe6c875, drawer, [0, 0.15, 0.41]);

  const keyPiece3 = makeKeyPiece(id ? `${id.split('.')[0]}.keyPiece3` : null);
  keyPiece3.name = 'keyPiece3';
  keyPiece3.position.set(0, 0.16, 0.3);
  drawer.add(keyPiece3);

  return machine;
}
