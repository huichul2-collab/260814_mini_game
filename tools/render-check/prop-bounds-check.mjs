// 소품 월드 좌표 검증 — 거실 램프 공중부양 및 액자 개구부 침범 방지 검증
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { ROOMS, WALLS, DOORS, WINDOWS, WALL_T } from '../../game/src/world/layout.js';
import { PLAYER_CONFIG } from '../../game/config.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(process.argv[2] || path.join(scriptDir, '..', '..', 'game'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.mp3': 'audio/mpeg',
};
function findChrome() {
  const c = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'];
  return c.find((p) => fs.existsSync(p));
}
function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const full = path.join(dir, p);
      fs.readFile(full, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const server = await serve(gameDir);
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await sleep(800);

await page.waitForFunction(() => !!(window.__debug && window.__debug.rooms), { timeout: 10000 });

const results = await page.evaluate(async () => {
  const { TAG } = await import('./src/core/tags.js');
  const T = window.__debug.THREE;
  const scene = window.__debug.scene;
  const roomsMap = window.__debug.rooms;
  scene.updateMatrixWorld(true);

  const supports = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData && (o.userData.roomId || o.userData.solid)) {
      const box = new T.Box3().setFromObject(o);
      supports.push({
        minX: box.min.x, maxX: box.max.x,
        minZ: box.min.z, maxZ: box.max.z,
        topY: box.max.y,
      });
    }
  });

  function ownBox(obj) {
    const box = new T.Box3();
    if (obj.isMesh) box.expandByObject(obj);
    (function walk(o) {
      for (const child of o.children) {
        if (child.isGroup) continue;
        if (child.isMesh) box.expandByObject(child);
        walk(child);
      }
    })(obj);
    return box;
  }

  const out = [];
  for (const [roomId, group] of Object.entries(roomsMap)) {
    if (!group) continue;
    let counter = 0;
    (function collect(g, depth) {
      for (const child of g.children) {
        const isCandidate = child.isGroup || (child.isMesh && depth === 0);
        if (isCandidate) {
          counter++;
          const box = ownBox(child);
          if (!box.isEmpty()) {
            out.push({
              roomId,
              index: counter,
              type: child.isGroup ? 'group' : 'mesh',
              interactiveId: typeof child.userData[TAG.INTERACTIVE] === 'string' ? child.userData[TAG.INTERACTIVE] : null,
              minX: box.min.x, maxX: box.max.x,
              minZ: box.min.z, maxZ: box.max.z,
              bottomY: box.min.y, topY: box.max.y,
              cx: (box.min.x + box.max.x) / 2,
              cz: (box.min.z + box.max.z) / 2,
            });
          }
        }
        if (child.isGroup) collect(child, depth + 1);
      }
    })(group, 0);
  }

  for (const item of out) {
    if (item.bottomY <= 0.02) { item.supported = true; continue; }
    item.supported = supports.some((s) =>
      item.cx >= s.minX && item.cx <= s.maxX &&
      item.cz >= s.minZ && item.cz <= s.maxZ &&
      Math.abs(item.bottomY - s.topY) <= 0.05
    );
  }
  return out;
});

await browser.close();
server.close();

// 문/창문 개구부 AABB 수집
const openings = [];
for (const w of WALLS) {
  if (w.doorId) {
    const d = DOORS[w.doorId];
    const halfW = d.width / 2;
    const minOpen = d.center - halfW;
    const maxOpen = d.center + halfW;
    openings.push({
      id: w.doorId,
      type: '문',
      minX: w.axis === 'x' ? minOpen : w.at - 0.15,
      maxX: w.axis === 'x' ? maxOpen : w.at + 0.15,
      minZ: w.axis === 'z' ? minOpen : w.at - 0.15,
      maxZ: w.axis === 'z' ? maxOpen : w.at + 0.15,
      minY: 0,
      maxY: 2.0,
    });
  }
  if (w.windowId) {
    const win = WINDOWS[w.windowId];
    const halfW = win.width / 2;
    const minOpen = win.center - halfW;
    const maxOpen = win.center + halfW;
    openings.push({
      id: w.windowId,
      type: '창문',
      minX: w.axis === 'x' ? minOpen : w.at - 0.15,
      maxX: w.axis === 'x' ? maxOpen : w.at + 0.15,
      minZ: w.axis === 'z' ? minOpen : w.at - 0.15,
      maxZ: w.axis === 'z' ? maxOpen : w.at + 0.15,
      minY: win.y0,
      maxY: win.y1,
    });
  }
}

