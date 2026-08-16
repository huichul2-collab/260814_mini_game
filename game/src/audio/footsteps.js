import { onFrame, Phase } from '../core/loop.js';
import { getMoveAxis } from '../player/input.js';
import { createSfxPool } from './audio.js';

/**
 * 캐릭터 WASD 이동 축을 감지하여 발소리(SFX Pool)를 보행 주기(interval)에 맞춰 자동 재생하는 모듈
 * ⚠️ main.js 등 외부 통합 시점에서 initFootsteps()를 호출하여 바인딩함
 * @param {string} url
 * @param {number} interval
 * @returns {{play: Function, pool: THREE.Audio[]}} 검증 스크립트가 재생 상태를 읽을 수 있도록 pool 반환 (playBGM이 sound를 반환하는 것과 같은 패턴)
 */
export function initFootsteps(url = './assets/audio/sfx-footstep.mp3', interval = 0.38) {
  const pool = createSfxPool(url, 4, { volume: 0.5 });
  let timer = 0;

  onFrame((dt) => {
    const axis = getMoveAxis();
    const moving = axis.x !== 0 || axis.z !== 0;
    if (!moving) {
      timer = 0;
      return;
    }
    timer += dt;
    if (timer >= interval) {
      pool.play();
      timer = 0;
    }
  }, Phase.SIM);

  return pool;
}
