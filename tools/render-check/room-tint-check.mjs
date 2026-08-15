// M4 방별 바닥 톤 검증 — 주관적 육안 판정 대신 스크립트로 못박는다.
// m4-living/m4-bedA/m4-study/m4-bedB 4장(tools/render-check/m4-rooms.mjs가 생성)에서
// 바닥 영역을 두 군데 샘플링해 평균 RGB를 뽑고:
//   (a) 방 4개 쌍쌍이 서로 구분됨(채널 최대차 >= 12)
//   (b) 어느 방도 거실 평균 밝기의 60% 미만으로 어둡지 않음
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

// 바닥 샘플 영역 — 960x600 뷰포트(m4-rooms.mjs와 동일) 기준, 캐릭터 좌우
// 바로 옆 바닥을 잡는다(캐릭터는 항상 화면 중앙 부근에 렌더링됨).
// ⚠️ 처음엔 화면 하단 모서리(좌/우 끝)를 샘플링했는데, 거기는 비네트가
// 강하게 어둡게 눌러서 방마다 편차가 뒤죽박죽 나왔다(조명을 세게 조정해도
// 수치가 오히려 줄어드는 역설적인 결과가 남). 캐릭터 바로 옆, 비네트가
// 약한 화면 중앙대로 옮겨서 실제 조명 차이가 그대로 반영되게 함.
const PATCHES = [
  { x: 250, y: 430, w: 140, h: 60 },
  { x: 570, y: 430, w: 140, h: 60 },
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
        let r = 0, g = 0, b = 0, n = 0;
        for (const p of patches) {
          const data = ctx.getImageData(p.x, p.y, p.w, p.h).data;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
          }
        }
        resolve([r / n, g / n, b / n]);
      };
      if (img.complete) draw(); else img.onload = draw;
    });
  }, PATCHES);
}

const samples = {};
for (const [id, f] of Object.entries(files)) {
  samples[id] = await sampleFloor(f);
  console.log(`${id.padEnd(6)} RGB(${samples[id].map((v) => v.toFixed(1)).join(', ')})`);
}
await browser.close();

console.log('');
const failures = [];

// ---------- (a) 방 4개가 서로 구분됨: 모든 쌍의 채널 최대차 >= 12 ----------
for (let i = 0; i < ROOM_IDS.length; i++) {
  for (let j = i + 1; j < ROOM_IDS.length; j++) {
    const a = samples[ROOM_IDS[i]];
    const b = samples[ROOM_IDS[j]];
    const maxDiff = Math.max(...a.map((v, k) => Math.abs(v - b[k])));
    const ok = maxDiff >= 12;
    console.log(`${ok ? 'OK  ' : 'FAIL'} 구분: ${ROOM_IDS[i]} × ${ROOM_IDS[j]} — 채널 최대차 ${maxDiff.toFixed(1)}`);
    if (!ok) failures.push(`${ROOM_IDS[i]}×${ROOM_IDS[j]} 구분 안 됨(${maxDiff.toFixed(1)}<12)`);
  }
}

// ---------- (b) 어느 방도 거실 밝기의 60% 미만이 아님 ----------
const brightness = (rgb) => (rgb[0] + rgb[1] + rgb[2]) / 3;
const livingB = brightness(samples.living);
for (const id of ROOM_IDS) {
  if (id === 'living') continue;
  const ratio = brightness(samples[id]) / livingB;
  const ok = ratio >= 0.6;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 밝기: ${id} = 거실의 ${(ratio * 100).toFixed(1)}%`);
  if (!ok) failures.push(`${id} 밝기 부족(거실의 ${(ratio * 100).toFixed(1)}%)`);
}

console.log('');
console.log(failures.length ? `${failures.length}건 실패` : '전부 통과');
process.exit(failures.length ? 1 : 0);
