import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';
import { makeNewsClippings } from './newsClipping.js';

/* ------------------------------------------------------------------ *
 *  캐비닛(보관소) — 퍼즐과 무관한 순수 배경 소품. 서 있는 큰 가구라 solid.
 * ------------------------------------------------------------------ */
export function makeCabinet(id) {
  const cabinet = new THREE.Group();
  if (id) cabinet.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.55, 1.7, 0.5), 0x6e4023, cabinet, [0, 0.85, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), 0xe6c875, cabinet, [-0.2, 0.9, 0.26]);
  makeMesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), 0xe6c875, cabinet, [0.2, 0.9, 0.26]);

  return cabinet;
}

/* ------------------------------------------------------------------ *
 *  잠긴 캐비닛(서재, docs/spec/M9-escape.md §12.4) — 위 makeCabinet과는
 *  별개 조형이다: 짙은 금속색으로 위 배경용 목재 캐비닛과 구분하고,
 *  자물쇠 장치를 붙인다. 안의 신문 스크랩 3장(§12.7)은 newsClipping.js가
 *  만들어 이 그룹의 자식으로 붙되, 개봉 전에는 visible=false로 숨긴다 —
 *  실제 개봉(파이프렌치 보유 확인 + flag `cabinet_opened`)은
 *  interaction/probe.js가 처리하고, 여기서는 초기 숨김 상태와
 *  getObjectByName('newsClippings')로 찾을 수 있는 자식만 준비한다
 *  (machine.js의 machineDrawer와 같은 패턴).
 * ------------------------------------------------------------------ */
export function makeLockedCabinet(id) {
  const cabinet = new THREE.Group();
  if (id) cabinet.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.45, 1.6, 0.4), 0x3a3a42, cabinet, [0, 0.8, 0], {}, { solid: true });
  const door = makeMesh(new THREE.BoxGeometry(0.4, 1.5, 0.03), 0x2c2c33, cabinet, [0, 0.8, 0.2]);
  door.name = 'cabinetDoor';
  makeMesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), 0xc9c9d0, cabinet, [0.15, 0.8, 0.22]); // 자물쇠 손잡이

  const clippings = makeNewsClippings();
  clippings.name = 'newsClippings';
  clippings.visible = false; // 개봉 전에는 안 보인다(§12.4) — probe.js가 open 시 true로 바꾼다
  clippings.position.set(0, 0.8, 0.22);
  cabinet.add(clippings);

  return cabinet;
}
