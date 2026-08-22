/* ------------------------------------------------------------------ *
 *  신문 스크랩 열람 팝업(docs/spec/M9-escape.md §12.4, §12.7) — 서재
 *  캐비닛을 파이프렌치로 열면 뜬다. modal.js/paperModal.js와 같은 2D
 *  DOM 오버레이 패턴(오버레이 바깥 클릭 = 닫기, #modal-close 버튼)을
 *  그대로 따르되, 입력 판정이 없는 "그냥 페이지 넘기며 읽는" 용도라
 *  이전/다음 버튼 두 개만 둔다. 문안은 story.js NEWS_CLIPPINGS를 그대로
 *  읽는다(정답 텍스트를 여기서 새로 짓지 않는다).
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
 * @param {string[]} opts.clippings 스크랩 문안 배열(story.js NEWS_CLIPPINGS)
 */
export function showClippingsModal({ clippings }) {
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
    width: 'min(340px, 90vw)',
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
  prompt.textContent = '신문 스크랩';
  Object.assign(prompt.style, {
    fontSize: '14px', lineHeight: '1.5', marginBottom: '14px', paddingRight: '20px', fontWeight: '700',
  });
  box.appendChild(prompt);

  const paper = document.createElement('div');
  paper.id = 'modal-clipping-text';
  Object.assign(paper.style, {
    minHeight: '110px',
    padding: '16px',
    marginBottom: '10px',
    borderRadius: '10px',
    background: '#f5f0e6',
    color: '#2a2230',
    fontSize: '14px',
    lineHeight: '1.6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  box.appendChild(paper);

  const pageIndicator = document.createElement('div');
  pageIndicator.id = 'modal-clipping-page';
  Object.assign(pageIndicator.style, {
    fontSize: '12px', textAlign: 'center', color: '#c9bfae', marginBottom: '10px',
  });
  box.appendChild(pageIndicator);

  const nav = document.createElement('div');
  Object.assign(nav.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' });

  let idx = 0;

  function render() {
    paper.textContent = clippings[idx];
    pageIndicator.textContent = `${idx + 1} / ${clippings.length}`;
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === clippings.length - 1;
    prevBtn.style.opacity = prevBtn.disabled ? '0.4' : '1';
    nextBtn.style.opacity = nextBtn.disabled ? '0.4' : '1';
  }

  function navButton(label, id, onClick) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    Object.assign(btn.style, {
      minHeight: '44px', padding: '8px 0', fontSize: '14px',
      border: 'none', borderRadius: '10px',
      background: '#3a3040', color: '#fdf6ec', cursor: 'pointer',
    });
    btn.addEventListener('click', onClick);
    nav.appendChild(btn);
    return btn;
  }

  const prevBtn = navButton('◀ 이전', 'modal-clipping-prev', () => {
    if (idx > 0) { idx--; render(); }
  });
  const nextBtn = navButton('다음 ▶', 'modal-clipping-next', () => {
    if (idx < clippings.length - 1) { idx++; render(); }
  });

  render();

  box.appendChild(nav);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  activeOverlay = overlay;
}
