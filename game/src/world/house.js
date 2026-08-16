import * as THREE from 'three';
import { makeMesh } from '../render/meshFactory.js';
import {
  ROOMS,
  YARD,
  FENCES,
  WALLS,
  DOORS,
  WINDOWS,
  WALL_T,
  WALL_H,
  DOOR_H,
  FLOOR_T,
  WALL_COLOR_NORTH,
  WALL_COLOR_SIDE,
  FENCE_COLOR,
} from './layout.js';

/* ------------------------------------------------------------------ *
 *  layout.js 데이터에서 바닥·벽·문·마당·울타리·창문을 기계적으로 생성한다.
 *  좌표를 여기서 새로 만들지 않는다 — 전부 layout.js에서 읽기만 한다
 *  (docs/spec/M4-layout.md가 원본).
 * ------------------------------------------------------------------ */

// 벽 한 조각을 실제 메시로 만든다. axis='x'면 Z=at 고정으로 X가 from→to,
// axis='z'면 X=at 고정으로 Z가 from→to. yBottom~yTop 구간만큼의 높이.
function buildWallPiece(parent, axis, at, from, to, yBottom, yTop, color, opts) {
  if (to <= from) return;
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

  // ---------- B-4a 마당 바닥 및 울타리 3면 ----------
  if (YARD) {
    const w = YARD.x1 - YARD.x0 + WALL_T;
    const d = YARD.z1 - YARD.z0 + WALL_T;
    const cx = (YARD.x0 + YARD.x1) / 2;
    const cz = (YARD.z0 + YARD.z1) / 2;
    makeMesh(
      new THREE.BoxGeometry(w, FLOOR_T, d),
      YARD.floorColor,
      house,
      [cx, -FLOOR_T / 2, cz],
      {},
      { roomId: YARD.id }
    );
  }

  for (const fence of FENCES) {
    buildWallPiece(house, fence.axis, fence.at, fence.from, fence.to, 0, fence.height, FENCE_COLOR, {
      solid: true,
    });
  }

  // ---------- 벽: 일반 / 문 / 창문 ----------
  for (const wall of WALLS) {
    const color = wall.axis === 'x' ? WALL_COLOR_NORTH : WALL_COLOR_SIDE;

    if (!wall.doorId && !wall.windowId) {
      buildWallPiece(house, wall.axis, wall.at, wall.from, wall.to, 0, WALL_H, color, {
        solid: true,
        fadeable: true,
      });
      continue;
    }

    if (wall.doorId) {
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
    } else if (wall.windowId) {
      const win = WINDOWS[wall.windowId];
      const openStart = win.center - win.width / 2;
      const openEnd = win.center + win.width / 2;

      // 좌/우 벽 조각 — 전체 높이, 콜라이더 있음
      buildWallPiece(house, wall.axis, wall.at, wall.from, openStart, 0, WALL_H, color, {
        solid: true,
        fadeable: true,
      });
      buildWallPiece(house, wall.axis, wall.at, openEnd, wall.to, 0, WALL_H, color, {
        solid: true,
        fadeable: true,
      });
      // 창문 하단 조각 y: 0~win.y0 (0.95m) — solid: true (벽으로 차단)
      buildWallPiece(house, wall.axis, wall.at, openStart, openEnd, 0, win.y0, color, {
        solid: true,
        fadeable: true,
      });
      // 창문 상단 조각 y: win.y1~WALL_H (1.85m~2.3m) — solid 없음 (공백)
      buildWallPiece(house, wall.axis, wall.at, openStart, openEnd, win.y1, WALL_H, color, {
        fadeable: true,
      });

      // 창틀 기둥 (장식용, solid 없음)
      const frameColor = 0x5a3826;
      const frameHeight = win.y1 - win.y0; // 0.90m
      const frameY = (win.y0 + win.y1) / 2;
      const fThickness = 0.06;
      for (const pPos of [openStart, openEnd]) {
        const geo =
          wall.axis === 'x'
            ? new THREE.BoxGeometry(fThickness, frameHeight, WALL_T + 0.02)
            : new THREE.BoxGeometry(WALL_T + 0.02, frameHeight, fThickness);
        const pCoords = wall.axis === 'x' ? [pPos, frameY, wall.at] : [wall.at, frameY, pPos];
        makeMesh(geo, frameColor, house, pCoords, {}, { fadeable: true });
      }
    }
  }

  return house;
}
