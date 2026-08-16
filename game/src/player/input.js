/* ------------------------------------------------------------------ *
 *  키보드 입력 상태. WASD/방향키 → -1..1 축. 대각선 정규화는 여기서
 *  하지 않는다 — controller.js가 카메라 기준으로 회전시킨 뒤 3D
 *  벡터로 정규화하는 게 한 번만 하면 되므로 더 간단하다.
 * ------------------------------------------------------------------ */
const keys = new Set();

// ⚠️ "키가 눌린 채 안 풀리는" 버그 리포트가 있었으나 tools/render-check/
// input-check.mjs로 W/A 인터리빙 6가지 + 드래그 중 키 입력 4가지, 총
// 10개 조합을 헤드리스로 재현 시도했는데 전부 축이 정확히 {x:0,z:0}으로
// 돌아왔다 — 재현 실패. document capture:true 리스닝(카메라 드래그의
// pointerdown/move가 캔버스에서 stopPropagation을 걸면 window 레벨
// bubble-phase 리스너가 못 받을 수 있다는 가설에 대한 방어), blur 외
// visibilitychange(hidden)에서도 클리어, Escape 탈출구를 방어책으로
// 추가한다. 실제 재현되면 여기 주석과 함께 원인을 다시 조사할 것.
window.addEventListener('keydown', (e) => keys.add(e.code), { capture: true });
window.addEventListener('keyup', (e) => keys.delete(e.code), { capture: true });
window.addEventListener('blur', () => keys.clear()); // 탭 전환 중 키가 눌린 채로 고정되는 것 방지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) keys.clear();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') keys.clear(); // 사용자용 탈출구 — 뭔가 꼬였을 때 수동 리셋
}, { capture: true });

export function getMoveAxis() {
  let x = 0;
  let z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  return { x, z };
}
