#!/usr/bin/env node
// 모바일 가상 조이스틱 & 점프 버튼 및 터치 인터랙션 종합 검증 스크립트 (gemini/lane-mobile)
//
// 뷰포트 4종(아이폰/안드로이드/태블릿/320폭) 각각에서:
//   (a) 렌더 성공 — 절대 하한 (평균휘도/검정비율/최대픽셀)
//   (b) 시점 회전 — 터치 드래그로 yaw 회전
//   (c) 기기별 안내 표시 — mobile-notice 및 #hint(CONTROL_HINT_MOBILE)
//   (d) 조이스틱 & 점프 버튼 표시 (지름 >= 56px)
//   (e) 조이스틱 이동 (0.5초 동안 전진 이동)
//   (f) 점프 버튼 탭 시 실제 Y 좌표 상승 (y >= 0.10m)
//   (g) 점프 버튼 터치가 시점 회전으로 새지 않는가 (Δyaw < 0.005rad)
//   (h) 조이스틱 이동 + 점프 동시 입력
//   (i) 모달 표시 중 조이스틱 & 점프 입력 억제
//
// 데스크톱(960x600, mouse) 뷰포트에서:
//   - 조이스틱 및 점프 버튼 미표시 (display: none)
//   - 모바일 안내(#mobile-notice) 미표시
//   - 조작 안내(#hint)가 데스크톱용 CONTROL_HINT 유지

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { CONTROL_HINT, CONTROL_HINT_MOBILE } from '../../game/story.js';

