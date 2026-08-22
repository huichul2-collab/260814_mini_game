/* ------------------------------------------------------------------ *
 *  자물쇠 입력 팝업 — 2D DOM(Three.js 아님). 자물쇠 입력은 3D 조작이
 *  아니라 화면 위 오버레이로 처리한다(docs/spec/M9-escape.md §6.1, §10.6).
 *
 *  type별로 키패드만 다르고, "입력값을 모아서 정답과 비교" 로직은
 *  전부 공유한다(entered는 항상 문자열, answer도 항상 문자열이라
 *  digits/arrows/letters 모두 같은 비교식으로 처리된다).
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
 * @param {'digits'|'arrows'|'letters'} [opts.type] 키패드 종류(기본 digits)
 * @param {string} opts.promptText 자물쇠 안내문(LOCKS[door].lockedText)
 * @param {number} opts.length 자릿수
 * @param {string} opts.answer 정답 문자열
 * @param {string} opts.wrongText 오답 시 안내문
 * @param {() => void} opts.onSuccess 정답 입력 시 콜백(모달은 자동으로 닫힘)
 */
export function showKeypadModal({ type = 'digits', promptText, length, answer, wrongText, onSuccess }) {
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
  // letters는 26개 버튼이 들어가야 해서 폭을 더 준다 — 모바일 세로에서도
  // 버튼 한 칸이 44px 이상이 되게(§5 터치 타깃 기준을 자물쇠 UI에도 적용).
  const boxWidthPx = type === 'letters' ? 360 : 300;
  Object.assign(box.style, {
    position: 'relative',
    width: `min(${boxWidthPx}px, 92vw)`,
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

  function press(ch) {
    if (entered.length >= length) return;
    feedback.textContent = '';
    entered += ch;
    renderDisplay();
    checkComplete();
  }
  function clear() {
    feedback.textContent = '';
    entered = '';
    renderDisplay();
  }
  function backspace() {
    feedback.textContent = '';
    entered = entered.slice(0, -1);
    renderDisplay();
  }

  const keypad = document.createElement('div');
  keypad.id = 'modal-keypad';

  // 버튼 하나 — 어떤 type이든 최소 44px 높이는 보장한다(모바일 터치 타깃).
  function addKey(label, handler, id) {
    const btn = document.createElement('button');
    if (id) btn.id = id;
    btn.textContent = label;
    Object.assign(btn.style, {
      minHeight: '44px', padding: '8px 0', fontSize: '18px',
      border: 'none', borderRadius: '10px',
      background: '#3a3040', color: '#fdf6ec', cursor: 'pointer',
    });
    btn.addEventListener('click', handler);
    keypad.appendChild(btn);
  }

  if (type === 'arrows') {
    // 3x3 십자 배열 — 방향 버튼 4개 + 가운데 지우기/백스페이스.
    Object.assign(keypad.style, { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' });
    const blank = () => { const d = document.createElement('div'); keypad.appendChild(d); };
    blank();
    addKey('↑', () => press('↑'), 'modal-arrow-up');
    blank();
    addKey('←', () => press('←'), 'modal-arrow-left');
    addKey('C', clear, 'modal-clear');
    addKey('→', () => press('→'), 'modal-arrow-right');
    blank();
    addKey('↓', () => press('↓'), 'modal-arrow-down');
    addKey('⌫', backspace, 'modal-backspace');
  } else if (type === 'letters') {
    // A~Z 6열 그리드 + 지우기/백스페이스.
    Object.assign(keypad.style, { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' });
    for (let c = 65; c <= 90; c++) {
      const letter = String.fromCharCode(c);
      addKey(letter, () => press(letter), `modal-letter-${letter}`);
    }
    addKey('C', clear, 'modal-clear');
    addKey('⌫', backspace, 'modal-backspace');
  } else {
    // digits(기본) — 숫자 0~9 + 지우기/백스페이스.
    Object.assign(keypad.style, { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' });
    for (let d = 1; d <= 9; d++) {
      addKey(String(d), () => press(String(d)), `modal-digit-${d}`);
    }
    addKey('C', clear, 'modal-clear');
    addKey('0', () => press('0'), 'modal-digit-0');
    addKey('⌫', backspace, 'modal-backspace');
  }

  box.appendChild(keypad);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  activeOverlay = overlay;
}
