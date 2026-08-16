// M4 방별 바닥 톤 검증 (2차 개정) — 주관적 육안 판정 대신 스크립트로 못박는다.
//
// ⚠️ 1차 버전(방 4개가 서로 구분되는지)은 잘못 설계된 수용기준이었다.
// "조명을 방마다 다르게" 채색해도 통과할 수 있었고, 실제로 그렇게
// 통과시켰다가 침실A 바닥이 오렌지 포인트라이트에 씻겨(overexpose)
// 클리핑 픽셀이 다른 방의 7~14배로 튀는 결과를 낳았다(사용자가 스크린샷
// 픽셀을 직접 재서 발견). 재는 지표를 "방끼리 다른가"가 아니라
// "재질 원본색이 화면에 얼마나 살아남는가"로 바꾼다 — 이건 조명 색을
// 다르게 칠해서 우회할 수 없다.
//
// m4-living/m4-bedA/m4-study/m4-bedB 4장(tools/render-check/m4-rooms.mjs가 생성)에서
// 바닥 영역을 두 군데 샘플링해:
//   (a) 각 방 R/G <= 1.8, B/G >= 0.55 (재질 원본 톤에서 크게 안 벗어남)
//   (b) 클리핑 픽셀(R/G/B 중 하나라도 >= 250) 비율 < 0.5%
//   (c) 어느 방도 거실 평균 휘도의 60% 미만으로 어둡지 않음
// PNG 디코딩은 별도 npm 패키지 없이, 이미 있는 puppeteer-core로 headless Chrome에
// <canvas>로 그려서 getImageData로 뽑는다(이 프로젝트 전체가 오프라인/무빌드 원칙).
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const dir = path.resolve(process.argv[2] || '.');
const ROOM_IDS = ['living', 'bedA', 'study', 'bedB'];
const files = Object.fromEntries(ROOM_IDS.map((id) => [id, path.join(dir, `m4-${id}.png`)]));

for (const [id, f] of Object.entries(files)) {
  if (!fs.existsSync(f)) {
    console.error(`FAIL: ${f} 없음 — 먼저 'node tools/render-check/m4-rooms.mjs <gameDir>'로 스크린샷을 생성해라`);
    process.exit(1);
  }
}

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

// 바닥 샘플 영역 — 960x600 뷰포트(m4-rooms.mjs와 동일) 기준. 두 번 헤맸다:
// (1) 캐릭터 바로 옆(x 250~710, y 430)은 living 한정으로 캐릭터 발밑
//     빨간 러그 소품과 겹쳐 오염됐다(m4-living.png에서 x~350~650을 덮음).
// (2) 그래서 화면 맨 가장자리(x 40/780)로 옮겼더니 이번엔 비네트 감쇠가
//     너무 강해(RGB가 10~40대로 거의 검정) 재질 원본색 판정에 부적합했다.
// 러그보다 위(y 380, 러그는 y>=420부터)이면서 화면 가장자리보다는 안쪽인
// 지점으로 절충 — 4개 방 전부에서 가구·러그·비네트를 피한 순수 바닥.
const PATCHES = [
  { x: 160, y: 380, w: 140, h: 60 },
  { x: 660, y: 380, w: 140, h: 60 },
];

async function sampleFloor(pngPath) {
  const b64 = fs.readFileSync(pngPath).toString('base64');
  await page.setContent(
    `<canvas id="c" width="960" height="600"></canvas><img id="i" src="data:image/png;base64,${b64}">`
  );
  await page.waitForSelector('#i');
  return page.evaluate((patches) => {
    return new Promise((resolve) => {
      const img = document.getElementById('i');
      const draw = () => {
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let r = 0, g = 0, b = 0, n = 0, clipped = 0;
        for (const p of patches) {
          const data = ctx.getImageData(p.x, p.y, p.w, p.h).data;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
            if (data[i] >= 250 || data[i + 1] >= 250 || data[i + 2] >= 250) clipped++;
          }
        }
        resolve({ rgb: [r / n, g / n, b / n], clipRatio: clipped / n });
      };
      if (img.complete) draw(); else img.onload = draw;
    });
  }, PATCHES);
}

const samples = {};
for (const [id, f] of Object.entries(files)) {
  samples[id] = await sampleFloor(f);
  const { rgb, clipRatio } = samples[id];
  console.log(
    `${id.padEnd(6)} RGB(${rgb.map((v) => v.toFixed(1)).join(', ')})  R/G=${(rgb[0] / rgb[1]).toFixed(2)}  B/G=${(rgb[2] / rgb[1]).toFixed(2)}  clip=${(clipRatio * 100).toFixed(2)}%`
  );
}
await browser.close();

console.log('');
const failures = [];

// ---------- (a) 재질 원본 톤 유지: R/G <= 1.8, B/G >= 0.55 ----------
for (const id of ROOM_IDS) {
  const [r, g, b] = samples[id].rgb;
  const rg = r / g;
  const bg = b / g;
  const rgOk = rg <= 1.8;
  const bgOk = bg >= 0.55;
  console.log(`${rgOk ? 'OK  ' : 'FAIL'} 톤: ${id} R/G=${rg.toFixed(2)} (<=1.8)`);
  console.log(`${bgOk ? 'OK  ' : 'FAIL'} 톤: ${id} B/G=${bg.toFixed(2)} (>=0.55)`);
  if (!rgOk) failures.push(`${id} R/G 과다(${rg.toFixed(2)}>1.8)`);
  if (!bgOk) failures.push(`${id} B/G 과소(${bg.toFixed(2)}<0.55)`);
}

// ---------- (b) 클리핑 픽셀 < 0.5% ----------
for (const id of ROOM_IDS) {
  const ratio = samples[id].clipRatio;
  const ok = ratio < 0.005;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 클리핑: ${id} = ${(ratio * 100).toFixed(2)}% (<0.5%)`);
  if (!ok) failures.push(`${id} 클리핑 과다(${(ratio * 100).toFixed(2)}%>=0.5%)`);
}

// ---------- (c) 어느 방도 거실 밝기의 60% 미만이 아님 ----------
const brightness = (rgb) => (rgb[0] + rgb[1] + rgb[2]) / 3;
const livingB = brightness(samples.living.rgb);
for (const id of ROOM_IDS) {
  if (id === 'living') continue;
  const ratio = brightness(samples[id].rgb) / livingB;
  const ok = ratio >= 0.6;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 밝기: ${id} = 거실의 ${(ratio * 100).toFixed(1)}%`);
  if (!ok) failures.push(`${id} 밝기 부족(거실의 ${(ratio * 100).toFixed(1)}%)`);
}

console.log('');
console.log(failures.length ? `${failures.length}건 실패` : '전부 통과');
process.exit(failures.length ? 1 : 0);
