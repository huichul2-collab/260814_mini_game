/* ------------------------------------------------------------------ *
 *  game/src/ui/joystick.js — 모바일 가상 조이스틱 및 점프 버튼 UI (M9-lane-mobile)
 * ------------------------------------------------------------------ */
import { JOYSTICK_CONFIG, JUMP_BUTTON_CONFIG } from '../../config.js';
import { CONTROL_HINT_MOBILE } from '../../story.js';
import { isTouchDevice } from '../audio/gate.js';

let containerEl = null;
let baseEl = null;
let knobEl = null;
let jumpBtnEl = null;
let activeTouchId = null;
let activeJumpTouchId = null;
let baseCenterX = 0;
let baseCenterY = 0;
let jumpPressed = false;

const currentAxis = { x: 0, z: 0 };
let isInitialized = false;

function isModalOpen() {
  if (typeof document === 'undefined') return false;
  const overlay = document.getElementById('modal-overlay');
  return !!overlay && overlay.style.display !== 'none' && overlay.style.visibility !== 'hidden';
}

function shouldShowJoystick() {
  if (JOYSTICK_CONFIG.mode === 'off') return false;
  if (JOYSTICK_CONFIG.mode === 'on') return true;
  return isTouchDevice();
}

function shouldShowJump() {
  const cfg = JUMP_BUTTON_CONFIG || {};
  if (cfg.mode === 'off') return false;
  if (cfg.mode === 'on') return true;
  return isTouchDevice();
}

function updateBaseCenter() {
  if (!baseEl) return;
  const rect = baseEl.getBoundingClientRect();
  baseCenterX = rect.left + rect.width / 2;
  baseCenterY = rect.top + rect.height / 2;
}

function updateKnobAndAxis(clientX, clientY) {
  if (!baseEl || !knobEl) return;
  const dx = clientX - baseCenterX;
  const dy = clientY - baseCenterY;
  const dist = Math.hypot(dx, dy);
  const maxR = JOYSTICK_CONFIG.radius || 50;
  const deadzone = JOYSTICK_CONFIG.deadzone || 0.1;

  const clampedDist = Math.min(dist, maxR);
  let knobX = 0;
  let knobY = 0;
  if (dist > 1e-4) {
    knobX = (dx / dist) * clampedDist;
    knobY = (dy / dist) * clampedDist;
  }

  knobEl.style.transition = 'none';
  knobEl.style.transform = 'translate(' + knobX + 'px, ' + knobY + 'px)';

  const normalized = clampedDist / maxR;
  if (normalized < deadzone) {
    currentAxis.x = 0;
    currentAxis.z = 0;
  } else {
    const scale = (normalized - deadzone) / (1 - deadzone);
    currentAxis.x = (dx / dist) * scale;
    currentAxis.z = (dy / dist) * scale;
  }
}

function resetJoystick() {
  activeTouchId = null;
  currentAxis.x = 0;
  currentAxis.z = 0;
  if (knobEl) {
    knobEl.style.transition = 'transform 0.12s ease-out';
    knobEl.style.transform = 'translate(0px, 0px)';
  }
}

function resetJump() {
  jumpPressed = false;
  activeJumpTouchId = null;
  if (jumpBtnEl) {
    jumpBtnEl.style.transform = 'scale(1.0)';
    jumpBtnEl.style.filter = 'none';
  }
}

function handleTouchStart(e) {
  if (isModalOpen()) return;
  if (activeTouchId !== null) return;
  const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
  const maxLeftX = window.innerWidth * (JOYSTICK_CONFIG.leftZoneRatio || 0.40);

  for (const touch of touches) {
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    if (clientX > maxLeftX) continue;

    const id = touch.identifier !== undefined ? touch.identifier : (touch.pointerId !== undefined ? touch.pointerId : 'joy');
    activeTouchId = id;
    updateBaseCenter();
    updateKnobAndAxis(clientX, clientY);

    if (e.stopPropagation) e.stopPropagation();
    if (e.preventDefault && e.cancelable) e.preventDefault();
    break;
  }
}

function handleTouchMove(e) {
  if (activeTouchId === null) return;
  const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];

  for (const touch of touches) {
    const id = touch.identifier !== undefined ? touch.identifier : (touch.pointerId !== undefined ? touch.pointerId : 'joy');
    if (id === activeTouchId) {
      updateKnobAndAxis(touch.clientX, touch.clientY);
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault && e.cancelable) e.preventDefault();
      break;
    }
  }
}

