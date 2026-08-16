// 소품 월드 좌표 검증 — 거실 램프가 desk.add(lamp) 로컬 오프셋 위에 또
// desk.position 오프셋이 겹쳐 더해져서(M4에서 책상만 옮기고 램프 로컬
// 좌표를 안 고친 회귀) 거실 북벽을 뚫고 침실A 쪽 허공에 떠 있던 사고
// 이후 추가. 실제 브라우저에서 씬을 띄우고(순수 데이터 스크립트인
// layout-check.mjs로는 실제 Object3D 계층/월드좌표에 접근할 수 없다 —
// world 모듈이 document/WebGL/AudioContext에 의존해 Node에서 그대로
// import할 수 없다) 각 방 그룹 밑의 "소품"(그룹, 또는 방 루트에 바로
// 붙은 메시)의 실제 world position을 읽어:
//   ① 자기 방 경계(layout.js ROOMS) 밖으로 나갔는지
//   ② y>0.02인데 바닥/solid 메시가 바로 아래에 없는지(공중부양)
// 를 찾아 출력한다. 판정으로 exit 1 하지 않는다 — 경고만, 최종 판단은 사람.
// (벽걸이 액자류는 ②에 의도적으로 걸릴 수 있음 — 바닥에 서 있지 않는
// 게 정상이라 오탐이다. 그런 항목은 사람이 보고 넘기면 됨.)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { ROOMS } from '../../game/src/world/layout.js';

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

// window.__debug.rooms가 뜰 때까지 대기(씬 구성은 동기라 사실상 바로 있음).
await page.waitForFunction(() => !!(window.__debug && window.__debug.rooms), { timeout: 10000 });

const results = await page.evaluate(() => {
  const T = window.__debug.THREE;
  const scene = window.__debug.scene;
  const roomsMap = window.__debug.rooms;
  scene.updateMatrixWorld(true);

  // 바닥(roomId 태그) + solid 태그 메시의 월드 AABB를 "받침" 후보로 수집.
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

  // 후보 그룹의 "자기 것만" 월드 AABB — 안 그러면 desk 박스가 그 밑에
  // 중첩된 lamp 그룹까지 삼켜서 커진다(중첩 그룹은 따로 체크하므로 제외).
  function ownBox(obj) {
    const box = new T.Box3();
    if (obj.isMesh) box.expandByObject(obj);
    (function walk(o) {
      for (const child of o.children) {
        if (child.isGroup) continue; // 중첩 그룹은 별도 후보로 체크 — 제외
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
              minX: box.min.x, maxX: box.max.x,
              minZ: box.min.z, maxZ: box.max.z,
              bottomY: box.min.y,
              cx: (box.min.x + box.max.x) / 2,
              cz: (box.min.z + box.max.z) / 2,
            });
          }
        }
        if (child.isGroup) collect(child, depth + 1);
      }
    })(group, 0);
  }

  // 지지 여부는 여기(브라우저 쪽)에서 계산해 결과에 포함시킨다 — supports
  // 배열 자체를 Node로 넘기지 않아도 되게.
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

console.log(`검사한 소품(그룹/방-직속 메시): ${results.length}개`);
console.log('');

let warnings = 0;
const EPS = 0.02;
for (const item of results) {
  const room = ROOMS.find((r) => r.id === item.roomId);
  const outOfBounds =
    item.minX < room.x0 - EPS || item.maxX > room.x1 + EPS ||
    item.minZ < room.z0 - EPS || item.maxZ > room.z1 + EPS;
  const label = `${item.roomId} #${item.index}(${item.type}) world X[${item.minX.toFixed(2)},${item.maxX.toFixed(2)}] Z[${item.minZ.toFixed(2)},${item.maxZ.toFixed(2)}] bottomY=${item.bottomY.toFixed(2)}`;
  if (outOfBounds) {
    warnings++;
    console.log(`WARN ${label} — 자기 방(${room.id} X[${room.x0},${room.x1}] Z[${room.z0},${room.z1}]) 경계 밖`);
  }
  if (!item.supported) {
    warnings++;
    console.log(`WARN ${label} — bottomY>0.02인데 바로 아래 바닥/solid 없음(공중부양 의심, 벽걸이 소품이면 정상적인 오탐일 수 있음)`);
  }
  if (!outOfBounds && item.supported) {
    console.log(`OK   ${label}`);
  }
}

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');
console.log(warnings === 0 ? '경고 없음' : `경고 ${warnings}건 — 최종 판단은 사람이 할 것`);
process.exit(0);
