/* ------------------------------------------------------------------ *
 *  키보드 입력 상태. WASD/방향키 → -1..1 축. 대각선 정규화는 여기서
 *  하지 않는다 — controller.js가 카메라 기준으로 회전시킨 뒤 3D
 *  벡터로 정규화하는 게 한 번만 하면 되므로 더 간단하다.
 * ------------------------------------------------------------------ */
const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
  }
  keys.add(e.code);
});

window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear()); // 탭 전환 중 키가 눌린 채로 고정되는 것 방지

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

