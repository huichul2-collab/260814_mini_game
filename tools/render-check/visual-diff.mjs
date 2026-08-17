#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOM_IDS = ['living', 'bedA', 'study', 'bedB'];
const dir = path.resolve(process.argv[2] || 'tools/render-check');
const baselineDir = path.join(dir, 'baseline');

function findChrome() {
  const c = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return c.find((p) => fs.existsSync(p));
}

for (const id of ROOM_IDS) {
  const baseF = path.join(baselineDir, `m4-${id}.png`);
  const currF = path.join(dir, `m4-${id}.png`);
  if (!fs.existsSync(baseF)) {
    console.error(`FAIL: 기준 스크린샷 ${baseF} 없음 — baseline/ 폴더에 기준 이미지를 채워라`);
    process.exit(1);
  }
  if (!fs.existsSync(currF)) {
    console.error(`FAIL: 현재 스크린샷 ${currF} 없음 — 먼저 m4-rooms.mjs를 실행해라`);
    process.exit(1);
  }
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

async function analyzeImage(pngPath) {
  const b64 = fs.readFileSync(pngPath).toString('base64');
  await page.setContent(`<img id="i" src="data:image/png;base64,${b64}"><canvas id="c" width="960" height="600"></canvas>`);
  await page.waitForSelector('#i');
  return page.evaluate(() => {
    const img = document.getElementById('i');
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, 960, 600).data;

    let sumR = 0, sumG = 0, sumB = 0;
    const total = data.length / 4;
    const hist = new Array(64).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sumR += r;
      sumG += g;
      sumB += b;

      // 64-bin RGB color cube (4x4x4)
      const rBin = Math.min(3, Math.floor(r / 64));
      const gBin = Math.min(3, Math.floor(g / 64));
      const bBin = Math.min(3, Math.floor(b / 64));
      const binIdx = rBin * 16 + gBin * 4 + bBin;
      hist[binIdx]++;
    }

    return {
      meanR: sumR / total,
      meanG: sumG / total,
      meanB: sumB / total,
      hist,
    };
  });
}

function calcCorrelation(h1, h2) {
  const n = h1.length;
  let sum1 = 0, sum2 = 0;
  for (let i = 0; i < n; i++) {
    sum1 += h1[i];
    sum2 += h2[i];
  }
  const mean1 = sum1 / n;
  const mean2 = sum2 / n;

  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = h1[i] - mean1;
    const d2 = h2[i] - mean2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }
  const den = Math.sqrt(den1 * den2);
  return den === 0 ? 0 : num / den;
}

let failures = 0;
console.log('--- visual-diff (baseline/ ↔ current 비교) ---');

for (const id of ROOM_IDS) {
  const baseF = path.join(baselineDir, `m4-${id}.png`);
  const currF = path.join(dir, `m4-${id}.png`);

  const baseData = await analyzeImage(baseF);
  const currData = await analyzeImage(currF);

  const corr = calcCorrelation(baseData.hist, currData.hist);
  const diffR = Math.abs(baseData.meanR - currData.meanR);
  const diffG = Math.abs(baseData.meanG - currData.meanG);
  const diffB = Math.abs(baseData.meanB - currData.meanB);
  const maxDiff = Math.max(diffR, diffG, diffB);

  const corrOk = corr >= 0.98;
  const diffOk = maxDiff <= 3.0;
  const pass = corrOk && diffOk;

  if (pass) {
    console.log(
      `OK   ${id.padEnd(6)} 히스토그램 상관계수=${corr.toFixed(4)} (>=0.98), ` +
      `평균 RGB 차이=[R:${diffR.toFixed(2)}, G:${diffG.toFixed(2)}, B:${diffB.toFixed(2)}] (<=3.0)`
    );
  } else {
    console.error(
      `FAIL ${id.padEnd(6)} 시각 차이 감지 — ` +
      `상관계수=${corr.toFixed(4)} (${corrOk ? 'OK' : 'FAIL, >=0.98 필요'}), ` +
      `RGB 차이=[R:${diffR.toFixed(2)}, G:${diffG.toFixed(2)}, B:${diffB.toFixed(2)}] (${diffOk ? 'OK' : 'FAIL, <=3.0 필요'})`
    );
    failures++;
  }
}

await browser.close();

if (failures > 0) {
  console.error(`\nFAIL: 총 ${failures}개 방에서 시각 검증 실패 — merge 불가`);
  process.exit(1);
} else {
  console.log('\nOK: 모든 방 시각 검증 통과 (baseline과 시각적 동일)');
  process.exit(0);
}
