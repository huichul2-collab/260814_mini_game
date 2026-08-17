import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOM_IDS = ['living', 'bedA', 'study', 'bedB'];
function findChrome() {
  const c = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return c.find((p) => fs.existsSync(p));
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

async function getStats(pngPath) {
  const b64 = fs.readFileSync(pngPath).toString('base64');
  await page.setContent(`<img id="i" src="data:image/png;base64,${b64}"><canvas id="c" width="960" height="600"></canvas>`);
  await page.waitForSelector('#i');
  return page.evaluate(() => {
    const img = document.getElementById('i');
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, 960, 600).data;
    let r = 0, g = 0, b = 0;
    const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2];
    }
    return [+(r / total).toFixed(2), +(g / total).toFixed(2), +(b / total).toFixed(2)];
  });
}

console.log('=== 5회 연속 m4-rooms.mjs 실행 및 mean RGB 측정 ===\n');
const results = {};
for (const id of ROOM_IDS) results[id] = [];

for (let run = 1; run <= 5; run++) {
  console.log(`--- [Run ${run}/5] m4-rooms.mjs 실행 중... ---`);
  execSync('node tools/render-check/m4-rooms.mjs game', { stdio: 'inherit' });
  for (const id of ROOM_IDS) {
    const rgb = await getStats(`tools/render-check/m4-${id}.png`);
    results[id].push(rgb);
    console.log(`  Run ${run} ${id.padEnd(6)} mean RGB: [${rgb.join(', ')}]`);
  }
  console.log('');
}

await browser.close();

console.log('=== 5회 실행 측정 요약 ===');
for (const id of ROOM_IDS) {
  console.log(`\n[${id}]`);
  results[id].forEach((rgb, i) => {
    console.log(`  Run ${i + 1}: R=${rgb[0]}, G=${rgb[1]}, B=${rgb[2]}`);
  });
}
