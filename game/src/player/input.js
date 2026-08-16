/* ------------------------------------------------------------------ *
 *  키보드 입력 상태. WASD/방향키 → -1..1 축. 대각선 정규화는 여기서
 *  하지 않는다 — controller.js가 카메라 기준으로 회전시킨 뒤 3D
 *  벡터로 정규화하는 게 한 번만 하면 되므로 더 간단하다.
 * ------------------------------------------------------------------ */
const keys = new Set();

// ⚠️ "키가 눌린 채 안 풀리는" 버그 방어책:
// document capture:true 리스닝, blur, visibilitychange(hidden), Escape 탈출구.
window.addEventListener(
  'keydown',
  (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
    }
    keys.add(e.code);
  },
  { capture: true }
);

window.addEventListener(
  'keyup',
  (e) => {
    keys.delete(e.code);
  },
  { capture: true }
);

window.addEventListener('blur', () => keys.clear()); // 탭 전환 중 키가 눌린 채로 고정되는 것 방지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) keys.clear();
});
window.addEventListener(
  'keydown',
  (e) => {
    if (e.code === 'Escape') keys.clear(); // 사용자용 탈출구 — 뭔가 꼬였을 때 수동 리셋
  },
  { capture: true }
);

export function getMoveAxis() {
  let x = 0;
  let z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  return { x, z };
}

export function isJumpPressed() {
  return keys.has('Space');
}
