#!/usr/bin/env node
// M4 레이아웃 정적 검증 — 순수 node, 브라우저 불필요.
// docs/spec/M4-layout.md §6.1의 7개 검사를 layout.js/config/player.js
// 데이터만 읽어서 수행한다. 전부 통과해야 exit 0, 하나라도 실패하면 exit 1.
import { ROOMS, WALLS, DOORS, WALL_T } from '../game/src/world/layout.js';
import { PLAYER } from '../game/src/config/player.js';

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`OK   ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function wallAABB(axis, at, from, to) {
  const half = WALL_T / 2;
  return axis === 'x'
    ? { minX: from, maxX: to, minZ: at - half, maxZ: at + half }
    : { minX: at - half, maxX: at + half, minZ: from, maxZ: to };
}

// ---------- 1. 모든 벽이 축정렬 ----------
// layout.js의 스키마 자체가 axis:'x'|'z' + from<to로만 벽을 표현할 수 있어서
// 대각선 벽은 구조적으로 불가능하다. 여기서는 axis 값 유효성과 from<to만 확인.
{
  const bad = [];
  WALLS.forEach((w, i) => {
    if (w.axis !== 'x' && w.axis !== 'z') bad.push(`#${i + 1} axis=${w.axis}`);
    if (!(w.from < w.to)) bad.push(`#${i + 1} from>=to`);
  });
  check('1. 모든 벽 축정렬(axis 유효 + from<to)', bad.length === 0, bad.join('; '));
}

// ---------- 2. 문 폭 >= 2×PLAYER.radius + 0.15 ----------
{
  const minWidth = 2 * PLAYER.radius + 0.15;
  const bad = Object.entries(DOORS)
    .filter(([, d]) => d.width < minWidth)
    .map(([id]) => id);
  check(`2. 문 폭 >= ${minWidth.toFixed(3)}m (2r+0.15)`, bad.length === 0, bad.join(','));
}

// ---------- 3. 문 개구부가 벽 구간에 포함 + 잔여 조각 >= 0.10m ----------
{
  const details = [];
  for (const wall of WALLS) {
    if (!wall.doorId) continue;
    const d = DOORS[wall.doorId];
    const openStart = d.center - d.width / 2;
    const openEnd = d.center + d.width / 2;
    const remA = openStart - wall.from;
    const remB = wall.to - openEnd;
    if (openStart < wall.from || openEnd > wall.to) details.push(`${wall.doorId}: 개구부가 벽 구간 밖`);
    if (remA < 0.1) details.push(`${wall.doorId}: 좌 잔여 ${remA.toFixed(3)}m`);
    if (remB < 0.1) details.push(`${wall.doorId}: 우 잔여 ${remB.toFixed(3)}m`);
  }
  check('3. 문 개구부 포함 + 잔여조각>=0.10m', details.length === 0, details.join('; '));
}

// ---------- 4. 방 rect끼리 겹치지 않음 ----------
{
  const overlaps = [];
  for (let i = 0; i < ROOMS.length; i++) {
    for (let j = i + 1; j < ROOMS.length; j++) {
      const a = ROOMS[i];
      const b = ROOMS[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      if (ox > 0 && oz > 0) overlaps.push(`${a.id}×${b.id}`);
    }
  }
  check('4. 방 rect 비중첩', overlaps.length === 0, overlaps.join(','));
}

// ---------- 5. 연결성: living에서 전체 방 도달 가능 ----------
{
  const adj = {};
  for (const r of ROOMS) adj[r.id] = [];
  for (const d of Object.values(DOORS)) {
    const [a, b] = d.rooms;
    adj[a].push(b);
    adj[b].push(a);
  }
  const seen = new Set(['living']);
  const stack = ['living'];
  while (stack.length) {
    const cur = stack.pop();
    for (const n of adj[cur]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  }
  const missing = ROOMS.filter((r) => !seen.has(r.id)).map((r) => r.id);
  check('5. living에서 전체 방 도달 가능', missing.length === 0, missing.join(','));
}

// ---------- 6. 스폰 지점이 벽 콜라이더에서 충분히 떨어짐 ----------
// 스폰 좌표 [0,0,1.5]는 main.js의 createPlayer() 호출과 반드시 일치해야 한다
// (docs/spec/M4-layout.md §5.3). 소품 콜라이더는 layout.js에 없는 정보라
// 이 스크립트 범위 밖 — m4-rooms.mjs가 실행 시점에 간접 검증한다.
{
  const spawn = { x: 0, z: 1.5 };
  const colliders = [];
  for (const wall of WALLS) {
    if (!wall.doorId) {
      colliders.push(wallAABB(wall.axis, wall.at, wall.from, wall.to));
      continue;
    }
    const d = DOORS[wall.doorId];
    const openStart = d.center - d.width / 2;
    const openEnd = d.center + d.width / 2;
    colliders.push(wallAABB(wall.axis, wall.at, wall.from, openStart));
    colliders.push(wallAABB(wall.axis, wall.at, openEnd, wall.to));
  }
  let minDist = Infinity;
  let inside = false;
  for (const b of colliders) {
    const qx = clamp(spawn.x, b.minX, b.maxX);
    const qz = clamp(spawn.z, b.minZ, b.maxZ);
    const d = Math.hypot(spawn.x - qx, spawn.z - qz);
    if (d === 0) inside = true;
    minDist = Math.min(minDist, d);
  }
  const clearance = minDist - PLAYER.radius;
  check('6. 스폰 지점 벽 콜라이더에서 >=0.3m', !inside && clearance >= 0.3, `clearance=${clearance.toFixed(3)}m`);
}

// ---------- 7. 벽 외곽선 폐합 (모든 끝점이 짝을 가짐, 공선 연속 허용) ----------
{
  function endpoints(w) {
    return w.axis === 'x' ? [[w.from, w.at], [w.to, w.at]] : [[w.at, w.from], [w.at, w.to]];
  }
  const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const counts = {};
  for (const w of WALLS) for (const p of endpoints(w)) counts[key(p)] = (counts[key(p)] || 0) + 1;
  const dangling = Object.entries(counts).filter(([, c]) => c < 2).map(([k]) => k);
  check('7. 벽 외곽선 폐합(끝점마다 짝 있음)', dangling.length === 0, dangling.join('; '));
}

console.log('');
console.log(`벽 조각(생성 예정): ${WALLS.filter((w) => !w.doorId).length} + ${WALLS.filter((w) => w.doorId).length * 3} = ${WALLS.filter((w) => !w.doorId).length + WALLS.filter((w) => w.doorId).length * 3}`);
console.log(failures === 0 ? '전부 통과' : `${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
