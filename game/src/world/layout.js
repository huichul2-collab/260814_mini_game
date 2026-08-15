/* ------------------------------------------------------------------ *
 *  M4 레이아웃 데이터 — 좌표의 단일 원본은 docs/spec/M4-layout.md다.
 *  이 파일은 그 문서 §1~§4 표를 그대로 옮긴 것뿐이고 로직이 없다.
 *  여기 없는 숫자를 house.js나 다른 곳에서 새로 만들지 않는다.
 *  숫자를 고쳐야 하면 스펙 문서를 먼저 고치고 이 파일에 반영한다.
 * ------------------------------------------------------------------ */

// ---------- §1 전역 상수 ----------
export const WALL_T = 0.12;
export const WALL_H = 2.3;
export const DOOR_W = 1.3;
export const DOOR_H = 2.0;
export const FLOOR_T = 0.12;

export const WALL_COLOR_NORTH = 0xf1e3cd; // axis 'x' 벽 (§3: "북향")
export const WALL_COLOR_SIDE = 0xe7d5ba; // axis 'z' 벽 (§3: "그 외")

// ---------- §2 방 4칸 ----------
// x0,z0,x1,z1 은 벽 중심선 기준 바깥 경계. 실제 걸을 수 있는 내부는 각 변에서 0.06m 안쪽.
export const ROOMS = [
  { id: 'living', name: '거실', x0: -3, z0: -3, x1: 3, z1: 3, floorColor: 0x8a5a3c },
  { id: 'bedA', name: '침실 A', x0: -3, z0: -7, x1: 2, z1: -3, floorColor: 0x9a6a45 },
  { id: 'study', name: '작업실', x0: 3, z0: -2, x1: 7, z1: 3, floorColor: 0x7d5236 },
  { id: 'bedB', name: '침실 B', x0: -2, z0: 3, x1: 2, z1: 7, floorColor: 0x9a6a45 },
];

// ---------- §3 벽 세그먼트 17개 ----------
// axis: 'x'면 Z=at 고정, X가 from→to로 뻗는 벽. 'z'면 X=at 고정, Z가 from→to.
// (x0,z0)-(x1,z1)이 아니라 축/고정좌표/구간으로 표현 — house.js가 여기서
// 박스 치수·위치를 계산한다. doorId가 있으면 그 문 자리만큼 콜라이더가 빈다.
export const WALLS = [
  { axis: 'x', at: -7, from: -3, to: 2 }, // #1 bedA 북 외벽
  { axis: 'x', at: -3, from: -3, to: 2, doorId: 'D1' }, // #2 living↔bedA 공유
  { axis: 'x', at: -3, from: 2, to: 3 }, // #3 living 북 외벽
  { axis: 'x', at: -2, from: 3, to: 7 }, // #4 study 북 외벽
  { axis: 'z', at: -3, from: -7, to: -3 }, // #5 bedA 서 외벽
  { axis: 'z', at: -3, from: -3, to: 3 }, // #6 living 서 외벽
  { axis: 'z', at: -2, from: 3, to: 7 }, // #7 bedB 서 외벽
  { axis: 'z', at: 2, from: -7, to: -3 }, // #8 bedA 동 외벽
  { axis: 'z', at: 3, from: -3, to: -2 }, // #9 living 동 외벽
  { axis: 'z', at: 3, from: -2, to: 3, doorId: 'D2' }, // #10 living↔study 공유
  { axis: 'z', at: 7, from: -2, to: 3 }, // #11 study 동 외벽
  { axis: 'z', at: 2, from: 3, to: 7 }, // #12 bedB 동 외벽
  { axis: 'x', at: 3, from: -3, to: -2 }, // #13 living 남 외벽
  { axis: 'x', at: 3, from: -2, to: 2, doorId: 'D3' }, // #14 living↔bedB 공유
  { axis: 'x', at: 3, from: 2, to: 3 }, // #15 living 남 외벽
  { axis: 'x', at: 3, from: 3, to: 7 }, // #16 study 남 외벽
  { axis: 'x', at: 7, from: -2, to: 2 }, // #17 bedB 남 외벽
];

// ---------- §4 문 3개 ----------
// center/width는 벽의 from~to 구간 안에서의 개구부 위치. 좌우 잔여 조각과
// 개구부 범위는 house.js가 center±width/2로 계산한다(스펙 §4 표와 정확히
// 일치하는 걸 손으로 검산 완료: 예 D1 = [-1.15, 0.15]).
export const DOORS = {
  D1: { center: -0.5, width: DOOR_W, rooms: ['living', 'bedA'] },
  D2: { center: 0.5, width: DOOR_W, rooms: ['living', 'study'] },
  D3: { center: 0.0, width: DOOR_W, rooms: ['living', 'bedB'] },
};
