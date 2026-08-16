#!/usr/bin/env node
// B-4a 마당 및 현관문, 울타리, 창문이 보이는 뷰포트 스크린샷 캡처 스크립트

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

// 카메라 위치를 마당과 현관문 D4가 잘 보이는 위치로 보정 (X=-10, Y=5, Z=4 -> LookAt X=-4, Y=0.5, Z=0)
await page.evaluate(() => {
  if (window.__debug && window.__debug.camera) {
    window.__debug.camera.position.set(-10.5, 5.5, 4.0);
    window.__debug.camera.lookAt(-4.0, 0.5, 0.0);
  }
});
await sleep(400);

const outPath = path.join(gameDir, '..', 'tools', 'render-check', 'm4-yard.png');
await page.screenshot({ path: outPath });
console.log(`마당 스크린샷 캡처 완료: ${outPath}`);

await browser.close();
server.close();