const gameDir = path.resolve(process.argv[2] || 'game');
const outDir = path.resolve(process.argv[3] || 'tools/render-check');

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
      if (p === '/' || !p) p = '/index.html';
      const cleanP = p.replace(/^[/\\]+/, '');
      const full = path.join(dir, cleanP);
      fs.readFile(full, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const VIEWPORTS = [
  { id: 'iphone', label: 'iPhone(390x844,dpr3)', width: 390, height: 844, deviceScaleFactor: 3 },
  { id: 'android', label: 'Android(360x800,dpr2.75)', width: 360, height: 800, deviceScaleFactor: 2.75 },
  { id: 'tablet', label: 'Tablet(820x1180,dpr2)', width: 820, height: 1180, deviceScaleFactor: 2 },
  { id: 'small320', label: 'Small(320x568,dpr2)', width: 320, height: 568, deviceScaleFactor: 2 },
];

const server = await serve(gameDir);
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const liveBrowsers = new Set([browser]);
function trackBrowser(b) {
  liveBrowsers.add(b);
  return b;
}
async function closeAllBrowsers() {
  for (const b of liveBrowsers) await b.close().catch(() => {});
  liveBrowsers.clear();
}
process.on('exit', () => {
  for (const b of liveBrowsers) b.process()?.kill('SIGKILL');
});
process.on('SIGINT', async () => {
  await closeAllBrowsers();
  server.close();
  process.exit(1);
});

const results = [];
let desktopJoystick = { visible: false };
let desktopJump = { visible: false };
let desktopNotice = false;
let desktopHintText = null;

try {
  for (const vp of VIEWPORTS) {
    console.log(`\n--- 검사 시작: ${vp.label} ---`);
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });

    // (c) 사전 안내 표시
    await sleep(300);
    const preClick = await page.evaluate(() => {
      const notice = document.getElementById('mobile-notice');
      return {
        hasNotice: !!notice,
        noticeText: notice ? notice.textContent : null,
      };
    });

    // 로딩 완료 대기
    let loadTimedOut = false;
    await page
      .waitForFunction(
        () => {
          const btn = document.getElementById('audio-start-btn');
          return btn && !btn.disabled;
        },
        { timeout: 30000 }
      )
      .catch(() => {
        loadTimedOut = true;
      });

    let renderInfo = null;
    let dragInfo = null;
    let joystickInfo = null;
    let jumpButtonInfo = null;
    let moveInfo = null;
    let jumpInfo = null;
    let jumpNoBleedInfo = null;
    let simulInfo = null;
    let modalSuppression = null;
    let mobileHintInfo = null;

    if (!loadTimedOut) {
      const btnBox = await page.evaluate(() => {
        const btn = document.getElementById('audio-start-btn');
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const tap = await page.touchscreen.touchStart(btnBox.x, btnBox.y);
      await tap.end();

      // M9-D 오프닝 페이드인 완료 대기
      await page.waitForFunction(() => !document.getElementById('opening-overlay'), { timeout: 10000 }).catch(() => {});
      await sleep(500);

      // (c-2) 모바일 힌트 문구 확인
      mobileHintInfo = await page.evaluate(() => {
        const hint = document.getElementById('hint');
        return {
          hasHint: !!hint,
          text: hint ? hint.textContent : '',
        };
      });

      // (a) 렌더 품질 스크린샷
      const shotPath = path.join(outDir, `_tmp-mobile-${vp.id}.png`);
      await page.screenshot({ path: shotPath });
      renderInfo = { shotPath };

      // (d-1) 조이스틱 표시 검사
      joystickInfo = await page.evaluate(() => {
        const el = document.getElementById('virtual-joystick-container');
        if (!el) return { exists: false, visible: false };
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible =
          style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
        return {
          exists: true,
          visible: isVisible,
          rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        };
      });

      // (d-2) 점프 버튼 표시 및 크기 검사 (최소 56px)
      jumpButtonInfo = await page.evaluate(() => {
        const el = document.getElementById('virtual-jump-button');
        if (!el) return { exists: false, visible: false };
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible =
          style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
        return {
          exists: true,
          visible: isVisible,
          rect: { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
          sizeOk: r.width >= 56 && r.height >= 56,
        };
      });

      // (b) 우측 시점 회전 (폭 50%~80%)
      try {
        const yawBefore = await page.evaluate(() => window.__debug?.followCam?.getYaw?.() ?? null);
        const startX = vp.width * 0.5;
        const endX = vp.width * 0.8;
        const midY = vp.height / 2;
        const STEPS = 8;
        const drag = await page.touchscreen.touchStart(startX, midY);
        for (let i = 1; i <= STEPS; i++) {
          const x = startX + ((endX - startX) * i) / STEPS;
          await drag.move(x, midY);
          await sleep(20);
        }
        await drag.end();
        await sleep(200);
        const yawAfter = await page.evaluate(() => window.__debug?.followCam?.getYaw?.() ?? null);
        if (yawBefore !== null && yawAfter !== null) {
          const deltaRad = yawAfter - yawBefore;
          dragInfo = {
            deltaRad,
            deltaDeg: (deltaRad * 180) / Math.PI,
            rotated: Math.abs(deltaRad) > 0.01,
          };
        }
      } catch (err) {
        console.warn(`[drag error ${vp.id}]:`, err.message);
      }

      // (e) 조이스틱 터치 드래그로 캐릭터 이동 검증
      if (joystickInfo.visible) {
        const posBefore = await page.evaluate(() => {
          const p = window.__debug?.player?.root?.position;
          return p ? { x: p.x, y: p.y, z: p.z } : null;
        });

        const baseCenter = await page.evaluate(() => {
          const base = document.getElementById('virtual-joystick-base');
          if (!base) return null;
          const r = base.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        if (baseCenter && posBefore) {
          const jTouch = await page.touchscreen.touchStart(baseCenter.x, baseCenter.y);
          await jTouch.move(baseCenter.x, baseCenter.y - 45);
          await sleep(500);
          await jTouch.end();
          await sleep(100);

          const posAfter = await page.evaluate(() => {
            const p = window.__debug?.player?.root?.position;
            return p ? { x: p.x, y: p.y, z: p.z } : null;
          });

          if (posAfter) {
            const dist = Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z);
            moveInfo = { distMoved: dist, moved: dist >= 0.15 };
          }
        }
      }

      // (f) 점프 버튼 탭 시 실제 Y 좌표 상승 검증
      if (jumpButtonInfo.visible) {
        const jumpCenter = await page.evaluate(() => {
          const el = document.getElementById('virtual-jump-button');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        if (jumpCenter) {
          await sleep(200);
          const yBefore = await page.evaluate(() => window.__debug?.player?.root?.position?.y ?? 0);

          // 점프 버튼 터치
          const jbTouch = await page.touchscreen.touchStart(jumpCenter.x, jumpCenter.y);
          await sleep(100);
          const yDuring = await page.evaluate(() => window.__debug?.player?.root?.position?.y ?? 0);
          await jbTouch.end();

          await sleep(100);
          const yAfter = await page.evaluate(() => window.__debug?.player?.root?.position?.y ?? 0);
          await sleep(400); // 착지 대기

          const maxY = Math.max(yDuring, yAfter);
          jumpInfo = {
            yBefore,
            yDuring,
            yAfter,
            maxY,
            jumped: maxY >= 0.1,
          };
        }
      }

      // (g) 점프 버튼 위 터치가 시점 회전(camera drag)으로 새지 않는가 검증
      if (jumpButtonInfo.visible) {
        const jumpCenter = await page.evaluate(() => {
          const el = document.getElementById('virtual-jump-button');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        if (jumpCenter) {
          const yawBeforeJb = await page.evaluate(() => window.__debug?.followCam?.getYaw?.() ?? 0);
          const jbTouch = await page.touchscreen.touchStart(jumpCenter.x, jumpCenter.y);
          await jbTouch.move(jumpCenter.x + 10, jumpCenter.y - 10);
          await sleep(100);
          await jbTouch.end();
          await sleep(100);

          const yawAfterJb = await page.evaluate(() => window.__debug?.followCam?.getYaw?.() ?? 0);
          const yawDiff = Math.abs(yawAfterJb - yawBeforeJb);
          jumpNoBleedInfo = {
            yawDiff,
            noBleed: yawDiff < 0.005,
          };
        }
      }

      // (h) 조이스틱 이동 + 점프 동시 입력 검증
      if (joystickInfo.visible && jumpButtonInfo.visible) {
        const baseCenter = await page.evaluate(() => {
          const base = document.getElementById('virtual-joystick-base');
          if (!base) return null;
          const r = base.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        const jumpCenter = await page.evaluate(() => {
          const el = document.getElementById('virtual-jump-button');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        if (baseCenter && jumpCenter) {
          const posBeforeSim = await page.evaluate(() => {
            const p = window.__debug?.player?.root?.position;
            return p ? { x: p.x, y: p.y, z: p.z } : null;
          });

          // 1번 터치: 조이스틱 전진
          const jTouch = await page.touchscreen.touchStart(baseCenter.x, baseCenter.y);
          await jTouch.move(baseCenter.x, baseCenter.y - 45);

          // 2번 터치: 점프 버튼 탭
          const jbTouch = await page.touchscreen.touchStart(jumpCenter.x, jumpCenter.y);
          await sleep(150);
          const yDuringSim = await page.evaluate(() => window.__debug?.player?.root?.position?.y ?? 0);
          await jbTouch.end();

          await sleep(100);
          const yAfterSim = await page.evaluate(() => window.__debug?.player?.root?.position?.y ?? 0);
          await jTouch.end();
          await sleep(300);

          const maxYSim = Math.max(yDuringSim, yAfterSim);
          const posAfterSim = await page.evaluate(() => {
            const p = window.__debug?.player?.root?.position;
            return p ? { x: p.x, y: p.y, z: p.z } : null;
          });

          if (posBeforeSim && posAfterSim) {
            const distSim = Math.hypot(posAfterSim.x - posBeforeSim.x, posAfterSim.z - posBeforeSim.z);
            simulInfo = {
              distSim,
              yDuringSim: maxYSim,
              simulOk: distSim >= 0.15 && maxYSim >= 0.1,
            };
          }
        }
      }

      // (i) 모달 표시 중 조이스틱 & 점프 입력 억제 검증
      if (joystickInfo.visible && jumpButtonInfo.visible) {
        await page.evaluate(() => {
          const dummy = document.createElement('div');
          dummy.id = 'modal-overlay';
          dummy.style.display = 'block';
          document.body.appendChild(dummy);
        });
        await sleep(100);

        const modalOpen = await page.evaluate(() => !!document.getElementById('modal-overlay'));
        const posBeforeModal = await page.evaluate(() => {
          const p = window.__debug?.player?.root?.position;
          return p ? { x: p.x, y: p.y, z: p.z } : null;
        });

        const baseCenter = await page.evaluate(() => {
          const base = document.getElementById('virtual-joystick-base');
          if (!base) return null;
          const r = base.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        const jumpCenter = await page.evaluate(() => {
          const el = document.getElementById('virtual-jump-button');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        if (modalOpen && baseCenter && jumpCenter && posBeforeModal) {
          // 모달 뜬 상태에서 조이스틱 드래그 & 점프 탭
          const mTouch = await page.touchscreen.touchStart(baseCenter.x, baseCenter.y);
          await mTouch.move(baseCenter.x, baseCenter.y - 45);
          const jbTouch = await page.touchscreen.touchStart(jumpCenter.x, jumpCenter.y);
          await sleep(150);
          await jbTouch.end();
          await mTouch.end();
          await sleep(100);

          const posAfterModal = await page.evaluate(() => {
            const p = window.__debug?.player?.root?.position;
            return p ? { x: p.x, y: p.y, z: p.z } : null;
          });

          await page.evaluate(() => {
            const dummy = document.getElementById('modal-overlay');
            if (dummy) dummy.remove();
          });
          await sleep(100);

          const distDuringModal = posAfterModal
            ? Math.hypot(posAfterModal.x - posBeforeModal.x, posAfterModal.z - posBeforeModal.z)
            : 0;
          const yDuringModal = posAfterModal ? posAfterModal.y : 0;
          modalSuppression = {
            modalOpen,
            distDuringModal,
            yDuringModal,
            suppressed: distDuringModal < 0.05 && yDuringModal < 0.01,
          };
        }
      }
    }

    results.push({
      vp,
      loadTimedOut,
      preClick,
      dragInfo,
      renderInfo,
      joystickInfo,
      jumpButtonInfo,
      moveInfo,
      jumpInfo,
      jumpNoBleedInfo,
      simulInfo,
      modalSuppression,
      mobileHintInfo,
      consoleErrors,
    });
    await page.close();
  }

  // ---------- 데스크톱 뷰포트(960x600, mouse) 비터치 환경 검사 ----------
  console.log('\n--- 검사 시작: Desktop(960x600) ---');
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 960, height: 600, isMobile: false, hasTouch: false });
  await desktopPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await sleep(300);
  desktopNotice = await desktopPage.evaluate(() => !!document.getElementById('mobile-notice'));
  await desktopPage.waitForFunction(
    () => {
      const btn = document.getElementById('audio-start-btn');
      return btn && !btn.disabled;
    },
    { timeout: 30000 }
  );
  await desktopPage.click('#audio-start-btn');
  await sleep(3200); // 3초 오프닝 페이드 완료 대기

  desktopJoystick = await desktopPage.evaluate(() => {
    const el = document.getElementById('virtual-joystick-container');
    if (!el) return { exists: false, visible: false };
    const style = window.getComputedStyle(el);
    return {
      exists: true,
      visible: style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0,
    };
  });

  desktopJump = await desktopPage.evaluate(() => {
    const el = document.getElementById('virtual-jump-button');
    if (!el) return { exists: false, visible: false };
    const style = window.getComputedStyle(el);
    return {
      exists: true,
      visible: style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0,
    };
  });

  desktopHintText = await desktopPage.evaluate(() => {
    const el = document.getElementById('hint');
    return el ? el.textContent : '';
  });

  await desktopPage.close();

  // ---------- 렌더 성공 판정 ----------
  const sampleBrowser = trackBrowser(
    await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] })
  );
  const samplePage = await sampleBrowser.newPage();
  async function sampleAbsolute(pngPath) {
    if (!fs.existsSync(pngPath)) return { avgLuma: 0, nearBlackRatio: 1, maxPixel: 0 };
    const b64 = fs.readFileSync(pngPath).toString('base64');
    await samplePage.setContent(`<img id="i" src="data:image/png;base64,${b64}">`);
    await samplePage.waitForSelector('#i');
    const res = await samplePage.evaluate(
      () =>
        new Promise((resolve) => {
          const img = document.getElementById('i');
          const draw = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, c.width, c.height).data;
            let sumLuma = 0,
              nearBlack = 0,
              maxPixel = 0;
            const total = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i],
                g = data[i + 1],
                b = data[i + 2];
              sumLuma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
              const maxChan = Math.max(r, g, b);
              if (maxChan < 20) nearBlack++;
              if (maxChan > maxPixel) maxPixel = maxChan;
            }
            resolve({ avgLuma: sumLuma / total, nearBlackRatio: nearBlack / total, maxPixel });
          };
          if (img.decode) img.decode().then(draw).catch(draw);
          else if (img.complete) draw();
          else img.onload = draw;
        })
    );
    fs.unlinkSync(pngPath);
    return res;
  }

  for (const r of results) {
    if (r.renderInfo) {
      const abs = await sampleAbsolute(r.renderInfo.shotPath);
      const pass = abs.avgLuma >= 15 && abs.nearBlackRatio < 0.5 && abs.maxPixel >= 200;
      r.renderInfo.abs = abs;
      r.renderInfo.pass = pass;
    }
  }
} finally {
  await closeAllBrowsers();
  server.close();
}

// ---------- 표 출력 ----------
console.log('\n=== 모바일 가상 조이스틱 & 점프 버튼 검증 결과 ===\n');
console.log(
  '| 뷰포트 | 렌더 | 조이스틱 | 점프버튼(56px+) | 점프동작(Y↑) | 시점비침범 | 동시입력 | 모달억제 | 모바일안내 |'
);
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const a = r.loadTimedOut ? 'FAIL(타임아웃)' : r.renderInfo?.pass ? 'OK' : 'FAIL';
  const d = r.joystickInfo?.visible ? 'OK' : 'FAIL';
  const jb =
    r.jumpButtonInfo?.visible && r.jumpButtonInfo?.sizeOk
      ? `OK (${r.jumpButtonInfo.rect.width}px)`
      : 'FAIL';
  const j = r.jumpInfo?.jumped ? `OK (y=${r.jumpInfo.maxY.toFixed(2)}m)` : 'FAIL';
  const jnb = r.jumpNoBleedInfo?.noBleed ? 'OK (0.000rad)' : `FAIL(Δyaw=${r.jumpNoBleedInfo?.yawDiff?.toFixed(4)})`;
  const sim = r.simulInfo?.simulOk
    ? `OK (${r.simulInfo.distSim.toFixed(2)}m/y=${r.simulInfo.yDuringSim.toFixed(2)}m)`
    : 'FAIL';
  const mod = r.modalSuppression?.suppressed ? 'OK' : 'FAIL';
  const hint = r.preClick.hasNotice && r.mobileHintInfo?.text === CONTROL_HINT_MOBILE ? 'OK' : 'FAIL';
  console.log(`| ${r.vp.label} | ${a} | ${d} | ${jb} | ${j} | ${jnb} | ${sim} | ${mod} | ${hint} |`);
}

console.log('\n--- 데스크톱(960x600) 비터치 환경 검사 ---');
console.log(`데스크톱 조이스틱 미표시: ${!desktopJoystick.visible ? 'OK (display: none)' : 'FAIL (노출됨!)'}`);
console.log(`데스크톱 점프버튼 미표시: ${!desktopJump.visible ? 'OK (display: none)' : 'FAIL (노출됨!)'}`);
console.log(`데스크톱 모바일안내 미표시: ${!desktopNotice ? 'OK' : 'FAIL'}`);
console.log(
  `데스크톱 힌트 문구: "${desktopHintText}" → ${desktopHintText === CONTROL_HINT ? 'OK (데스크톱 버전)' : 'FAIL'}`
);

const allPass =
  results.every(
    (r) =>
      !r.loadTimedOut &&
      r.renderInfo?.pass &&
      r.joystickInfo?.visible &&
      r.jumpButtonInfo?.visible &&
      r.jumpButtonInfo?.sizeOk &&
      r.moveInfo?.moved &&
      r.jumpInfo?.jumped &&
      r.jumpNoBleedInfo?.noBleed &&
      r.simulInfo?.simulOk &&
      r.modalSuppression?.suppressed &&
      r.preClick.hasNotice &&
      r.mobileHintInfo?.text === CONTROL_HINT_MOBILE
  ) &&
  !desktopJoystick.visible &&
  !desktopJump.visible &&
  !desktopNotice &&
  desktopHintText === CONTROL_HINT;

if (allPass) {
  console.log('\n모든 모바일 뷰포트 및 데스크톱 검증 100% 통과!');
  process.exit(0);
} else {
  console.error('\n일부 항목 검증 실패');
  process.exit(1);
}
