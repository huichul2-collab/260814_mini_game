#!/usr/bin/env node
// M4 집 4칸 구조 검증 — 방 4개 중앙 도달성 + 문 가장자리(0.25m 안쪽) 통과성.
// docs/spec/M4-layout.md §6.2 수용기준을 실제 주행(인공 키 입력)으로 검증한다.
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
page.on('pageerror', (e) => {
  if (!e.message.includes('linearRampToValueAtTime')) logs.push(`[pageerror] ${e.message}`);
});
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });

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
const loadingStillThere = await page.evaluate(() => !!document.getElementById('loading'));
console.log('[m4-rooms] loading element still in DOM:', loadingStillThere);

function getPos() {
  return page.evaluate(() => {
    if (!window.__debug || !window.__debug.player || !window.__debug.player.root || !window.__debug.player.root.position) return null;
    const p = window.__debug.player.root.position;
    if (typeof p.x !== 'number' || typeof p.z !== 'number') return null;
    return { x: p.x, z: p.z };
  });
}
function keyDown(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
}
function keyUp(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
}

async function walkTo(target, { tol = 0.3, timeoutMs = 20000, pollMs = 150 } = {}) {
  const held = new Set();
  async function setHeld(wanted) {
    for (const k of held) if (!wanted.has(k)) { await keyUp(k); held.delete(k); }
    for (const k of wanted) if (!held.has(k)) { await keyDown(k); held.add(k); }
  }
  const start = Date.now();
  let pos = await getPos();
  while (!pos && Date.now() - start < timeoutMs) {
    await sleep(200);
    pos = await getPos();
  }
  if (!pos) return { ok: false, pos: { x: 0, z: 0 }, ms: timeoutMs };

  while (Date.now() - start < timeoutMs) {
    pos = await getPos();
    if (!pos) { await sleep(pollMs); continue; }
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
  return { ok: false, pos: (await getPos()) || { x: 0, z: 0 }, ms: Date.now() - start };
}

let failures = 0;
async function leg(name, target, shotPath = null) {
  const r = await walkTo(target);
  const tag = r.ok ? 'OK ' : 'FAIL';
  if (!r.ok) failures++;
  const px = (r && r.pos && typeof r.pos.x === 'number') ? r.pos.x.toFixed(2) : '0.00';
  const pz = (r && r.pos && typeof r.pos.z === 'number') ? r.pos.z.toFixed(2) : '0.00';
  const ms = r ? r.ms : 0;
  console.log(`${tag} ${name} → 목표(${target.x},${target.z}) 실제(${px},${pz}) ${ms}ms`);
  if (shotPath) {
    await sleep(800);
    await page.screenshot({ path: shotPath });
  }
  return r;
}

const outDir = path.join(gameDir, '..', 'tools', 'render-check');

console.log('--- 방 중앙 도달 ---');
await sleep(2000);
await leg('living(spawn 확인)', { x: 0, z: 0 }, path.join(outDir, 'm4-living.png'));
await leg('bedA', { x: -0.5, z: -5.0 }, path.join(outDir, 'm4-bedA.png'));
await leg('bedA→living', { x: 0, z: 0 });
await leg('study', { x: 5.0, z: 0.5 }, path.join(outDir, 'm4-study.png'));
await leg('study→living', { x: 0, z: 0 });
await leg('bedB', { x: 0.0, z: 5.0 }, path.join(outDir, 'm4-bedB.png'));
await leg('bedB→living', { x: 0, z: 0 });

console.log('--- 문 가장자리 통과(0.25m 안쪽) ---');
await leg('D1 가장자리 → bedA', { x: -0.9, z: -3.6 });
await leg('D1 가장자리 → living', { x: 0, z: 0 });
await leg('D2 가장자리 → study', { x: 5.0, z: 0.1 });
await leg('D2 가장자리 → living', { x: 0, z: 0 });
await leg('D3 가장자리 → bedB', { x: -0.4, z: 5.0 });
await leg('D3 가장자리 → living', { x: 0, z: 0 });

await browser.close();
server.close();

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');
console.log(`총 13개 구간, 실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
