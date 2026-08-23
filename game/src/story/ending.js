/* ------------------------------------------------------------------ *
 *  game/src/story/ending.js — 엔딩 트리거 & 페이드아웃 연출 (M9-D)
 * ------------------------------------------------------------------ */
import { YARD } from '../world/layout.js';
import { showDialogue } from '../ui/dialogue.js';
import { hasFlag, setFlag } from './state.js';
import { ENDING_TEXT, ENDING_TITLE } from '../../story.js';

let endingOverlay = null;

export function checkEnding(playerPos) {
  if (hasFlag('ending:shown')) return;
  const inYard =
    playerPos.x > YARD.x0 && playerPos.x < YARD.x1 &&
    playerPos.z > YARD.z0 && playerPos.z < YARD.z1;
  if (!inYard) return;
  setFlag('ending:shown');

  // 1. 하단 대화창에 기존 엔딩 대사 표시 (기존 escape-flow 검증 호환)
  showDialogue('', ENDING_TEXT);

  // 2. 2.5초 페이드아웃 오버레이 (검은 화면 + 마무리 메시지)
  setTimeout(() => {
    startEndingFade();
  }, 1000);
}

function startEndingFade() {
  if (endingOverlay) return;
  endingOverlay = document.createElement('div');
  endingOverlay.id = 'ending-overlay';
  Object.assign(endingOverlay.style, {
    position: 'fixed',
    inset: '0',
    background: '#0e0a14',
    zIndex: '14',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: '0',
    transition: 'opacity 2500ms ease-in',
    color: '#fdf6ec',
    fontFamily: '-apple-system, "Pretendard", "Malgun Gothic", sans-serif',
    textAlign: 'center',
    userSelect: 'none',
    pointerEvents: 'none',
  });

  const titleEl = document.createElement('div');
  titleEl.id = 'ending-title';
  titleEl.textContent = ENDING_TITLE || '— 탈출 성공 —';
  Object.assign(titleEl.style, {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f0a860',
    marginBottom: '16px',
    letterSpacing: '0.08em',
  });

  const textEl = document.createElement('div');
  textEl.id = 'ending-message';
  textEl.textContent = ENDING_TEXT;
  Object.assign(textEl.style, {
    fontSize: '15px',
    lineHeight: '1.8',
    maxWidth: '420px',
    width: '85%',
    opacity: '0.9',
    letterSpacing: '0.02em',
  });

  endingOverlay.appendChild(titleEl);
  endingOverlay.appendChild(textEl);
  document.body.appendChild(endingOverlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (endingOverlay) {
        endingOverlay.style.opacity = '1';
      }
    });
  });
}
