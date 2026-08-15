// M1 이동/충돌/카메라 검증 — 순수 DOM KeyboardEvent를 디스패치하고
// window.__debug로 위치를 직접 읽는다(픽셀 비교보다 정확함).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2]);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.jpg': 'image/jpeg',
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

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await new Promise((r) => setTimeout(r, 800));

function getState() {
  return page.evaluate(() => {
    const p = window.__debug.player.root.position;
    const c = window.__debug.camera.position;
    return { px: p.x, py: p.y, pz: p.z, cx: c.x, cy: c.y, cz: c.z };
  });
}
function keyDown(code) {
  return page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keydown', { code })), code);
}
function keyUp(code) {
  return page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keyup', { code })), code);
}
// 위치가 더 안 바뀔 때까지(연속 정지 2회) 폴링. 소프트웨어 렌더링이라
// 프레임이 느릴 수 있어 wall-clock 대신 "변화 없음"으로 안정화를 판단.
async function holdUntilStable(code, maxSeconds = 12) {
  await keyDown(code);
  let prev = await getState();
  let stable = 0;
  let last = prev;
  for (let i = 0; i < maxSeconds && stable < 2; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    last = await getState();
    const d = Math.hypot(last.px - prev.px, last.pz - prev.pz);
    stable = d < 0.005 ? stable + 1 : 0;
    prev = last;
  }
  await keyUp(code);
  await new Promise((r) => setTimeout(r, 400));
  return getState();
}

const spawn = await getState();
console.log('스폰 위치:', spawn);

// ---- 1) 곧장 전진 → 책상 앞면에 막히는지 (책상 x:[-0.1,0.9] z:[-1.625,-1.075]) ----
const atDesk = await holdUntilStable('KeyW');
console.log('W 전진 후 정지 위치:', atDesk);
const deskFrontZ = -1.075;
const expectedStopZ = deskFrontZ + 0.22; // player.radius
console.log(`→ 책상 앞면 접촉 기대값 z≈${expectedStopZ.toFixed(3)}, 실제 z=${atDesk.pz.toFixed(3)} (오차 ${Math.abs(atDesk.pz - expectedStopZ).toFixed(3)}m)`);

// ---- 2) 왼쪽으로 비켜서 책상 x범위(-0.1~0.9)를 벗어나기 ----
await holdUntilStable('KeyA', 3);
const afterStrafe = await getState();
console.log('A로 비킨 후:', afterStrafe);

// ---- 3) 다시 전진 → 이번엔 뒷벽(안쪽 면 z=-1.74)까지 도달하는지 ----
const atWall = await holdUntilStable('KeyW');
console.log('다시 W 전진 후 정지 위치:', atWall);
const wallExpectedZ = -1.74 + 0.22;
console.log(`→ 뒷벽 접촉 기대값 z≈${wallExpectedZ.toFixed(3)}, 실제 z=${atWall.pz.toFixed(3)} (오차 ${Math.abs(atWall.pz - wallExpectedZ).toFixed(3)}m)`);

// ---- 카메라가 전체 과정에서 플레이어를 따라왔는지 ----
const camMoved = Math.hypot(atWall.cx - spawn.cx, atWall.cz - spawn.cz);
console.log(`→ 카메라 총 이동 거리: ${camMoved.toFixed(3)}m (0이면 추적 카메라가 안 움직인 것)`);

await page.screenshot({ path: path.join(gameDir, '..', 'tools', 'render-check', 'move-after.png') });
console.log('페이지/콘솔 에러:', logs.length ? logs : '없음');

await browser.close();
server.close();
