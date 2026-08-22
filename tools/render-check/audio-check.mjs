// 오디오 게이트 + BGM + 발소리(이동 연동) 검증 — puppeteer의 CDP 레벨
// 클릭(page.click)을 써야 한다. 합성 DOM 클릭(dispatchEvent)은 브라우저가
// "진짜 사용자 제스처"로 안 쳐줘서 AudioContext.resume()이 막힌다.
// page.click()은 실제 입력 이벤트라 통과된다. 키보드는 합성 dispatch로
// 충분하다(m4-rooms.mjs에서 이미 확인된 패턴 — 이동은 오토플레이 제약이 없음).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2]);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary', '.png': 'image/png',
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
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) logs.push(`[http${r.status()}] ${r.url()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await sleep(500);

const before = await page.evaluate(() => ({ hasButton: !!document.getElementById('audio-start-btn') }));
console.log(`${before.hasButton ? 'OK  ' : 'FAIL'} 시작 버튼 존재: ${before.hasButton}`);
if (!before.hasButton) failures.push('#audio-start-btn 없음');

// ---------- BGM 게이트 ----------
// ⚠️ 고정 sleep이 아니라 폴링으로 대기한다 — BGM 파일 용량이 세션마다
// 바뀔 수 있어(실제로 1.17MB↔4.1MB를 오간 적 있음) 고정 시간은 깨지기 쉽다.
console.log('--- BGM 게이트 ---');
// gate.js가 에셋 로딩이 끝나기 전엔 버튼을 disabled로 둔다(2026-08-17) —
// disabled 상태에서 클릭하면 브라우저가 click을 아예 안 쏴서 무한 대기한다.
await page.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.click('#audio-start-btn');

let after = null;
const bgmWaitStart = Date.now();
while (Date.now() - bgmWaitStart < 8000) {
  after = await page.evaluate(() => {
    const bgm = window.__debug && window.__debug.bgm;
    return {
      contextState: bgm ? bgm.context.state : 'no-bgm',
      isPlaying: bgm ? bgm.isPlaying : null,
      hasBuffer: bgm ? !!bgm.buffer : null,
      loadingGone: !document.getElementById('loading'),
    };
  });
  if (after.isPlaying) break;
  await sleep(200);
}
console.log(`클릭 후 상태(${Date.now() - bgmWaitStart}ms 대기):`, after);
const bgmOk = after.contextState === 'running' && after.isPlaying === true && after.hasBuffer === true;
console.log(`${bgmOk ? 'OK  ' : 'FAIL'} BGM 재생 중`);
if (!bgmOk) failures.push('BGM이 게이트 클릭 후 재생 상태가 아님');
console.log(`${after.loadingGone ? 'OK  ' : 'FAIL'} #loading 오버레이 제거됨`);
if (!after.loadingGone) failures.push('#loading 오버레이가 안 사라짐');

function keyDown(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
}
function keyUp(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
}
function footstepPlaying() {
  return page.evaluate(() => {
    const fs = window.__debug && window.__debug.footsteps;
    return !!(fs && fs.pool && fs.pool.some((s) => s.isPlaying));
  });
}
async function pollAny(durationMs, stepMs = 60) {
  const start = Date.now();
  let any = false;
  while (Date.now() - start < durationMs) {
    if (await footstepPlaying()) { any = true; break; }
    await sleep(stepMs);
  }
  return any;
}

// ---------- 발소리: 정지 상태에서는 안 남 ----------
console.log('--- 발소리: 정지 상태 ---');
const idlePlaying = await pollAny(1000);
console.log(`${!idlePlaying ? 'OK  ' : 'FAIL'} 정지 상태에서 발소리 재생됨=${idlePlaying}`);
if (idlePlaying) failures.push('키 입력 없는데 발소리가 재생됨');

// ---------- 발소리: W 이동 중에는 남 ----------
console.log('--- 발소리: 이동 중 ---');
await keyDown('KeyW');
const movingPlaying = await pollAny(1500); // interval 0.38s * 3바퀴 여유
console.log(`${movingPlaying ? 'OK  ' : 'FAIL'} 이동 중 발소리 재생됨=${movingPlaying}`);
if (!movingPlaying) failures.push('이동 중인데 발소리가 한 번도 재생 안 됨(1.5초 대기)');
await keyUp('KeyW');

// ---------- 발소리: 다시 정지하면 멈춤 ----------
console.log('--- 발소리: 정지 복귀 ---');
await sleep(300); // 재생 중이던 짧은 클립(0.12s)이 끝날 시간
const stoppedPlaying = await pollAny(1000);
console.log(`${!stoppedPlaying ? 'OK  ' : 'FAIL'} 정지 복귀 후 발소리 재생됨=${stoppedPlaying}`);
if (stoppedPlaying) failures.push('키를 뗐는데 발소리가 계속 재생됨');

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');
console.log(failures.length ? `${failures.length}건 실패: ${failures.join(' / ')}` : '전부 통과');
} finally {
  await closeBrowser();
  server.close();
}
process.exit(failures.length ? 1 : 0);
