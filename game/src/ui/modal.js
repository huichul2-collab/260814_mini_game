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

// M9-E(E-4, §12.6) — 다이얼 타입. 길이 고정 입력(digits/arrows/letters)과
// 근본적으로 다르다 — 구간이 몇 클릭인지 미리 정해져 있지 않고, "방향
// 전환"이라는 사용자 행동 자체가 구간을 확정한다. 그래서 위 length
// 기반(entered/checkComplete) 로직을 못 그대로 쓰고 따로 만든다.
// answer 형식은 'L3R4L1'처럼 [L|R][자릿수] 반복 문자열이다.
function buildDialUI({ answer, wrongText, feedback, onSuccess }) {
  const wrap = document.createElement('div');

  const display = document.createElement('div');
  display.id = 'modal-dial-display';
  Object.assign(display.style, {
    fontSize: '20px', letterSpacing: '0.05em', textAlign: 'center',
    padding: '10px', marginBottom: '10px',
    background: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px',
    minHeight: '1.4em',
  });
  wrap.appendChild(display);

  const segments = []; // 방향 전환으로 확정된 구간: [{dir:'L'|'R', count}]
  let curDir = null; // 아직 확정 안 된 진행 중 구간
  let curCount = 0;

  function fmtSeg(dir, count) {
    return `${dir === 'L' ? '◀' : '▶'}${count}`;
  }
  function render() {
    const parts = segments.map((s) => fmtSeg(s.dir, s.count));
    if (curDir) parts.push(fmtSeg(curDir, curCount));
    display.textContent = parts.length ? parts.join(' ') : '입력 없음';
  }

  function press(dir) {
    feedback.textContent = '';
    if (curDir === null) {
      curDir = dir; curCount = 1;
    } else if (curDir === dir) {
      curCount++; // 같은 방향 연속 클릭 = 카운트 누적
    } else {
      segments.push({ dir: curDir, count: curCount }); // 방향이 바뀌면 한 구간 확정
      curDir = dir; curCount = 1;
    }
    render();
  }

  // 되돌리기 — 방금 누른 클릭 한 번을 정확히 취소한다(진행 중 구간이
  // 있으면 그 카운트를 하나 줄이고, 없으면 직전에 확정된 구간을 다시
  // "진행 중" 상태로 되돌려 하나 줄인 채 이어간다).
  function undo() {
    feedback.textContent = '';
    if (curCount > 0) {
      curCount--;
      if (curCount === 0) curDir = null;
    } else if (segments.length > 0) {
      const last = segments.pop();
      curDir = last.dir;
      curCount = last.count - 1;
      if (curCount === 0) curDir = null;
    }
    render();
  }

  function resetAll() {
    segments.length = 0;
    curDir = null;
    curCount = 0;
    render();
  }

  // 확인 — 진행 중 구간까지 포함해 전체를 직렬화(예: 'L3R4L1')해 정답과
  // 비교한다. digits/arrows/letters처럼 자릿수를 다 채우는 순간 자동
  // 판정하지 않는 이유가 이거다 — 다이얼은 "언제 그만 돌릴지"가 정답의
  // 일부라 명시적 확인 버튼이 있어야 한다.
  function confirmEntry() {
    const full = curCount > 0 ? [...segments, { dir: curDir, count: curCount }] : segments;
    const serialized = full.map((s) => `${s.dir}${s.count}`).join('');
    if (serialized === answer) {
      onSuccess();
    } else {
      feedback.textContent = wrongText;
      resetAll();
    }
  }

  function addDialBtn(label, id, handler, parent) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    Object.assign(btn.style, {
      minHeight: '44px', padding: '8px 0', fontSize: '16px',
      border: 'none', borderRadius: '10px',
      background: '#3a3040', color: '#fdf6ec', cursor: 'pointer',
    });
    btn.addEventListener('click', handler);
    parent.appendChild(btn);
    return btn;
  }

  const turnGrid = document.createElement('div');
  Object.assign(turnGrid.style, { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '8px' });
  addDialBtn('◀ 좌회전', 'modal-dial-left', () => press('L'), turnGrid);
  addDialBtn('우회전 ▶', 'modal-dial-right', () => press('R'), turnGrid);
  wrap.appendChild(turnGrid);

  const actionGrid = document.createElement('div');
  Object.assign(actionGrid.style, { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' });
  addDialBtn('되돌리기', 'modal-dial-undo', undo, actionGrid);
  addDialBtn('확인', 'modal-dial-confirm', confirmEntry, actionGrid);
  wrap.appendChild(actionGrid);

  render();
  return wrap;
}

/**
 * @param {object} opts
 * @param {'digits'|'arrows'|'letters'|'dial'} [opts.type] 키패드 종류(기본 digits)
 * @param {string} opts.promptText 자물쇠 안내문(LOCKS[door].lockedText)
 * @param {number} [opts.length] 자릿수(dial 타입은 불필요)
 * @param {string} opts.answer 정답 문자열(dial 타입은 'L3R4L1' 형식)
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

  // dial은 자릿수 고정 입력이 아니라 아래 length 기반 로직(entered/
  // checkComplete)과 완전히 다른 흐름이라 여기서 갈라져 별도로 처리하고
  // 끝낸다 — box/overlay 부착까지 이 안에서 마친다.
  if (type === 'dial') {
    const dialUI = buildDialUI({
      answer,
      wrongText,
      feedback,
      onSuccess: () => {
        closeActive();
        if (typeof onSuccess === 'function') onSuccess();
      },
    });
    box.appendChild(dialUI);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    activeOverlay = overlay;
    return;
  }

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
