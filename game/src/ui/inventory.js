/* ------------------------------------------------------------------ *
 *  인벤토리 UI — M9-A에서는 껍데기만. 아이템 습득 로직 자체가 아직
 *  없으니(M9-B 이후) 항상 "비어 있음"만 보인다. 이미지 에셋은 안 쓰고
 *  이모지/CSS 도형만 쓴다(무빌드·오프라인 원칙 유지).
 * ------------------------------------------------------------------ */
import { getInventory, onChange } from '../story/state.js';

export function initInventory() {
  let panelOpen = false;

  const btn = document.createElement('button');
  btn.id = 'inventory-btn';
  btn.textContent = '🎒';
  btn.setAttribute('aria-label', '인벤토리');
  Object.assign(btn.style, {
    position: 'fixed',
    right: '16px',
    bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(20, 14, 24, 0.72)',
    color: '#fdf6ec',
    fontSize: '22px',
    lineHeight: '48px',
    padding: '0',
    cursor: 'pointer',
    zIndex: '20',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  });

  const panel = document.createElement('div');
  panel.id = 'inventory-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    right: '16px',
    bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
    width: 'min(240px, 80vw)',
    minHeight: '100px',
    padding: '12px',
    boxSizing: 'border-box',
    background: 'rgba(20, 14, 24, 0.85)',
    color: '#fdf6ec',
    borderRadius: '12px',
    fontFamily: '-apple-system, "Pretendard", "Malgun Gothic", sans-serif',
    fontSize: '13px',
    zIndex: '20',
    display: 'none',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  });

  function render() {
    const items = getInventory();
    panel.textContent = '';
    if (items.length === 0) {
      panel.style.alignItems = 'center';
      panel.style.justifyContent = 'center';
      const empty = document.createElement('div');
      empty.textContent = '비어 있음';
      empty.style.opacity = '0.55';
      panel.appendChild(empty);
    } else {
      // M9-B 이후: 아이템별 이모지/도형 아이콘 그리드로 교체.
      for (const id of items) {
        const cell = document.createElement('div');
        cell.textContent = id;
        panel.appendChild(cell);
      }
    }
    panel.style.display = panelOpen ? (items.length === 0 ? 'flex' : 'grid') : 'none';
  }

  btn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    render();
  });

  document.body.appendChild(panel);
  document.body.appendChild(btn);
  render();
  onChange(render);
}