function handleTouchEnd(e) {
  if (activeTouchId === null) return;
  const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];

  for (const touch of touches) {
    const id = touch.identifier !== undefined ? touch.identifier : (touch.pointerId !== undefined ? touch.pointerId : 'joy');
    if (id === activeTouchId) {
      resetJoystick();
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault && e.cancelable) e.preventDefault();
      break;
    }
  }
}

function handleJumpTouchStart(e) {
  if (isModalOpen()) return;
  const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
  const touch = touches[0] || e;
  const id = touch.identifier !== undefined ? touch.identifier : (touch.pointerId !== undefined ? touch.pointerId : 'jump');

  activeJumpTouchId = id;
  jumpPressed = true;

  if (jumpBtnEl) {
    jumpBtnEl.style.transform = 'scale(0.92)';
    jumpBtnEl.style.filter = 'brightness(1.2)';
  }

  // ⚠️ 시점 회전(followCamera) 드래그 이벤트로 전파되지 않도록 완벽 차단
  if (e.stopPropagation) e.stopPropagation();
  if (e.preventDefault && e.cancelable) e.preventDefault();
}

function handleJumpTouchEnd(e) {
  if (activeJumpTouchId === null) return;
  const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
  for (const touch of touches) {
    const id = touch.identifier !== undefined ? touch.identifier : (touch.pointerId !== undefined ? touch.pointerId : 'jump');
    if (id === activeJumpTouchId) {
      resetJump();
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault && e.cancelable) e.preventDefault();
      break;
    }
  }
}

