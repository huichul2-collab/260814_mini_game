import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  재질 팩토리 — chokepoint. M0 이후에는 "룩(look)" 레인만 이 파일을
 *  수정한다. 다른 모듈은 mat()/toonMat()을 소비만 한다.
 *
 *  LOOK.mode 로 카툰 램프 방식과 flat 방식을 스위치한다(A/B 비교용).
 *  ⚠️ toon 브랜치는 M0 후속 작업에서 기본값이 'flat'으로 바뀐다.
 * ------------------------------------------------------------------ */

// ---------- 카툰 그라디언트 맵 (셀 셰이딩 단계) ----------
function createToonGradient(steps) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) data[i] = Math.round((i / (steps - 1)) * 255);
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
const gradientMap = createToonGradient(4);

export const LOOK = { mode: 'flat' };

export function mat(color, extra = {}) {
  if (LOOK.mode === 'toon') {
    return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  }
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
}

// 기존 호출부 호환용 별칭 — 이름을 바꿔도 25곳의 makeMesh 호출부는 안 건드린다.
export const toonMat = mat;
