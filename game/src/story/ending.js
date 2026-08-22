/* ------------------------------------------------------------------ *
 *  엔딩 트리거 — 마당(YARD)에 처음 들어선 순간 한 번만 종료 대사를
 *  띄운다. D4를 실제로 통과해서 걸어 들어가야만 도달 가능한 좌표라
 *  별도 "클리어" 판정 로직이 필요 없다(문이 잠겨 있으면 물리적으로
 *  못 들어간다). 오프닝 페이드인·사운드 등 연출은 M9-D 소관이라
 *  여기는 대사 한 줄만 담당한다.
 * ------------------------------------------------------------------ */
import { YARD } from '../world/layout.js';
import { showDialogue } from '../ui/dialogue.js';
import { hasFlag, setFlag } from './state.js';
import { ENDING_TEXT } from '../../story.js';

export function checkEnding(playerPos) {
  if (hasFlag('ending:shown')) return;
  const inYard =
    playerPos.x > YARD.x0 && playerPos.x < YARD.x1 &&
    playerPos.z > YARD.z0 && playerPos.z < YARD.z1;
  if (!inYard) return;
  setFlag('ending:shown');
  showDialogue('', ENDING_TEXT);
}
