/* ------------------------------------------------------------------ *
 *  game/src/ui/opening.js — 오프닝 페이드인 + 인트로 대사 + 조작 안내 연출 (M9-D)
 * ------------------------------------------------------------------ */
import { OPENING_CONFIG } from '../../config.js';
import { INTRO, CONTROL_HINT } from '../../story.js';

let openingOverlay = null;

/**
 * 게임 시작 시 3초 페이드인 및 인트로 독백 대사 출력
 */
export function startOpening(onComplete) {
  const duration = OPENING_CONFIG.fadeInDuration || 3000;

  // 1. 검은 오버레이 생성 (초기 opacity: 1, zIndex: 14)
  openingOverlay = document.createElement('div');
  openingOverlay.id = 'opening-overlay';
  Object.assign(openingOverlay.style, {
    position: 'fixed',
    inset: '0',
    background: '#0e0a14',
    zIndex: '14',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    opacity: '1',
    transition: `opacity ${duration}ms cubic-bezier(0.2, 0.8, 0.3, 1)`,
    userSelect: 'none',
  });

  // 인트로 텍스트 컨테이너
  const textContainer = document.createElement('div');
  textContainer.id = 'opening-intro-container';
  Object.assign(textContainer.style, {
    maxWidth: '520px',
    width: '85%',
    textAlign: 'center',
    color: '#fdf6ec',
    fontFamily: '-apple-system, "Pretendard", "Malgun Gothic", sans-serif',
    fontSize: '16px',
    lineHeight: '1.8',
    letterSpacing: '0.04em',
    padding: '20px',
    boxSizing: 'border-box',
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
    transition: 'opacity 0.4s ease',
  });

  openingOverlay.appendChild(textContainer);
  document.body.appendChild(openingOverlay);

  // 인트로 대사 순차 출력
  let lineIdx = 0;
  function showNextLine() {
    if (lineIdx < INTRO.length) {
      textContainer.style.opacity = '0';
      setTimeout(() => {
        textContainer.textContent = INTRO[lineIdx++];
        textContainer.style.opacity = '1';
      }, 150);
    }
  }

  showNextLine();
  const lineInterval = Math.max(800, Math.floor((duration - 300) / (INTRO.length || 1)));
  const timer = setInterval(() => {
    if (lineIdx >= INTRO.length) {
      clearInterval(timer);
    } else {
      showNextLine();
    }
  }, lineInterval);

  // 2. 페이드인 시작 (검은 화면 -> 게임 씬 공개)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (openingOverlay) {
        openingOverlay.style.opacity = '0';
      }
    });
  });

  // 3. 페이드 완료 후 정리 및 조작 힌트 표시
  setTimeout(() => {
    clearInterval(timer);
    if (openingOverlay && openingOverlay.parentNode) {
      openingOverlay.style.display = 'none';
      openingOverlay.parentNode.removeChild(openingOverlay);
      openingOverlay = null;
    }

    // 페이드 완료 후 하단에 조작 안내 한 줄 표시
    const hintEl = document.getElementById('hint');
    if (hintEl) {
      hintEl.textContent = CONTROL_HINT || 'WASD: 이동 · 마우스 드래그: 시점 회전 · 좌클릭: 조사 · Space: 점프';
      hintEl.classList.remove('hidden');
      setTimeout(() => {
        hintEl.classList.add('hidden');
      }, 5000);
    }

    if (typeof onComplete === 'function') onComplete();
  }, duration);
}