// 벽 솔리드 조각(XZ 평면 기준) — 문이 있는 벽은 개구부로 둘로 쪼개진다(house.js와
// 같은 규칙). 창문은 XZ 평면에서는 안 뚫려 있다(y 0.95~1.85만 개구부라 바닥/천장
// 높이엔 벽이 그대로 있음) — 그래서 창문은 안 쪼갠다.
const wallPieces = [];
for (const w of WALLS) {
  const segs = [];
  if (w.doorId) {
    const d = DOORS[w.doorId];
    const halfW = d.width / 2;
    segs.push([w.from, d.center - halfW]);
    segs.push([d.center + halfW, w.to]);
  } else {
    segs.push([w.from, w.to]);
  }
  for (const [from, to] of segs) {
    if (to - from <= 1e-6) continue; // 개구부가 벽 끝까지 닿는 경우(초근접) 조각 없음
    wallPieces.push({
      minX: w.axis === 'x' ? from : w.at - WALL_T / 2,
      maxX: w.axis === 'x' ? to : w.at + WALL_T / 2,
      minZ: w.axis === 'z' ? from : w.at - WALL_T / 2,
      maxZ: w.axis === 'z' ? to : w.at + WALL_T / 2,
      label: `벽#${w.axis === 'x' ? `Z=${w.at}` : `X=${w.at}`}[${from},${to}]`,
    });
  }
}

// 두 축정렬 사각형 사이 최소거리(겹치면 0, 대각선으로 떨어져 있으면 코너간 거리).
function rectGapXZ(a, b) {
  const dx = Math.max(b.minX - a.maxX, a.minX - b.maxX, 0);
  const dz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ, 0);
  return Math.hypot(dx, dz);
}

const PLAYER_DIAM = PLAYER_CONFIG.radius * 2;
const FLUSH_EPS = 0.01; // 이 이하 틈은 "밀착"으로 간주(부동소수점 오차 포함)
// 정상 배치라 틈이 좁아도 되는 조합 — 이유를 남긴다.
const GAP_WHITELIST = [
  ['living.desk', 'living.chair'], // 의자가 책상 밑으로 들어가는 게 정상 배치라 다리 사이 틈이 좁다
];
function isWhitelisted(labelA, labelB) {
  return GAP_WHITELIST.some(([a, b]) => (labelA.includes(a) && labelB.includes(b)) || (labelA.includes(b) && labelB.includes(a)));
}

console.log(`검사한 소품(그룹/방-직속 메시): ${results.length}개`);
console.log('');

