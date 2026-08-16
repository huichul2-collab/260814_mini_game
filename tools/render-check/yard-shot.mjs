#!/usr/bin/env node
// B-4a 마당 현관문 통과, 울타리 충돌, 3개 창문 뷰포트 검증 및 스크린샷 캡처 스크립트

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

const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await sleep(800);
await page.click('#audio-start-btn').catch(() => {});
await sleep(500);

function getPos() {
  return page.evaluate(() => {
    const p = window.__debug.player.root.position;
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

let failures = 0;
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
testResult('현관문 D4 통과 마당 진입', yardWalk.ok && yardWalk.pos.x < -3.2, `최종 위치 X=${yardWalk.pos.x.toFixed(2)}, Z=${yardWalk.pos.z.toFixed(2)}`);

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

// ---------- 3. 창문 3개 (W1, W2, W3) 방향 스크린샷 촬영 ----------
console.log('--- 3. 창문 3개 (W1, W2, W3) 스크린샷 촬영 ---');

// W1: bedA 북쪽 창문 (Z = -7, X = -0.5)
await setPlayerPos(-0.5, 0, -5.8);
await keyDown('KeyW');
await sleep(150);
await keyUp('KeyW');
await sleep(1200);
const winBedAPath = path.join(gameDir, '..', 'tools', 'render-check', 'm4-win-bedA.png');
await page.screenshot({ path: winBedAPath });
console.log(`OK   W1 (bedA 북창문) 스크린샷 캡처: ${winBedAPath}`);

// W2: study 동쪽 창문 (X = 7, Z = 0.5)
await setPlayerPos(5.8, 0, 0.5);
await keyDown('KeyD');
await sleep(150);
await keyUp('KeyD');
await sleep(1200);
const winStudyPath = path.join(gameDir, '..', 'tools', 'render-check', 'm4-win-study.png');
await page.screenshot({ path: winStudyPath });
console.log(`OK   W2 (study 동창문) 스크린샷 캡처: ${winStudyPath}`);

// W3: bedB 남쪽 창문 (Z = 7, X = 0.0)
await setPlayerPos(0.0, 0, 5.8);
await keyDown('KeyS');
await sleep(150);
await keyUp('KeyS');
await sleep(1200);
const winBedBPath = path.join(gameDir, '..', 'tools', 'render-check', 'm4-win-bedB.png');
await page.screenshot({ path: winBedBPath });
console.log(`OK   W3 (bedB 남창문) 스크린샷 캡처: ${winBedBPath}`);

await browser.close();
server.close();

console.log('');
console.log(failures === 0 ? '마당 및 창문 검증 전부 통과' : `마당 및 창문 검증 ${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
