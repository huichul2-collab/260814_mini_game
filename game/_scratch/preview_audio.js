import { playBGM, createSfxPool } from '../src/audio/audio.js';
import { initAudioGate } from '../src/audio/gate.js';
import { initFootsteps } from '../src/audio/footsteps.js';

const loadingEl = document.getElementById('loading');

let bgmSound = null;
let clickSfxPool = null;

initAudioGate(loadingEl, () => {
  console.log('[Preview Audio] Audio gate clicked - starting audio');
  bgmSound = playBGM('./assets/audio/bgm-main.mp3', { volume: 0.4, loop: true });
  clickSfxPool = createSfxPool('./assets/audio/sfx-click.mp3', 2, { volume: 0.8 });
  initFootsteps('./assets/audio/sfx-footstep.mp3', 0.38);

  console.log('[Preview Audio] BGM object initialized:', {
    hasBuffer: Boolean(bgmSound),
  });
});
