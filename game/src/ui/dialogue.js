/* ------------------------------------------------------------------ *
 *  하단 반투명 대화창 — DOM 기반(Three.js 오브젝트 아님). index.html은
 *  건드리지 않고 gate.js와 같은 방식으로 document.body에 직접 주입한다.
 *  성공(오브젝트 설명)과 실패 안내("너무 멀다" 등)를 같은 UI로 표시한다
 *  — 이름줄이 있으면 오브젝트 설명, 없으면 시스템 메시지로 취급한다.
 * ------------------------------------------------------------------ */
import { INTERACTION_CONFIG } from '../../config.js';

let el = null;
let nameEl = null;
let textEl = null;
let hideTimer = null;
let fadeTimer = null;

function ensureEl() {
  if (el) return;

  el = document.createElement('div');
  el.id = 'dialogue-box';
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: '520px',
    boxSizing: 'border-box',
    padding: '14px 18px',
    // 모바일 세로 화면 하단 안전영역(노치/제스처 바) 고려.
    paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
    background: 'rgba(20, 14, 24, 0.78)',
    color: '#fdf6ec',
    borderRadius: '14px',
    fontFamily: '-apple-system, "Pretendard", "Malgun Gothic", sans-serif',
    zIndex: '20',
    opacity: '0',
    cursor: 'pointer',
    transition: 'opacity 0.25s ease',
    display: 'none',
    userSelect: 'none',
  });

  nameEl = document.createElement('div');
  nameEl.id = 'dialogue-name';
  Object.assign(nameEl.style, {
    fontSize: '13px',
    fontWeight: '700',
    marginBottom: '4px',
    color: '#f0a860',
    letterSpacing: '0.02em',
  });

  textEl = document.createElement('div');
  textEl.id = 'dialogue-text';
  Object.assign(textEl.style, {
    fontSize: '14px',
    lineHeight: '1.5',
  });

  el.appendChild(nameEl);
  el.appendChild(textEl);
  // 클릭하면 즉시 닫힘.
  el.addEventListener('click', hideDialogue);
  document.body.appendChild(el);
}

export function showDialogue(name, text) {
  ensureEl();
  nameEl.textContent = name || '';
  nameEl.style.display = name ? 'block' : 'none';
  textEl.textContent = text;

  el.style.display = 'block';
  if (fadeTimer) clearTimeout(fadeTimer);
  // display:none → block 직후 바로 opacity를 바꾸면 브라우저가 트랜지션을
  // 건너뛸 수 있어 한 프레임 늦춘다.
  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(hideDialogue, INTERACTION_CONFIG.dialogDuration);
}

export function hideDialogue() {
  if (!el || el.style.display === 'none') return;
  el.style.opacity = '0';
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (fadeTimer) clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    if (el) el.style.display = 'none';
  }, 250);
}
