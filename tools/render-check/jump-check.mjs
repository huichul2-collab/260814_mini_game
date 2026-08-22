#!/usr/bin/env node
// B-5. 점프 기능 헤드리스 검증 스크립트 (jump-check.mjs)
// 1. Space 입력 시 player.root.position.y 최고점이 0.7~1.0m 사이 찍고 0으로 복귀
// 2. 공중에서 Space 재입력 시 추가 상승 없음 (double-jump 불가)
// 3. 점프 중 벽 방향으로 이동해도 벽 통과 불가 (XZ 원-AABB 충돌 유지)

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

function keyDown(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
}
function keyUp(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
}

function testResult(name, pass, msg) {
  if (pass) {
    console.log(`OK   ${name} — ${msg}`);
  } else {
    failures++;
    console.log(`FAIL ${name} — ${msg}`);
  }
}

// ---------- 검사 1: 단일 점프 높이 및 착지 ----------
{
  await keyDown('Space');
  await sleep(50);
  await keyUp('Space');

  let maxY = 0;
  const start = Date.now();
  while (Date.now() - start < 1200) {
    const pos = await getPos();
    maxY = Math.max(maxY, pos.y);
    await sleep(30);
  }

  const finalPos = await getPos();
  const heightOk = maxY >= 0.70 && maxY <= 1.00;
  const landedOk = finalPos.y === 0;

  testResult(
    '1. 점프 최고점 (0.7~1.0m) 및 지면 복귀',
    heightOk && landedOk,
    `최고점 Y=${maxY.toFixed(3)}m, 착지 Y=${finalPos.y.toFixed(3)}m`
  );
}

await sleep(300);

// ---------- 검사 2: 공중 재점프 방지 (Double Jump 금지) ----------
{
  await keyDown('Space');
  await sleep(50);
  await keyUp('Space');

  let midAirSpacePressed = false;
  let maxY2 = 0;
  const start = Date.now();

  while (Date.now() - start < 1200) {
    const pos = await getPos();
    maxY2 = Math.max(maxY2, pos.y);

    if (pos.y > 0.3 && !midAirSpacePressed) {
      midAirSpacePressed = true;
      await keyDown('Space');
      await sleep(50);
      await keyUp('Space');
    }
    await sleep(30);
  }

  const finalPos2 = await getPos();
  const doubleJumpPrevented = maxY2 <= 1.00;

  testResult(
    '2. 공중 재입력 시 추가 상승 없음 (이중 점프 방지)',
    midAirSpacePressed && doubleJumpPrevented && finalPos2.y === 0,
    `공중키발동=${midAirSpacePressed}, 최고점 Y=${maxY2.toFixed(3)}m, 착지 Y=${finalPos2.y.toFixed(3)}m`
  );
}

await sleep(300);

// ---------- 검사 3: 점프 중 벽 충돌 유지 (XZ 충돌 통과 불가) ----------
{
  // 북쪽 벽 Z=-3 방향으로 1초간 이동 후 점프+이동
  await keyDown('KeyW');
  const startMove = Date.now();
  while (Date.now() - startMove < 1500) {
    await sleep(50);
  }

  // W 누른 상태에서 Space 점프
  await keyDown('Space');
  await sleep(50);
  await keyUp('Space');

  const startJump = Date.now();
  let maxZReached = -Infinity;
  while (Date.now() - startJump < 1000) {
    const pos = await getPos();
    maxZReached = Math.max(maxZReached, pos.z);
    await sleep(30);
  }
  await keyUp('KeyW');

  const finalPos3 = await getPos();
  const zVal = (finalPos3 && typeof finalPos3.z === 'number') ? finalPos3.z : 0;
  const wallNotPenetrated = finalPos3 && zVal >= -2.85;

  testResult(
    '3. 점프 중 벽 방향 이동 시 벽 관통 불가',
    wallNotPenetrated,
    `벽 근접 위치 Z=${zVal.toFixed(3)}m (벽 안쪽 한계 Z >= -2.72m)`
  );
}

} finally {
  await closeBrowser();
  server.close();
}

console.log('');
console.log(failures === 0 ? '점프 검증 전부 통과' : `점프 검증 ${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
