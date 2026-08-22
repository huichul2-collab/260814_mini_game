/* ------------------------------------------------------------------ *
 *  인벤토리 UI — 우하단 고정 아이콘 + 4×2 격자 패널(docs/spec/
 *  M9-escape.md §5). 아이콘은 이모지만 쓴다(이미지 파일 금지, 무빌드·
 *  오프라인 원칙 유지). 아이템 이름·설명·아이콘은 story.js ITEMS가
 *  단일 원본이다 — 여기는 그걸 그리기만 한다.
 * ------------------------------------------------------------------ */
import { getInventory, onChange } from '../story/state.js';
import { ITEMS } from '../../story.js';
import { showDialogue } from './dialogue.js';

const SLOT_COUNT = 8; // 4×2, §5 — 아이템 최대 6개라 넉넉함

function ensureStyle() {
  if (document.getElementById('inventory-style')) return;
  const style = document.createElement('style');
  style.id = 'inventory-style';
  // 새 아이템 획득 시 짧은 강조 애니메이션(§5).
  style.textContent = `
    @keyframes inv-pop {
      0% { transform: scale(0.4); opacity: 0.3; }
      60% { transform: scale(1.18); opacity: 1; }
      100% { transform: scale(1); }
    }
    .inv-cell-pop { animation: inv-pop 0.4s ease; }
  `;
  document.head.appendChild(style);
}

export function initInventory() {
  ensureStyle();
  let panelOpen = false;
  const seenIds = new Set(); // 팝 애니메이션을 이미 보여준 id — 패널을 열 때마다 한 번씩만

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
    // §5 — 모바일 세로 화면 폭 320px 상한.
    width: 'min(320px, 80vw)',
    padding: '12px',
    boxSizing: 'border-box',
    background: 'rgba(20, 14, 24, 0.88)',
    color: '#fdf6ec',
    borderRadius: '12px',
    fontFamily: '-apple-system, "Pretendard", "Malgun Gothic", sans-serif',
    zIndex: '20',
    display: 'none',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  });

  function render() {
    const items = getInventory();
    panel.textContent = '';
    panel.style.display = panelOpen ? 'grid' : 'none';

    for (let i = 0; i < SLOT_COUNT; i++) {
      const id = items[i];
      const cell = document.createElement('div');
      Object.assign(cell.style, {
        aspectRatio: '1',
        borderRadius: '8px',
        background: id ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: id ? 'pointer' : 'default',
        minHeight: '44px', // 터치 타깃(§5 UI 원칙과 동일 기준)
      });

      if (id) {
        const meta = ITEMS[id] || { name: id, icon: '❔', desc: id };
        const icon = document.createElement('div');
        icon.textContent = meta.icon;
        icon.style.fontSize = '22px';
        const label = document.createElement('div');
        label.textContent = meta.name;
        Object.assign(label.style, { fontSize: '9px', marginTop: '2px', opacity: '0.8', textAlign: 'center' });
        cell.appendChild(icon);
        cell.appendChild(label);
        cell.addEventListener('click', () => showDialogue(meta.name, meta.desc || meta.name));

        if (panelOpen && !seenIds.has(id)) {
          cell.classList.add('inv-cell-pop');
          seenIds.add(id);
        }
      }
      panel.appendChild(cell);
    }
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
