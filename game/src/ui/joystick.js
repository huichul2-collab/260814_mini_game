import { JOYSTICK_CONFIG } from '../../config.js';
import { isTouchDevice } from '../audio/gate.js';

let containerEl = null;
let baseEl = null;
let knobEl = null;
let activeTouchId = null;
let baseCenterX = 0;
let baseCenterY = 0;

const currentAxis = { x: 0, z: 0 };
let isInitialized = false;

function shouldShow() {
  if (JOYSTICK_CONFIG.mode === 'off') return false;
  if (JOYSTICK_CONFIG.mode === 'on') return true;
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

function handleTouchStart(e) {
  if (activeTouchId !== null) return;
  const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
  const maxLeftX = window.innerWidth * (JOYSTICK_CONFIG.leftZoneRatio || 0.40);

  for (const touch of touches) {
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    if (clientX > maxLeftX) continue;

    const id = touch.identifier !== undefined ? touch.identifier : (touch.pointerId !== undefined ? touch.pointerId : 0);
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
    const id = touch.identifier !== undefined ? touch.identifier : (touch.pointerId !== undefined ? touch.pointerId : 0);
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
    const id = touch.identifier !== undefined ? touch.identifier : (touch.pointerId !== undefined ? touch.pointerId : 0);
    if (id === activeTouchId) {
      resetJoystick();
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
    display: shouldShow() ? 'block' : 'none',
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

  window.addEventListener('resize', () => {
    if (containerEl) {
      containerEl.style.display = shouldShow() ? 'block' : 'none';
    }
    updateBaseCenter();
  });

  document.body.appendChild(containerEl);
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
  }
}

export function getJoystickAxis() {
  ensureJoystick();
  return currentAxis;
}
