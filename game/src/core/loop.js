/* ------------------------------------------------------------------ *
 *  프레임 콜백 레지스트리 — phase 순서 보장.
 *
 *  M0에서는 순서 없는 단일 리스트였지만(등록된 게 램프 애니메이션
 *  하나뿐), M1부터 이동→카메라 순서가 실제로 중요해졌다(카메라가
 *  이전 프레임 위치를 읽으면 한 프레임 지연 + 눈에 띄는 떨림이 생김).
 *  그래서 phase별 리스트로 나누고, 항상 SIM → POST_SIM → LATE 순으로
 *  실행한다. onFrame(fn)처럼 phase를 생략하면 SIM으로 등록된다 —
 *  기존 호출부(램프 애니메이션)가 그대로 동작하는 이유.
 * ------------------------------------------------------------------ */
export const Phase = Object.freeze({
  INPUT: 'input',
  SIM: 'sim',
  POST_SIM: 'postSim',
  LATE: 'late',
});

const ORDER = [Phase.INPUT, Phase.SIM, Phase.POST_SIM, Phase.LATE];
const listeners = { [Phase.INPUT]: [], [Phase.SIM]: [], [Phase.POST_SIM]: [], [Phase.LATE]: [] };

export function onFrame(fn, phase = Phase.SIM) {
  if (!listeners[phase]) throw new Error(`unknown phase: ${phase}`);
  listeners[phase].push(fn);
}

export function tick(dt) {
  for (const phase of ORDER) {
    for (const fn of listeners[phase]) fn(dt);
  }
}
