import * as THREE from 'three';
import { makeMesh } from '../render/meshFactory.js';
import {
  ROOMS,
  WALLS,
  DOORS,
  WALL_T,
  WALL_H,
  DOOR_H,
  FLOOR_T,
  WALL_COLOR_NORTH,
  WALL_COLOR_SIDE,
} from './layout.js';

/* ------------------------------------------------------------------ *
 *  layout.js 데이터에서 바닥·벽·문을 기계적으로 생성한다. 좌표를
 *  여기서 새로 만들지 않는다 — 전부 layout.js에서 읽기만 한다
 *  (docs/spec/M4-layout.md가 원본).
 * ------------------------------------------------------------------ */

// 벽 한 조각을 실제 메시로 만든다. axis='x'면 Z=at 고정으로 X가 from→to,
// axis='z'면 X=at 고정으로 Z가 from→to. yBottom~yTop 구간만큼의 높이.
function buildWallPiece(parent, axis, at, from, to, yBottom, yTop, color, opts) {
  const len = to - from;
  const height = yTop - yBottom;
  const yCenter = (yBottom + yTop) / 2;
  const mid = (from + to) / 2;

  const geo =
    axis === 'x'
      ? new THREE.BoxGeometry(len, height, WALL_T)
      : new THREE.BoxGeometry(WALL_T, height, len);
  const pos = axis === 'x' ? [mid, yCenter, at] : [at, yCenter, mid];

  makeMesh(geo, color, parent, pos, {}, opts);
}

export function createHouse(scene) {
  const house = new THREE.Group();
  scene.add(house);

  // ---------- 바닥: 방 rect를 WALL_T/2씩 사방으로 확장한 박스 ----------
  for (const room of ROOMS) {
    const w = room.x1 - room.x0 + WALL_T;
    const d = room.z1 - room.z0 + WALL_T;
    const cx = (room.x0 + room.x1) / 2;
    const cz = (room.z0 + room.z1) / 2;
    makeMesh(
      new THREE.BoxGeometry(w, FLOOR_T, d),
      room.floorColor,
      house,
      [cx, -FLOOR_T / 2, cz],
      {},
      { roomId: room.id }
    );
  }

  // ---------- 벽: 문 없으면 통짜 1개, 있으면 좌/우 조각 + 상인방 3개 ----------
  for (const wall of WALLS) {
    const color = wall.axis === 'x' ? WALL_COLOR_NORTH : WALL_COLOR_SIDE;

    if (!wall.doorId) {
      buildWallPiece(house, wall.axis, wall.at, wall.from, wall.to, 0, WALL_H, color, {
        solid: true,
        fadeable: true,
      });
      continue;
    }

    const door = DOORS[wall.doorId];
    const openStart = door.center - door.width / 2;
    const openEnd = door.center + door.width / 2;

    // 좌(하) / 우(상) 조각 — 전체 높이, 콜라이더 있음
    buildWallPiece(house, wall.axis, wall.at, wall.from, openStart, 0, WALL_H, color, {
      solid: true,
      fadeable: true,
    });
    buildWallPiece(house, wall.axis, wall.at, openEnd, wall.to, 0, WALL_H, color, {
      solid: true,
      fadeable: true,
    });
    // 상인방 — 원래 구간 전체 길이, DOOR_H~WALL_H만. solid 없음 = 콜라이더 공백(문).
    buildWallPiece(house, wall.axis, wall.at, wall.from, wall.to, DOOR_H, WALL_H, color, {
      fadeable: true,
    });
  }

  return house;
}
