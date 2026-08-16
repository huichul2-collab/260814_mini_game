// gemini/lane-character 병합 검증 — 리깅 GLB가 실제로 로드되고 idle/walk
// 애니메이션이 WASD 입력에 반응해 전환되는지, 플레이스홀더 캡슐이 씬에서
// 빠졌는지를 헤드리스 Chrome + 실제 키 입력 시뮬레이션으로 확인한다.
// m4-rooms.mjs와 같은 서버/브라우저 보일러플레이트를 쓴다.
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

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await sleep(800);
await page.click('#audio-start-btn').catch(() => {});
await sleep(500);

function currentActionInfo() {
  return page.evaluate(() => {
    const p = window.__debug.player;
    const clip = p.currentAction && p.currentAction.getClip ? p.currentAction.getClip() : null;
    return {
      hasMixer: !!p.mixer,
      currentActionName: clip ? clip.name : null,
      hasCapsulePlaceholder: p.root.children.some(
        (c) => c.type === 'Mesh' && c.geometry && c.geometry.type === 'CapsuleGeometry'
      ),
    };
  });
}
function keyDown(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
}
function keyUp(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
}

const failures = [];

// ---------- GLB 로드 대기 (mixer가 null 아닐 때까지 폴링) ----------
console.log('--- GLB 로드 대기 ---');
let info = await currentActionInfo();
const loadStart = Date.now();
while (!info.hasMixer && Date.now() - loadStart < 15000) {
  await sleep(200);
  info = await currentActionInfo();
}
if (info.hasMixer) {
  console.log(`OK  mixer 생성됨 (${Date.now() - loadStart}ms)`);
} else {
  console.log('FAIL mixer가 15초 내에 생성되지 않음 — GLB 로드 실패 또는 캡슐 폴백 상태로 남음');
  failures.push('mixer null (GLB 로드 실패 추정)');
}

// ---------- 정지 상태: idle 액션 ----------
console.log('--- 정지 상태 idle 확인 ---');
const idleOk = !!(info.currentActionName && info.currentActionName.toLowerCase().includes('idle'));
console.log(`${idleOk ? 'OK  ' : 'FAIL'} currentAction="${info.currentActionName}"`);
if (!idleOk) failures.push(`정지 상태 currentAction에 'idle' 없음(${info.currentActionName})`);

// ---------- W 키로 이동: walk 액션으로 전환 ----------
console.log('--- W 이동 중 walk 확인 ---');
await keyDown('KeyW');
await sleep(600); // fadeIn(0.2s) + 여유
const walkInfo = await currentActionInfo();
const walkOk = !!(walkInfo.currentActionName && walkInfo.currentActionName.toLowerCase().includes('walk'));
console.log(`${walkOk ? 'OK  ' : 'FAIL'} currentAction="${walkInfo.currentActionName}"`);
if (!walkOk) failures.push(`이동 중 currentAction에 'walk' 없음(${walkInfo.currentActionName})`);
await keyUp('KeyW');
await sleep(400);

// ---------- 캡슐 플레이스홀더 제거 확인 ----------
console.log('--- 캡슐 플레이스홀더 제거 확인 ---');
const finalInfo = await currentActionInfo();
const capsuleGone = !finalInfo.hasCapsulePlaceholder;
console.log(`${capsuleGone ? 'OK  ' : 'FAIL'} root.children에 캡슐 ${capsuleGone ? '없음' : '남아있음'}`);
if (!capsuleGone) failures.push('캡슐 플레이스홀더가 GLB 로드 후에도 root.children에 남아있음');

console.log('');
console.log('로그:', logs.length ? logs : '없음');

console.log('');
console.log(failures.length ? `${failures.length}건 실패: ${failures.join(' / ')}` : '전부 통과');

await browser.close();
server.close();
process.exit(failures.length ? 1 : 0);