let warnings = 0;
const EPS = 0.02;
for (const item of results) {
  const room = ROOMS.find((r) => r.id === item.roomId);
  const outOfBounds =
    item.minX < room.x0 - EPS || item.maxX > room.x1 + EPS ||
    item.minZ < room.z0 - EPS || item.maxZ > room.z1 + EPS;

  // 개구부 겹침 검사
  const overlappedOpenings = openings.filter((op) => {
    const ox = Math.min(item.maxX, op.maxX) - Math.max(item.minX, op.minX);
    const oz = Math.min(item.maxZ, op.maxZ) - Math.max(item.minZ, op.minZ);
    const oy = Math.min(item.topY, op.maxY) - Math.max(item.bottomY, op.minY);
    return ox > 0 && oz > 0 && oy > 0;
  });

  const nameTag = item.interactiveId ? `/${item.interactiveId}` : '';
  const label = `${item.roomId} #${item.index}(${item.type}${nameTag}) world X[${item.minX.toFixed(2)},${item.maxX.toFixed(2)}] Z[${item.minZ.toFixed(2)},${item.maxZ.toFixed(2)}] Y[${item.bottomY.toFixed(2)},${item.topY.toFixed(2)}]`;
  let ok = true;

  // 벽↔가구 틈 검사 — 죽은 주머니(플레이어가 못 들어가는 폭) 재발 방지.
  for (const wp of wallPieces) {
    const gap = rectGapXZ(item, wp);
    if (gap > FLUSH_EPS && gap < PLAYER_DIAM) {
      warnings++;
      ok = false;
      console.log(`WARN ${label} — ${wp.label}과 틈 ${gap.toFixed(3)}m(플레이어 지름 ${PLAYER_DIAM}m 미만, 밀착도 아님) — 죽은 주머니 의심`);
    }
  }

  if (outOfBounds) {
    warnings++;
    ok = false;
    console.log(`WARN ${label} — 자기 방(${room.id} X[${room.x0},${room.x1}] Z[${room.z0},${room.z1}]) 경계 밖`);
  }
  if (overlappedOpenings.length > 0) {
    warnings++;
    ok = false;
    const opIds = overlappedOpenings.map((op) => `${op.type} ${op.id}`).join(', ');
    console.log(`WARN ${label} — ${opIds} 개구부 영역과 겹침!`);
  }
  if (!item.supported) {
    warnings++;
    ok = false;
    console.log(`WARN ${label} — bottomY>0.02인데 바로 아래 바닥/solid 없음(공중부양 의심, 벽걸이 소품이면 정상적인 오탐일 수 있음)`);
  }
  if (ok) {
    console.log(`OK   ${label}`);
  }
}

// 가구↔가구 틈 검사 — 같은 방 안의 소품끼리도 같은 클래스 버그가 날 수 있다
// (예: 책상+의자). 화이트리스트는 위 GAP_WHITELIST 참고.
console.log('');
console.log('--- 가구↔가구 틈 검사 ---');
let furnitureGapWarnings = 0;
for (const room of ROOMS) {
  const items = results.filter((it) => it.roomId === room.id);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const labelA = a.interactiveId || `${a.roomId}#${a.index}`;
      const labelB = b.interactiveId || `${b.roomId}#${b.index}`;
      const gap = rectGapXZ(a, b);
      if (gap <= FLUSH_EPS || gap >= PLAYER_DIAM) continue;
      if (isWhitelisted(labelA, labelB)) {
        console.log(`SKIP(화이트리스트) ${labelA} ↔ ${labelB} 틈 ${gap.toFixed(3)}m — 정상 배치(GAP_WHITELIST 주석 참고)`);
        continue;
      }
      furnitureGapWarnings++;
      console.log(`WARN ${labelA} ↔ ${labelB} 틈 ${gap.toFixed(3)}m(플레이어 지름 ${PLAYER_DIAM}m 미만, 밀착도 아님) — 죽은 주머니 의심`);
    }
  }
}
if (furnitureGapWarnings === 0) console.log('가구↔가구 틈 경고 없음');
warnings += furnitureGapWarnings;

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');

const EXPECTED_PROPS = 24;
if (results.length !== EXPECTED_PROPS) {
  console.error(`FAIL: 소품 총 개수 오차 — 기대값 ${EXPECTED_PROPS}개, 실제 ${results.length}개`);
  process.exit(1);
}

console.log(`OK   소품 총 개수 ${results.length}개 정확히 일치`);
console.log(warnings === 0 ? '경고 없음' : `경고 ${warnings}건 — 최종 판단은 사람이 할 것`);
process.exit(0);
