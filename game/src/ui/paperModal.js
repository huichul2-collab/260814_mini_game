/* ------------------------------------------------------------------ *
 *  P3 단서 팝업 — 백지·아크릴판 둘 다 이 팝업을 연다(docs/spec/
 *  M9-escape.md §3 P3, §6.1). "UV를 비춘다"와 "아크릴판을 겹친다"는
 *  3D 조작이 아니라 이 2D 팝업 안의 상태로만 표현한다:
 *
 *    - UV 랜턴 미보유: 빈 종이 그대로
 *    - UV 랜턴 보유, 겹치기 꺼짐: 자외선에 글자가 뒤섞여 드러남(장식용
 *      더미 글자 — 정답이 아니다)
 *    - UV 랜턴 보유, 겹치기 켜짐: 정답(PUZZLES.P3.answer)만 남는다.
 *      정답 문자열은 여기서 새로 짓지 않고 그대로 읽는다(§ "정답을
 *      코드에 박지 마라").
 * ------------------------------------------------------------------ */

let activeOverlay = null;

function closeActive() {
  if (activeOverlay && activeOverlay.parentNode) {
    activeOverlay.parentNode.removeChild(activeOverlay);
  }
  activeOverlay = null;
}

// 자외선 아래 보이는 뒤섞인 글자 — 정답 주변에 붙는 장식용 잡음일 뿐이라
// story.js에서 읽어오지 않는다(정답이 아니므로 "코드에 박지 마라" 규칙과
// 무관).
const DECOY_NOISE = 'QZKX';

export function showPaperModal({ promptText, hasLantern, answer }) {
  closeActive();

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(10, 8, 12, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: '30',
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeActive();
  });

  const box = document.createElement('div');
  box.id = 'modal-box';
  Object.assign(box.style, {
    position: 'relative',
    width: 'min(320px, 90vw)',
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

  const paper = document.createElement('div');
  paper.id = 'modal-paper';
  Object.assign(paper.style, {
    minHeight: '90px',
    padding: '16px',
    marginBottom: '14px',
    borderRadius: '10px',
    background: '#f5f0e6',
    color: '#2a2230',
    fontSize: '22px',
    letterSpacing: '0.35em',
    textAlign: 'center',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  box.appendChild(paper);

  let overlayOn = false;

  function render() {
    if (!hasLantern) {
      paper.textContent = '';
      paper.style.fontSize = '14px';
      paper.style.letterSpacing = 'normal';
      paper.textContent = '빈 종이다.';
    } else if (overlayOn) {
      paper.style.fontSize = '22px';
      paper.style.letterSpacing = '0.35em';
      paper.textContent = answer;
    } else {
      paper.style.fontSize = '22px';
      paper.style.letterSpacing = '0.35em';
      paper.textContent = `${DECOY_NOISE[0]}${answer[0]}${DECOY_NOISE[1]}${answer.slice(1, 3)}${DECOY_NOISE[2]}${answer.slice(3)}${DECOY_NOISE[3]}`;
    }
  }

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'modal-acrylic-toggle';
  Object.assign(toggleBtn.style, {
    width: '100%', minHeight: '44px', padding: '8px 0', fontSize: '14px',
    border: 'none', borderRadius: '10px',
    background: hasLantern ? '#3a3040' : '#241e2a',
    color: hasLantern ? '#fdf6ec' : '#7a7280',
    cursor: hasLantern ? 'pointer' : 'not-allowed',
  });
  function renderToggleLabel() {
    toggleBtn.textContent = overlayOn ? '아크릴판 떼기' : '아크릴판 겹치기';
  }
  toggleBtn.addEventListener('click', () => {
    if (!hasLantern) return; // 자외선으로 글자가 안 보이면 겹쳐도 의미 없다
    overlayOn = !overlayOn;
    renderToggleLabel();
    render();
  });
  renderToggleLabel();
  render();

  box.appendChild(toggleBtn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  activeOverlay = overlay;
}
