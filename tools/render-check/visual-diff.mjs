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

// 문턱값(사용자 확정, 2026-08-17, visual-shot.mjs 실측 노이즈 기반 재확정):
// 히스토그램 상관 >= 0.999, 채널별 평균 RGB 차이 <= 0.5.
// 근거: main 5회 실측 노이즈 최대 0.079의 6.3배 — 0.2(노이즈 대비 2.5배)는
// Chrome/드라이버 변화에 흔들릴 여지가 있어 기각하고, 소품 소실 신호(26)와는
// 50배 차이라 민감도는 충분하다고 판단한 값. baseline은 커밋된 PNG라
// 머신/Chrome 버전이 바뀌면 값이 통째로 밀릴 수 있다 — 그래서 통과/실패와
// 무관하게 항상 실측값을 출력한다(숫자가 안 보이면 그 시점에 원인을 못 찾는다).
const CORR_THRESHOLD = 0.999;
const RGB_DIFF_THRESHOLD = 0.5;

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

  const corrOk = corr >= CORR_THRESHOLD;
  const diffOk = maxDiff <= RGB_DIFF_THRESHOLD;
  const pass = corrOk && diffOk;

  // 항상 실측값을 출력 — pass/fail과 무관.
  console.log(
    `${pass ? 'OK  ' : 'FAIL'} ${id.padEnd(6)} 히스토그램 상관계수=${corr.toFixed(4)} (>=${CORR_THRESHOLD}, ${corrOk ? 'OK' : 'FAIL'}), ` +
    `평균 RGB 차이=[R:${diffR.toFixed(3)}, G:${diffG.toFixed(3)}, B:${diffB.toFixed(3)}] (<=${RGB_DIFF_THRESHOLD}, ${diffOk ? 'OK' : 'FAIL'})`
  );
  if (!pass) failures++;
}

await browser.close();

if (failures > 0) {
  console.error(`\nFAIL: 총 ${failures}개 방에서 시각 검증 실패 — merge 불가`);
  process.exit(1);
} else {
  console.log('\nOK: 모든 방 시각 검증 통과 (baseline과 시각적 동일)');
  process.exit(0);
}
