import * as THREE from 'three';

/**
 * 브라우저 오토플레이 차단 정책 우회용 오디오 게이트
 * index.html 파일 수정 없이 id="loading" 엘리먼트 내부에 DOM 버튼을 동적 주입
 */
export function initAudioGate(loadingEl, onStart) {
  const container = loadingEl || document.getElementById('loading');
  if (!container) {
    if (typeof onStart === 'function') onStart();
    return;
  }

  // 1. "시작하기" 버튼 DOM 주입
  const startBtn = document.createElement('button');
  startBtn.id = 'audio-start-btn';
  startBtn.textContent = '게임 시작';
  Object.assign(startBtn.style, {
    marginTop: '16px',
    padding: '10px 24px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fdf6ec',
    backgroundColor: '#e0793f',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.15s ease, background-color 0.15s ease',
  });

  startBtn.addEventListener('mouseenter', () => {
    startBtn.style.backgroundColor = '#f0894f';
    startBtn.style.transform = 'scale(1.05)';
  });
  startBtn.addEventListener('mouseleave', () => {
    startBtn.style.backgroundColor = '#e0793f';
    startBtn.style.transform = 'scale(1)';
  });

  // 2. 버튼 클릭 핸들러 (제스처 태스크 내에서 AudioContext resume 및 시작 콜백)
  startBtn.addEventListener('click', async () => {
    try {
      const ctx = THREE.AudioContext.getContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (err) {
      console.warn('[audio-gate] AudioContext resume 실패:', err);
    }

    // ⚠️ onStart()가 던지면(재생 로직 버그 등) 아래 페이드아웃까지 막혀서
    // 사용자가 "게임 시작" 화면에 영원히 갇힌다 — 실제로 이 문제가 있었다.
    // 오디오가 안 되더라도 게임은 뜨는 게 맞으므로 try/catch로 분리한다.
    if (typeof onStart === 'function') {
      try {
        onStart();
      } catch (err) {
        console.warn('[audio-gate] onStart 콜백 실패:', err);
      }
    }

    // 로딩 엘리먼트 페이드아웃 및 제거
    container.style.opacity = '0';
    setTimeout(() => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 400);
  });

  // 버튼을 loadingEl 내부 요소로 추가
  container.appendChild(startBtn);
}
