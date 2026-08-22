import * as THREE from 'three';
import { manager } from '../assets/loaders.js';
import { OPENING_CONFIG } from '../../config.js';

/**
 * 터치 기기 감지 — pointer:coarse 미디어쿼리 우선, 지원 안 하는 구형
 * 브라우저는 navigator.maxTouchPoints로 폴백.
 */
export function isTouchDevice() {
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  return (navigator.maxTouchPoints || 0) > 0;
}

/**
 * 브라우저 오토플레이 차단 정책 우회용 오디오 게이트 + 에셋 로딩 게이트.
 * index.html 파일 수정 없이 id="loading" 엘리먼트 내부에 DOM을 동적 주입한다.
 *
 * GLB(character.js)·오디오(audio.js)가 전부 assets/loaders.js의 공용
 * LoadingManager를 거치므로, 여기서 그 manager 하나만 훅 걸면 "에셋을 다
 * 받았는지"를 따로 계산할 필요 없이 버튼을 게이팅할 수 있다. main.js가
 * 이 함수를 호출하는 시점은 오디오 프리페치 직후 같은 동기 실행 블록
 * 안이므로(비동기 로드가 끼어들 새가 없음) onLoad를 놓칠 레이스가 없다.
 */
export function initAudioGate(loadingEl, onStart) {
  const container = loadingEl || document.getElementById('loading');
  if (!container) {
    if (typeof onStart === 'function') onStart();
    return;
  }

  // 기존 "불러오는 중…" 고정 텍스트 노드를 갱신 가능한 엘리먼트로 교체.
  const statusEl = document.createElement('div');
  statusEl.id = 'loading-status';
  statusEl.textContent = '에셋 불러오는 중…';
  container.textContent = '';
  container.appendChild(statusEl);

  // 모바일/터치 기기 안내 — 조이스틱 이동 및 터치 시점 조작 안내.
  if (isTouchDevice()) {
    const mobileNotice = document.createElement('div');
    mobileNotice.id = 'mobile-notice';
    mobileNotice.textContent = '이동은 화면 왼쪽 조이스틱, 시점은 오른쪽 드래그 (퍼즐 입력은 키보드가 편리합니다)';
    Object.assign(mobileNotice.style, {
      marginTop: '10px',
      fontSize: '12px',
      color: '#f0a860',
      maxWidth: '260px',
      textAlign: 'center',
      lineHeight: '1.5',
    });
    container.appendChild(mobileNotice);
  }

  // 1. "시작하기" 버튼 DOM 주입 — 로딩 끝나기 전까지는 비활성 상태로 둔다.
  const startBtn = document.createElement('button');
  startBtn.id = 'audio-start-btn';
  startBtn.textContent = '에셋 불러오는 중…';
  startBtn.disabled = true;
  Object.assign(startBtn.style, {
    marginTop: '16px',
    padding: '10px 24px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fdf6ec',
    backgroundColor: '#e0793f',
    border: 'none',
    borderRadius: '20px',
    cursor: 'not-allowed',
    opacity: '0.5',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.15s ease, background-color 0.15s ease, opacity 0.15s ease',
  });

  startBtn.addEventListener('mouseenter', () => {
    if (startBtn.disabled) return;
    startBtn.style.backgroundColor = '#f0894f';
    startBtn.style.transform = 'scale(1.05)';
  });
  startBtn.addEventListener('mouseleave', () => {
    startBtn.style.backgroundColor = '#e0793f';
    startBtn.style.transform = 'scale(1)';
  });

  function setReady() {
    if (!startBtn.disabled) return; // 이미 활성화됐으면 중복 처리 안 함
    startBtn.disabled = false;
    startBtn.textContent = '게임 시작';
    startBtn.style.cursor = 'pointer';
    startBtn.style.opacity = '1';
    statusEl.textContent = '준비 완료!';
  }

  manager.onProgress = (url, loaded, total) => {
    statusEl.textContent = `에셋 불러오는 중… (${loaded}/${total})`;
  };
  manager.onLoad = setReady;
  manager.onError = (url) => console.warn('[audio-gate] 에셋 로드 실패:', url);

  // 안전망: 로딩이 비정상적으로 안 끝나도(네트워크 문제 등) 사용자가
  // 영원히 갇히지 않도록 10초 뒤엔 강제로 버튼을 연다.
  setTimeout(setReady, 10000);

  // 2. 버튼 클릭 핸들러 (제스처 태스크 내에서 AudioContext resume 및 시작 콜백)
  startBtn.addEventListener('click', async () => {
    console.log('[gate] Start button clicked, fading overlay');
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
    container.style.transition = 'opacity 0.4s ease';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    setTimeout(() => {
      container.style.display = 'none';
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 400);
  });

  // 버튼을 loadingEl 내부 요소로 추가
  container.appendChild(startBtn);
}
