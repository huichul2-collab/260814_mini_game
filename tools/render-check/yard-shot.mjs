#!/usr/bin/env node
// B-4a 마당 현관문 통과, 울타리 충돌, 3개 창문 뷰포트 및 창문 충돌 검증 스크립트

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2] || './game');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
};

function findChrome() {
  const c = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return c.find((p) => fs.existsSync(p));
}

function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const full = path.join(dir, p);
      fs.readFile(full, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
        });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

let failures = 0;
try {
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
page.on('pageerror', (e) => {
  if (!e.message.includes('linearRampToValueAtTime')) console.warn(`[pageerror] ${e.message}`);
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.evaluate(() => {
  const btn = document.getElementById('audio-start-btn');
  if (btn) btn.click();
});
await sleep(2000);
await page.waitForSelector('#loading', { hidden: true, timeout: 10000 }).catch(() => {});
await sleep(500);

function getPos() {
  return page.evaluate(() => {
    if (!window.__debug || !window.__debug.player || !window.__debug.player.root || !window.__debug.player.root.position) return null;
    const p = window.__debug.player.root.position;
    if (typeof p.x !== 'number' || typeof p.z !== 'number') return null;
    return { x: p.x, y: p.y, z: p.z };
  });
}

function setPlayerPos(x, y, z) {
  return page.evaluate((px, py, pz) => {
    window.__debug.player.root.position.set(px, py, pz);
  }, x, y, z);
}

function keyDown(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
}
function keyUp(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
}

async function walkTo(target, { tol = 0.3, timeoutMs = 15000, pollMs = 100 } = {}) {
  const held = new Set();
  async function setHeld(wanted) {
    for (const k of held) if (!wanted.has(k)) { await keyUp(k); held.delete(k); }
    for (const k of wanted) if (!held.has(k)) { await keyDown(k); held.add(k); }
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await getPos();
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    if (Math.hypot(dx, dz) < tol) { await setHeld(new Set()); return { ok: true, pos }; }
    const wanted = new Set();
    if (dx > 0.05) wanted.add('KeyD'); else if (dx < -0.05) wanted.add('KeyA');
    if (dz > 0.05) wanted.add('KeyS'); else if (dz < -0.05) wanted.add('KeyW');
    await setHeld(wanted);
    await sleep(pollMs);
  }
  await setHeld(new Set());
  return { ok: false, pos: await getPos() };
}

function testResult(name, pass, msg) {
  if (pass) {
    console.log(`OK   ${name} — ${msg}`);
  } else {
    failures++;
    console.log(`FAIL ${name} — ${msg}`);
  }
}

// ---------- 1. 거실에서 현관문 D4(X=-3, Z=0)를 지나 마당(X=-5, Z=0)으로 걸어가기 ----------
console.log('--- 1. 현관문 통과 주행 ---');
await walkTo({ x: 0, z: 0 });
const yardWalk = await walkTo({ x: -5, z: 0 });
const yardX = (yardWalk && yardWalk.pos && typeof yardWalk.pos.x === 'number') ? yardWalk.pos.x : 0;
const yardZ = (yardWalk && yardWalk.pos && typeof yardWalk.pos.z === 'number') ? yardWalk.pos.z : 0;
testResult('현관문 D4 통과 마당 진입', yardWalk.ok && yardX < -3.2, `최종 위치 X=${yardX.toFixed(2)}, Z=${yardZ.toFixed(2)}`);

// 카메라가 플레이어 뒤에서 완전히 정착하도록 대기
await sleep(1200);

const yardShotPath = path.join(gameDir, '..', 'tools', 'render-check', 'm4-yard.png');
await page.screenshot({ path: yardShotPath });
console.log(`OK   마당 스크린샷 캡처: ${yardShotPath}`);

// ---------- 2. 울타리 3면 충돌 검증 (울타리 밖 탈출 불가) ----------
console.log('--- 2. 마당 울타리 3면 충돌 검증 ---');

// (a) 서쪽 울타리 (X = -7) 로 이동 시도
await keyDown('KeyA');
await sleep(1500);
await keyUp('KeyA');
const westPos = await getPos();
const westFenceOk = westPos.x >= -6.80;
testResult('서쪽 울타리(X=-7) 충돌 차단', westFenceOk, `울타리 밀착 X=${westPos.x.toFixed(2)}m (>= -6.80m)`);

// (b) 북쪽 울타리 (Z = -2.5) 로 이동 시도
await setPlayerPos(-5.0, 0, 0);
await sleep(200);
await keyDown('KeyW');
await sleep(1500);
await keyUp('KeyW');
const northPos = await getPos();
const northFenceOk = northPos.z >= -2.30;
testResult('북쪽 울타리(Z=-2.5) 충돌 차단', northFenceOk, `울타리 밀착 Z=${northPos.z.toFixed(2)}m (>= -2.30m)`);

// (c) 남쪽 울타리 (Z = 2.5) 로 이동 시도
await setPlayerPos(-5.0, 0, 0);
await sleep(200);
await keyDown('KeyS');
await sleep(1500);
await keyUp('KeyS');
const southPos = await getPos();
const southFenceOk = southPos.z <= 2.30;
testResult('남쪽 울타리(Z=2.5) 충돌 차단', southFenceOk, `울타리 밀착 Z=${southPos.z.toFixed(2)}m (<= 2.30m)`);

// ---------- 3. 창문 3개 (W1, W2, W3) 충돌 및 관람 스크린샷 ----------
console.log('--- 3. 창문 3개 충돌 검증 및 스크린샷 촬영 ---');

// (a) W1 bedA 북창문 (Z = -7, X = -0.5) 3초간 돌진 및 탈출 불가 검증
await setPlayerPos(-0.5, 0, -5.8);
await sleep(200);
await keyDown('KeyW');
await sleep(3000);
await keyUp('KeyW');
const w1Pos = await getPos();
const w1Ok = w1Pos.z >= -6.80;
testResult('W1 창문(bedA 북벽) 3초 돌진 탈출 불가', w1Ok, `최종 Z=${w1Pos.z.toFixed(2)}m (방 내부 Z >= -6.80m)`);

// W1 외부 시점 스크린샷 (집 밖 Z=-8.5에서 남쪽 북벽 W1 관람)
await setPlayerPos(-0.5, 0, -8.5);
await keyDown('KeyS');
await sleep(150);
await keyUp('KeyS');
await sleep(1200);
const winBedAPath = path.join(gameDir, '..', 'tools', 'render-check', 'm4-win-bedA.png');
await page.screenshot({ path: winBedAPath });
console.log(`OK   W1 (bedA 북창문 외부 시점) 스크린샷 캡처: ${winBedAPath}`);

// (b) W2 study 동창문 (X = 7, Z = 0.5) 3초간 돌진 및 탈출 불가 검증
await setPlayerPos(5.8, 0, 0.5);
await sleep(200);
await keyDown('KeyD');
await sleep(3000);
await keyUp('KeyD');
const w2Pos = await getPos();
const w2Ok = w2Pos.x <= 6.80;
testResult('W2 창문(study 동벽) 3초 돌진 탈출 불가', w2Ok, `최종 X=${w2Pos.x.toFixed(2)}m (방 내부 X <= 6.80m)`);

// W2 외부 시점 스크린샷 (집 밖 X=8.5에서 서쪽 동벽 W2 관람)
await setPlayerPos(8.5, 0, 0.5);
await keyDown('KeyA');
await sleep(150);
await keyUp('KeyA');
await sleep(1200);
const winStudyPath = path.join(gameDir, '..', 'tools', 'render-check', 'm4-win-study.png');
await page.screenshot({ path: winStudyPath });
console.log(`OK   W2 (study 동창문 외부 시점) 스크린샷 캡처: ${winStudyPath}`);

// (c) W3 bedB 남창문 (Z = 7, X = 0.0) 3초간 돌진 및 탈출 불가 검증
await setPlayerPos(0.0, 0, 5.8);
await sleep(200);
await keyDown('KeyS');
await sleep(3000);
await keyUp('KeyS');
const w3Pos = await getPos();
const w3Ok = w3Pos.z <= 6.80;
testResult('W3 창문(bedB 남벽) 3초 돌진 탈출 불가', w3Ok, `최종 Z=${w3Pos.z.toFixed(2)}m (방 내부 Z <= 6.80m)`);

// W3 실내 시점 스크린샷 (실내 Z=5.2에서 남쪽 창밖 관람)
await setPlayerPos(0.0, 0, 5.2);
await keyDown('KeyS');
await sleep(150);
await keyUp('KeyS');
await sleep(1200);
const winBedBPath = path.join(gameDir, '..', 'tools', 'render-check', 'm4-win-bedB.png');
await page.screenshot({ path: winBedBPath });
console.log(`OK   W3 (bedB 남창문 실내 시점) 스크린샷 캡처: ${winBedBPath}`);
} finally {
  await closeBrowser();
  server.close();
}

console.log('');
console.log(failures === 0 ? '마당 및 창문 검증 전부 통과' : `마당 및 창문 검증 ${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