export function ensureJoystick() {
  if (isInitialized) return;
  if (typeof document === 'undefined' || !document.body) return;

  const radius = JOYSTICK_CONFIG.radius || 50;
  const knobRadius = JOYSTICK_CONFIG.knobRadius || 24;
  const jumpCfg = JUMP_BUTTON_CONFIG || {};
  const jumpSize = Math.max(56, jumpCfg.size || 60);

  // ---------- 1. 조이스틱 컨테이너 (좌하단) ----------
  containerEl = document.createElement('div');
  containerEl.id = 'virtual-joystick-container';
  Object.assign(containerEl.style, {
    position: 'fixed',
    left: 'calc(24px + env(safe-area-inset-left, 0px))',
    bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
    width: (radius * 2) + 'px',
    height: (radius * 2) + 'px',
    boxSizing: 'border-box',
    touchAction: 'none',
    userSelect: 'none',
    webkitUserSelect: 'none',
    zIndex: '15',
    display: shouldShowJoystick() ? 'block' : 'none',
  });

  baseEl = document.createElement('div');
  baseEl.id = 'virtual-joystick-base';
  Object.assign(baseEl.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(30, 20, 36, 0.5) 0%, rgba(15, 10, 20, 0.75) 100%)',
    border: '2px solid rgba(240, 168, 96, 0.45)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
  });

  knobEl = document.createElement('div');
  knobEl.id = 'virtual-joystick-knob';
  Object.assign(knobEl.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: (knobRadius * 2) + 'px',
    height: (knobRadius * 2) + 'px',
    marginLeft: '-' + knobRadius + 'px',
    marginTop: '-' + knobRadius + 'px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, #f7c59f 0%, #e0793f 65%, #b85a25 100%)',
    border: '2px solid rgba(253, 246, 236, 0.85)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none',
    transform: 'translate(0px, 0px)',
    transition: 'transform 0.12s ease-out',
    boxSizing: 'border-box',
  });

  baseEl.appendChild(knobEl);
  containerEl.appendChild(baseEl);

  baseEl.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
  window.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true });

  baseEl.addEventListener('pointerdown', handleTouchStart, { capture: true });
  window.addEventListener('pointermove', handleTouchMove, { capture: true });
  window.addEventListener('pointerup', handleTouchEnd, { capture: true });
  window.addEventListener('pointercancel', handleTouchEnd, { capture: true });

  document.body.appendChild(containerEl);

  // ---------- 2. 점프 버튼 (우하단) ----------
  jumpBtnEl = document.createElement('div');
  jumpBtnEl.id = 'virtual-jump-button';
  jumpBtnEl.textContent = '점프';
  Object.assign(jumpBtnEl.style, {
    position: 'fixed',
    right: `calc(${jumpCfg.right || 24}px + env(safe-area-inset-right, 0px))`,
    bottom: `calc(${jumpCfg.bottom || 24}px + env(safe-area-inset-bottom, 0px))`,
    width: jumpSize + 'px',
    height: jumpSize + 'px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, #f7c59f 0%, #e0793f 65%, #b85a25 100%)',
    border: '2px solid rgba(253, 246, 236, 0.85)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
    boxSizing: 'border-box',
    display: shouldShowJump() ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fdf6ec',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard", sans-serif',
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '0.02em',
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)',
    touchAction: 'none',
    userSelect: 'none',
    webkitUserSelect: 'none',
    zIndex: '25',
    cursor: 'pointer',
    pointerEvents: 'auto',
    transition: 'transform 0.08s ease-out, filter 0.08s ease-out',
  });

  jumpBtnEl.addEventListener('touchstart', handleJumpTouchStart, { passive: false, capture: true });
  window.addEventListener('touchend', handleJumpTouchEnd, { passive: false, capture: true });
  window.addEventListener('touchcancel', handleJumpTouchEnd, { passive: false, capture: true });

  jumpBtnEl.addEventListener('pointerdown', handleJumpTouchStart, { capture: true });
  window.addEventListener('pointerup', handleJumpTouchEnd, { capture: true });
  window.addEventListener('pointercancel', handleJumpTouchEnd, { capture: true });

  document.body.appendChild(jumpBtnEl);

  // 모바일 터치 기기일 때 인벤토리 버튼이 점프 버튼(우하단)을 가리지 않도록 상단으로 오프셋
  if (isTouchDevice()) {
    const invBtn = document.getElementById('inventory-btn');
    if (invBtn) {
      invBtn.style.bottom = 'calc(96px + env(safe-area-inset-bottom, 0px))';
    }
  }

  // ---------- 3. 리사이즈 및 기기별 힌트 감시 ----------
  window.addEventListener('resize', () => {
    if (containerEl) containerEl.style.display = shouldShowJoystick() ? 'block' : 'none';
    if (jumpBtnEl) jumpBtnEl.style.display = shouldShowJump() ? 'flex' : 'none';
    if (isTouchDevice()) {
      const invBtn = document.getElementById('inventory-btn');
      if (invBtn) invBtn.style.bottom = 'calc(96px + env(safe-area-inset-bottom, 0px))';
    }
    updateBaseCenter();
  });

  window.addEventListener('blur', () => {
    resetJoystick();
    resetJump();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resetJoystick();
      resetJump();
    }
  });

  // 모바일 기기일 때 #hint 문구를 CONTROL_HINT_MOBILE로 자동 전환
  if (isTouchDevice()) {
    const hintEl = document.getElementById('hint');
    if (hintEl) {
      hintEl.textContent = CONTROL_HINT_MOBILE;
      const observer = new MutationObserver(() => {
        if (hintEl.textContent !== CONTROL_HINT_MOBILE) {
          hintEl.textContent = CONTROL_HINT_MOBILE;
        }
      });
      observer.observe(hintEl, { childList: true, characterData: true, subtree: true });
    }
  }

  isInitialized = true;
  updateBaseCenter();

  if (typeof window !== 'undefined') {
    window.__debug = window.__debug || {};
    window.__debug.joystick = {
      getAxis: () => ({ ...currentAxis }),
      container: containerEl,
      knob: knobEl,
      setAxis: (x, z) => {
        currentAxis.x = Math.max(-1, Math.min(1, x));
        currentAxis.z = Math.max(-1, Math.min(1, z));
      },
      reset: resetJoystick,
    };
    window.__debug.jumpButton = {
      isPressed: () => jumpPressed,
      element: jumpBtnEl,
      press: () => { jumpPressed = true; },
      release: () => { jumpPressed = false; },
      reset: resetJump,
    };
  }
}

export function getJoystickAxis() {
  ensureJoystick();
  if (isModalOpen()) {
    if (activeTouchId !== null) resetJoystick();
    return { x: 0, z: 0 };
  }
  return currentAxis;
}

export function isMobileJumpPressed() {
  ensureJoystick();
  if (isModalOpen()) {
    if (jumpPressed) resetJump();
    return false;
  }
  return jumpPressed;
}
