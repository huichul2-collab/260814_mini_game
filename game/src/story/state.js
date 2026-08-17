/* ------------------------------------------------------------------ *
 *  게임 상태 단일 저장소. 플래그(Set)와 인벤토리(배열)만 갖는다 — 로직
 *  없음. "언제 어떤 플래그를 세울지"는 이 파일이 아니라 호출하는 쪽
 *  (interaction/probe.js 등)의 책임이다. 상태가 바뀌면 등록된 콜백을
 *  전부 부른다(ui/inventory.js가 이걸로 패널을 다시 그린다).
 * ------------------------------------------------------------------ */

const flags = new Set();
const inventory = [];
const listeners = [];

function notify() {
  for (const fn of listeners) fn();
}

export function hasFlag(id) {
  return flags.has(id);
}

export function setFlag(id) {
  if (flags.has(id)) return;
  flags.add(id);
  notify();
}

export function getInventory() {
  return inventory.slice();
}

export function addItem(id) {
  if (inventory.includes(id)) return;
  inventory.push(id);
  notify();
}

export function onChange(fn) {
  listeners.push(fn);
}

// M9-A 전용 헬퍼 — "조사한 적 있는 오브젝트" 기록. 'inspected:' 네임스페이스로
// 고정해 나중에 다른 종류의 플래그(퍼즐 해결 등, M9-B 이후)와 안 섞이게 한다.
export function markInspected(objectId) {
  setFlag(`inspected:${objectId}`);
}

export function hasInspected(objectId) {
  return hasFlag(`inspected:${objectId}`);
}
