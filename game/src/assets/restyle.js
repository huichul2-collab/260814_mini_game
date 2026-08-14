import * as THREE from 'three';

export const Restyle = {
  KEEP: 'keep',
  TINT: 'tint',
  REPLACE: 'replace',
};

/**
 * 단순 해시 함수 (문자열 -> 정수)
 * Math.random() 대신 사용하여 새로고침 시에도 동일한 색상이 결정론적으로 지정되도록 함
 */
function stringHash(str) {
  let hash = 0;
  if (!str || str.length === 0) return 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * HSL 색상 공간에서 가장 가까운 팔레트 색상 탐색
 */
function findNearestColorHSL(targetColor, palette) {
  if (!palette || palette.length === 0) return null;
  const targetHsl = {};
  targetColor.getHSL(targetHsl);

  let minDiff = Infinity;
  let bestColor = new THREE.Color(palette[0]);

  for (const hexOrColor of palette) {
    const candidate = new THREE.Color(hexOrColor);
    const hsl = {};
    candidate.getHSL(hsl);

    let dh = Math.abs(hsl.h - targetHsl.h);
    if (dh > 0.5) dh = 1.0 - dh;
    const ds = Math.abs(hsl.s - targetHsl.s);
    const dl = Math.abs(hsl.l - targetHsl.l);

    const dist = dh * dh * 4.0 + ds * ds + dl * dl;
    if (dist < minDiff) {
      minDiff = dist;
      bestColor = candidate;
    }
  }
  return bestColor;
}

function processSingleMaterial(origMat, { mode, paletteMap, palette }) {
  if (!origMat) return new THREE.MeshLambertMaterial({ color: 0xcccccc });

  const matName = origMat.name || '';
  const hasVertexColors = origMat.vertexColors === true;

  if (mode === Restyle.KEEP || mode === Restyle.TINT) {
    // Standard / Physical 재질을 Lambert 재질로 강등하여 조명 일관성 유지
    const opts = {
      color: origMat.color ? origMat.color.clone() : new THREE.Color(0xffffff),
      map: origMat.map || null,
      transparent: origMat.transparent || false,
      alphaTest: origMat.alphaTest || 0,
      side: origMat.side || THREE.FrontSide,
      vertexColors: hasVertexColors,
      flatShading: true,
    };

    if (mode === Restyle.TINT && palette && palette.length > 0) {
      const tintHex = paletteMap[matName] || palette[stringHash(matName) % palette.length];
      opts.color = new THREE.Color(tintHex);
    }

    return new THREE.MeshLambertMaterial(opts);
  }

  if (mode === Restyle.REPLACE) {
    // 텍스처를 제거하고 단색 Lambert 재질로 교체
    let chosenColor = null;

    // 1. paletteMap 명시적 매핑
    if (paletteMap[matName]) {
      chosenColor = new THREE.Color(paletteMap[matName]);
    }
    // 2. 원본 material.color 기반 HSL 거리 탐색
    else if (origMat.color && palette && palette.length > 0) {
      chosenColor = findNearestColorHSL(origMat.color, palette);
    }
    // 3. 재질 이름 해시 결정론적 선택
    else if (palette && palette.length > 0) {
      const idx = stringHash(matName) % palette.length;
      chosenColor = new THREE.Color(palette[idx]);
    }
    // 4. 폴백 색상
    else {
      chosenColor = new THREE.Color(0x888888);
    }

    return new THREE.MeshLambertMaterial({
      color: chosenColor,
      flatShading: true,
      side: origMat.side || THREE.FrontSide,
    });
  }

  return origMat;
}

/**
 * 3D 모델(root) 내 모든 Mesh의 재질을 지정한 모드(KEEP, TINT, REPLACE)로 재정의
 */
export function restyle(root, { mode = Restyle.KEEP, paletteMap = {}, palette = [] } = {}) {
  root.traverse((node) => {
    if (node.isMesh) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((m) =>
          processSingleMaterial(m, { mode, paletteMap, palette })
        );
      } else {
        node.material = processSingleMaterial(node.material, { mode, paletteMap, palette });
      }
    }
  });
  return root;
}

/**
 * 새 GLB 에셋 로드 시 메타정보 진단을 위한 로그 출력 함수
 */
export function logMaterials(root) {
  console.log('--- Material Diagnostics ---');
  root.traverse((node) => {
    if (node.isMesh) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const hasUV = Boolean(node.geometry && node.geometry.attributes && node.geometry.attributes.uv);
      mats.forEach((m, idx) => {
        console.log(
          `[Mesh: "${node.name || 'unnamed'}"] Mat[${idx}]: name="${m?.name || 'unnamed'}", type=${m?.type}, color=#${m?.color ? m.color.getHexString() : 'none'}, hasMap=${Boolean(m?.map)}, hasUV=${hasUV}`
        );
      });
    }
  });
}
