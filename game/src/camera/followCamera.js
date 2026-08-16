import * as THREE from 'three';
import { onFrame, Phase } from '../core/loop.js';
import { TAG } from '../core/tags.js';
import { CAM } from '../config/camera.js';

/* ------------------------------------------------------------------ *
 *  3인칭 추적 카메라 — 드래그로 회전, 감쇠 추적, 벽 충돌(당김은 즉시,
 *  복귀는 천천히). controller.js와 정확히 같은 컨벤션을 쓴다: yaw=0일
 *  때 카메라는 target의 +Z 쪽에 위치하고, 전진(W)은 -Z 방향.
 * ------------------------------------------------------------------ */
const UP = new THREE.Vector3(0, 1, 0);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createFollowCamera(camera, domElement, target, scene) {
  // zoom: 휠로 조절하는 "원하는" 거리. currentDistance: 벽 충돌로 실제 보정된 거리.
  const state = { yaw: CAM.initialYaw, pitch: CAM.initialPitch, zoom: CAM.initialDistance };
  let currentDistance = CAM.initialDistance;

  // 시야를 가릴 수 있는 대상(TAG.FADEABLE, 주로 벽)을 한 번만 수집한다 —
  // 매 프레임 scene.traverse()는 하지 않는다.
  const losTargets = [];
  scene.traverse((o) => {
    if (o.isMesh && o.userData[TAG.FADEABLE]) losTargets.push(o);
  });

  // ---------- 드래그로 회전 ----------
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let moved = 0;

  domElement.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    moved = 0;
  });
  // 기준(반전 없음) 부호: 오른쪽으로 드래그(dx>0)하면 yaw 감소, 아래로
  // 드래그(dy>0)하면 pitch 감소. CAM.invertX/invertY(기본 true)가 이 부호를
  // 뒤집는다 — 숫자를 여기 흩뿌리지 않고 config/camera.js 한 곳에서만 조정.
  const signX = CAM.invertX ? 1 : -1;
  const signY = CAM.invertY ? 1 : -1;
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    state.yaw += signX * dx * CAM.dragSensitivity;
    state.pitch = clamp(state.pitch + signY * dy * CAM.dragSensitivity, CAM.minPitch, CAM.maxPitch);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  // ---------- 휠로 줌 ----------
  domElement.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault(); // 페이지 스크롤 방지
      state.zoom = clamp(state.zoom + e.deltaY * CAM.zoomSensitivity, CAM.minDistance, CAM.maxDistance);
    },
    { passive: false }
  );

  const smoothTarget = new THREE.Vector3();
  let hasTarget = false;
  const raycaster = new THREE.Raycaster();
  const backDir = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const rayDir = new THREE.Vector3();
  const finalPos = new THREE.Vector3();

  onFrame((dt) => {
    const headX = target.x;
    const headY = target.y + CAM.headHeight;
    const headZ = target.z;

    if (!hasTarget) {
      smoothTarget.set(headX, headY, headZ);
      hasTarget = true;
    } else {
      const k = 1 - Math.exp(-CAM.followLambda * dt);
      smoothTarget.x += (headX - smoothTarget.x) * k;
      smoothTarget.y += (headY - smoothTarget.y) * k;
      smoothTarget.z += (headZ - smoothTarget.z) * k;
    }

    backDir.set(0, 0, 1).applyAxisAngle(UP, state.yaw);
    const horiz = state.zoom * Math.cos(state.pitch);
    const height = state.zoom * Math.sin(state.pitch);
    desired.copy(smoothTarget).addScaledVector(backDir, horiz);
    desired.y += height;

    // 카메라 충돌: smoothTarget → desired 레이 하나로 당김 거리 계산
    const wantDistance = smoothTarget.distanceTo(desired);
    let hitDistance = null;
    if (losTargets.length && wantDistance > 0.01) {
      rayDir.copy(desired).sub(smoothTarget).normalize();
      raycaster.set(smoothTarget, rayDir);
      raycaster.far = wantDistance;
      const hits = raycaster.intersectObjects(losTargets, false);
      if (hits.length) hitDistance = Math.max(0.3, hits[0].distance - CAM.collisionSkin);
    }

    if (hitDistance !== null && hitDistance < currentDistance) {
      currentDistance = hitDistance; // 당김은 즉시 — 벽 뒤가 보이면 안 되니까
    } else {
      const goal = hitDistance !== null ? hitDistance : wantDistance;
      currentDistance += (goal - currentDistance) * (1 - Math.exp(-CAM.pullOutLambda * dt)); // 복귀는 천천히
    }

    const scale = wantDistance > 0.001 ? currentDistance / wantDistance : 1;
    finalPos.copy(smoothTarget).lerp(desired, scale);

    camera.position.copy(finalPos);
    camera.lookAt(smoothTarget);
  }, Phase.POST_SIM);

  return {
    getYaw: () => state.yaw,
    wasDrag: () => moved > 5,
  };
}
