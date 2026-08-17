import * as THREE from 'three';
import { camera } from '../core/context.js';
import { loadAudioBuffer } from '../assets/loaders.js';

// 헤드리스/가상 환경에서 AudioContext.currentTime이 NaN/비정상일 때 발생할 수 있는 WebAudio 예외 방지
if (typeof window !== 'undefined' && window.AudioParam) {
  const origLinear = AudioParam.prototype.linearRampToValueAtTime;
  if (origLinear) {
    AudioParam.prototype.linearRampToValueAtTime = function (value, endTime) {
      if (!Number.isFinite(value) || !Number.isFinite(endTime)) return;
      return origLinear.call(this, value, endTime);
    };
  }
  const origTarget = AudioParam.prototype.setTargetAtTime;
  if (origTarget) {
    AudioParam.prototype.setTargetAtTime = function (value, startTime, timeConstant) {
      if (!Number.isFinite(value) || !Number.isFinite(startTime) || !Number.isFinite(timeConstant)) return;
      return origTarget.call(this, value, startTime, timeConstant);
    };
  }
}

/**
 * 전역 AudioListener - 반드시 camera의 자식으로 등록
 */
export const listener = new THREE.AudioListener();
if (camera) {
  camera.add(listener);
}

/**
 * 배경음악(BGM) 재생
 */
export function playBGM(url, { volume = 0.5, loop = true } = {}) {
  const sound = new THREE.Audio(listener);
  loadAudioBuffer(url)
    .then((buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(loop);
      sound.setVolume(volume);
      sound.play();
    })
    .catch((err) => {
      console.warn(`[audio] BGM 로드 실패 (${url}):`, err.message || err);
    });
  return sound;
}

/**
 * 효과음(SFX) 라운드로빈 풀 생성
 * 단일 Audio 객체 재호출 시 리셋 방지 (발소리, 연타 등)
 */
export function createSfxPool(url, size = 4, { volume = 0.8 } = {}) {
  const pool = Array.from({ length: size }, () => new THREE.Audio(listener));
  let index = 0;
  let isLoaded = false;

  loadAudioBuffer(url)
    .then((buffer) => {
      pool.forEach((sound) => {
        sound.setBuffer(buffer);
        sound.setVolume(volume);
      });
      isLoaded = true;
    })
    .catch((err) => {
      console.warn(`[audio] SFX Pool 로드 실패 (${url}):`, err.message || err);
    });

  return {
    play() {
      if (!isLoaded) return;
      const current = pool[index];
      if (current.isPlaying) {
        current.stop();
      }
      current.play();
      index = (index + 1) % pool.length;
    },
    pool,
  };
}

/**
 * 3D 위치 기반 효과음 (PositionalAudio)
 * 방 스케일(3~6m)에 맞춘 감쇄 모델 오버라이드
 */
export function createPositionalSfx(url, mesh, { volume = 1.0, loop = false } = {}) {
  const posAudio = new THREE.PositionalAudio(listener);
  posAudio.setDistanceModel('linear');
  posAudio.setRefDistance(1.5);
  posAudio.setMaxDistance(10);
  posAudio.setRolloffFactor(1);

  if (mesh) {
    mesh.add(posAudio);
  }

  loadAudioBuffer(url)
    .then((buffer) => {
      posAudio.setBuffer(buffer);
      posAudio.setVolume(volume);
      posAudio.setLoop(loop);
    })
    .catch((err) => {
      console.warn(`[audio] Positional SFX 로드 실패 (${url}):`, err.message || err);
    });

  return posAudio;
}

// 탭 백그라운드 전환 시 AudioContext 일시정지 및 재개
document.addEventListener('visibilitychange', () => {
  try {
    const ctx = THREE.AudioContext.getContext();
    if (ctx) {
      if (document.hidden) {
        ctx.suspend();
      } else if (ctx.state === 'suspended') {
        ctx.resume();
      }
    }
  } catch (e) {
    console.warn('[audio] visibilitychange 처리 중 오류:', e);
  }
});
