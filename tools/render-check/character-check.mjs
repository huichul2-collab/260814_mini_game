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
// 검사 도중 예외가 나도 chrome.exe가 안 남게 finally에서 닫는다. exit/SIGINT
// 훅은 그마저 못 지나간 경우(강제 종료 등)를 위한 마지막 안전망이다.
let browserClosed = false;
async function closeBrowser() {
  if (browserClosed) return;
  browserClosed = true;
  await browser.close().catch(() => {});
}
process.on('exit', () => {
  if (!browserClosed) browser.process()?.kill('SIGKILL');
});
process.on('SIGINT', async () => {
  await closeBrowser();
  server.close();
  process.exit(1);
});

const failures = [];
try {
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await sleep(800);
// gate.js가 에셋 로딩 끝나기 전엔 버튼을 disabled로 둔다 — disabled 상태
// 클릭은 브라우저가 무시하므로 활성화될 때까지 기다린 뒤 누른다.
await page.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 }).catch(() => {});
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
// ⚠️ includes()만 쓰면 'Attacking_Idle'처럼 idle을 포함하지만 진짜 대기
// 포즈가 아닌 클립을 잘못 집어도 통과해버린다(실제로 겪은 버그 —
// findClip이 정확일치를 먼저 시도하도록 고친 뒤에도 이 검사 자체가
// 느슨하면 회귀를 못 잡는다). 정확히 'idle'인지까지 확인한다.
console.log('--- 정지 상태 idle 확인 ---');
const idleName = (info.currentActionName || '').toLowerCase();
const idleOk = idleName === 'idle';
console.log(`${idleOk ? 'OK  ' : 'FAIL'} currentAction="${info.currentActionName}" (정확히 'idle'이어야 함)`);
if (!idleOk) failures.push(`정지 상태 currentAction이 정확히 'idle'이 아님(${info.currentActionName})`);

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
} finally {
  await closeBrowser();
  server.close();
}
process.exit(failures.length ? 1 : 0);
