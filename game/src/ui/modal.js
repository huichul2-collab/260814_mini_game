/* ------------------------------------------------------------------ *
 *  숫자 키패드 팝업 — 2D DOM(Three.js 아님). 자물쇠 입력은 3D 조작이
 *  아니라 화면 위 오버레이로 처리한다(docs/spec/M9-escape.md §6.1, §10.6).
 *  M9-B는 숫자(digits) 자물쇠 하나뿐이라 이 파일도 그것만 만든다 —
 *  방향/영어 자물쇠(P2/P3)는 M9-C에서 별도로 다룬다.
 * ------------------------------------------------------------------ */

let activeOverlay = null;

function closeActive() {
  if (activeOverlay && activeOverlay.parentNode) {
    activeOverlay.parentNode.removeChild(activeOverlay);
  }
  activeOverlay = null;
}

/**
 * @param {object} opts
 * @param {string} opts.promptText 자물쇠 안내문(LOCKS[door].lockedText)
 * @param {number} opts.length 자릿수
 * @param {string} opts.answer 정답 문자열
 * @param {string} opts.wrongText 오답 시 안내문
 * @param {() => void} opts.onSuccess 정답 입력 시 콜백(모달은 자동으로 닫힘)
 */
export function showKeypadModal({ promptText, length, answer, wrongText, onSuccess }) {
  closeActive(); // 동시에 하나만 — 이전 모달이 남아있으면 정리

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(10, 8, 12, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: '30',
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeActive(); // 바깥 클릭 = 취소
  });

  const box = document.createElement('div');
  box.id = 'modal-box';
  Object.assign(box.style, {
    position: 'relative',
    width: 'min(300px, 88vw)',
    padding: '20px',
    boxSizing: 'border-box',
    background: '#2a2230',
    borderRadius: '16px',
    color: '#fdf6ec',
    fontFamily: '-apple-system, "Pretendard", "Malgun Gothic", sans-serif',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  });
  box.addEventListener('click', (e) => e.stopPropagation());

  const closeBtn = document.createElement('button');
  closeBtn.id = 'modal-close';
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    position: 'absolute', top: '8px', right: '10px',
    width: '28px', height: '28px',
    border: 'none', borderRadius: '50%',
    background: 'transparent', color: '#fdf6ec',
    fontSize: '18px', cursor: 'pointer', lineHeight: '1',
  });
  closeBtn.addEventListener('click', () => closeActive());
  box.appendChild(closeBtn);

  const prompt = document.createElement('div');
  prompt.id = 'modal-prompt';
  prompt.textContent = promptText;
  Object.assign(prompt.style, {
    fontSize: '14px', lineHeight: '1.5', marginBottom: '14px', paddingRight: '20px',
  });
  box.appendChild(prompt);

  let entered = '';

  const display = document.createElement('div');
  display.id = 'modal-display';
  Object.assign(display.style, {
    fontSize: '28px', letterSpacing: '0.3em', textAlign: 'center',
    padding: '10px', marginBottom: '8px',
    background: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px',
    minHeight: '1.4em',
  });
  box.appendChild(display);

  const feedback = document.createElement('div');
  feedback.id = 'modal-feedback';
  Object.assign(feedback.style, {
    fontSize: '12px', color: '#e08a8a', textAlign: 'center',
    minHeight: '1.4em', marginBottom: '10px',
  });
  box.appendChild(feedback);

  function renderDisplay() {
    display.textContent = entered.padEnd(length, '_').split('').join(' ');
  }
  renderDisplay();

  function checkComplete() {
    if (entered.length < length) return;
    if (entered === answer) {
      closeActive();
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      feedback.textContent = wrongText;
      entered = '';
      renderDisplay();
    }
  }

  const keypad = document.createElement('div');
  keypad.id = 'modal-keypad';
  Object.assign(keypad.style, {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
  });

  function addKey(label, handler, id) {
    const btn = document.createElement('button');
    if (id) btn.id = id;
    btn.textContent = label;
    Object.assign(btn.style, {
      padding: '12px 0', fontSize: '18px',
      border: 'none', borderRadius: '10px',
      background: '#3a3040', color: '#fdf6ec', cursor: 'pointer',
    });
    btn.addEventListener('click', handler);
    keypad.appendChild(btn);
  }

  for (let d = 1; d <= 9; d++) {
    addKey(String(d), () => {
      if (entered.length >= length) return;
      feedback.textContent = '';
      entered += String(d);
      renderDisplay();
      checkComplete();
    }, `modal-digit-${d}`);
  }
  addKey('C', () => {
    feedback.textContent = '';
    entered = '';
    renderDisplay();
  }, 'modal-clear');
  addKey('0', () => {
    if (entered.length >= length) return;
    feedback.textContent = '';
    entered += '0';
    renderDisplay();
    checkComplete();
  }, 'modal-digit-0');
  addKey('⌫', () => {
    feedback.textContent = '';
    entered = entered.slice(0, -1);
    renderDisplay();
  }, 'modal-backspace');

  box.appendChild(keypad);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  activeOverlay = overlay;
}
