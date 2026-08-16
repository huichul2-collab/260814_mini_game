// M4 방 4개 도달 + 문 가장자리 통과 검증 (docs/spec/M4-layout.md §6.2).
// 스크린샷만 찍으면 "문에 끼는" 버그를 못 잡는다 — 실제 키 입력 시뮬레이션으로
// 걸어서 확인하는 게 이 스크립트의 진짜 목적이다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2]);

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
await page.setViewport({ width: 960, height: 600 });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) logs.push(`[http${r.status()}] ${r.url()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await sleep(800);
await page.click('#audio-start-btn').catch(() => {}); // 오버레이 제거(없으면 무시)
await sleep(500);

function getPos() {
  return page.evaluate(() => {
    const p = window.__debug.player.root.position;
    return { x: p.x, z: p.z };
  });
}
function keyDown(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
}
function keyUp(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
}

// 목표 지점까지 매 폴링마다 필요한 방향키를 다시 판단해서 누르는 방식(그리디).
// 문/모서리는 통과 가능한 직선/대각선 경로가 있는 토폴로지라 이 정도로 충분하다.
async function walkTo(target, { tol = 0.3, timeoutMs = 20000, pollMs = 150 } = {}) {
  const held = new Set();
  async function setHeld(wanted) {
    for (const k of held) if (!wanted.has(k)) { await keyUp(k); held.delete(k); }
    for (const k of wanted) if (!held.has(k)) { await keyDown(k); held.add(k); }
  }
  const start = Date.now();
  let pos = await getPos();
  while (Date.now() - start < timeoutMs) {
    pos = await getPos();
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    if (Math.hypot(dx, dz) < tol) { await setHeld(new Set()); return { ok: true, pos, ms: Date.now() - start }; }
    const wanted = new Set();
    if (dx > 0.05) wanted.add('KeyD'); else if (dx < -0.05) wanted.add('KeyA');
    if (dz > 0.05) wanted.add('KeyS'); else if (dz < -0.05) wanted.add('KeyW');
    await setHeld(wanted);
    await sleep(pollMs);
  }
  await setHeld(new Set());
  return { ok: false, pos, ms: Date.now() - start };
}

const results = [];
async function leg(name, target, opts) {
  const r = await walkTo(target, opts);
  results.push({ name, target, ...r });
  const tag = r.ok ? 'OK ' : 'FAIL';
  console.log(`${tag} ${name} → 목표(${target.x},${target.z}) 실제(${r.pos.x.toFixed(2)},${r.pos.z.toFixed(2)}) ${r.ms}ms`);
  return r;
}

// 여러 지점을 순서대로 통과. "방→거실" 복귀에 쓴다: 거실 중앙(0,0)은 문
// 반지름 감안 안전폭(예: D1은 X[-0.93,-0.07])에서 벗어나 있어서, 문 안에
// 있는 상태에서 곧장 (0,0)을 노리면 그리디 워커가 문틀 모서리에 정확히
// 접선으로 붙어버린다(실측: x=-0.07, 여유 0.03m). 문을 완전히 통과한
// 안전 지점을 먼저 찍고 나서 중앙으로 가면 이 문제가 없다.
async function legPath(name, waypoints, opts) {
  let last;
  for (let i = 0; i < waypoints.length; i++) {
    last = await walkTo(waypoints[i], opts);
    if (!last.ok) {
      results.push({ name: `${name} (경유 ${i + 1}/${waypoints.length})`, target: waypoints[i], ...last });
      console.log(`FAIL ${name} (경유 ${i + 1}/${waypoints.length}) → 목표(${waypoints[i].x},${waypoints[i].z}) 실제(${last.pos.x.toFixed(2)},${last.pos.z.toFixed(2)}) ${last.ms}ms`);
      return last;
    }
  }
  results.push({ name, target: waypoints[waypoints.length - 1], ...last });
  console.log(`OK  ${name} → 최종(${last.pos.x.toFixed(2)},${last.pos.z.toFixed(2)}) ${last.ms}ms`);
  return last;
}

// ---------- 방 4개 중앙 도달 ----------
console.log('--- 방 중앙 도달 ---');
await leg('living(spawn 확인)', { x: 0, z: 0 });
await page.screenshot({ path: path.join(gameDir, '..', 'tools', 'render-check', 'm4-living.png') });

await leg('bedA', { x: -0.5, z: -5 });
await page.screenshot({ path: path.join(gameDir, '..', 'tools', 'render-check', 'm4-bedA.png') });
await legPath('bedA→living', [{ x: -0.5, z: -1 }, { x: 0, z: 0 }]);

await leg('study', { x: 5, z: 0.5 });
await page.screenshot({ path: path.join(gameDir, '..', 'tools', 'render-check', 'm4-study.png') });
await legPath('study→living', [{ x: 1, z: 0.5 }, { x: 0, z: 0 }]);

await leg('bedB', { x: 0, z: 5 });
await page.screenshot({ path: path.join(gameDir, '..', 'tools', 'render-check', 'm4-bedB.png') });
await legPath('bedB→living', [{ x: 0, z: 1 }, { x: 0, z: 0 }]);

// ---------- 문 가장자리(개구부 A측 +0.25m 안쪽)로 통과 ----------
// 반지름 0.22m 대비 여유 0.03m — 문틀 끼임을 잡기 위한 의도적으로 빡빡한 경로.
// 복귀 구간은 위와 같은 이유로 문 중앙 정렬 경유지를 먼저 찍는다.
console.log('--- 문 가장자리 통과(0.25m 안쪽) ---');
// ⚠️ gemini/lane-rooms 병합 후 목표 Z=-5가 침대 프레임(solid, Z[-6.79,-4.89])
// 안에 들어가버려 도달 불가 상태가 됐다(게임 버그 아님 — 이 스크립트의
// 하드코딩 목표가 새로 생긴 가구와 우연히 겹친 것). 문을 통과했는지만
// 확인하면 되므로 침대 앞 안전한 Z=-3.6으로 당김.
await leg('D1 가장자리 → bedA', { x: -0.9, z: -3.6 });
await legPath('D1 가장자리 → living', [{ x: -0.5, z: -1 }, { x: 0, z: 0 }]);

await leg('D2 가장자리 → study', { x: 5, z: 0.1 });
await legPath('D2 가장자리 → living', [{ x: 1, z: 0.5 }, { x: 0, z: 0 }]);

await leg('D3 가장자리 → bedB', { x: -0.4, z: 5 });
await legPath('D3 가장자리 → living', [{ x: 0, z: 1 }, { x: 0, z: 0 }]);

console.log('');
console.log('로그:', logs.length ? logs : '없음');

const failed = results.filter((r) => !r.ok);
console.log('');
console.log(`총 ${results.length}개 구간, 실패 ${failed.length}개`);
if (failed.length) {
  console.log('실패 구간:', failed.map((f) => `${f.name} (마지막 위치 ${f.pos.x.toFixed(2)},${f.pos.z.toFixed(2)})`).join(' / '));
}

await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
