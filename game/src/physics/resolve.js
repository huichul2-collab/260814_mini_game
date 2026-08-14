/* ------------------------------------------------------------------ *
 *  원(캐릭터) vs 2D AABB(콜라이더) 최소이동(MTV) 밀어내기.
 *  three import 없는 순수 함수 — physics/colliders.js가 만든 평면 배열만 소비한다.
 *
 *  축분리(X 먼저, Z 나중) 대신 MTV를 쓰는 이유: 축분리는 모서리·문틀처럼
 *  콜라이더 두 개가 동시에 겹치는 지점에서 멈춰버리고, 탭 전환 후 dt
 *  급증으로 지오메트리 안에 들어가면 복구가 안 된다. MTV는 미끄러짐이
 *  공짜로 나오고, 안에 갇혀도 스스로 빠져나온다.
 * ------------------------------------------------------------------ */

export function circleVsAABB(cx, cz, r, b) {
  const qx = Math.min(Math.max(cx, b.minX), b.maxX);
  const qz = Math.min(Math.max(cz, b.minZ), b.maxZ);
  const dx = cx - qx;
  const dz = cz - qz;
  const d2 = dx * dx + dz * dz;

  if (d2 > 1e-10) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    return { nx: dx / d, nz: dz / d, push: r - d };
  }

  // 원 중심이 박스 내부에 들어간 경우 — 가장 짧은 면으로 밀어낸다.
  // 이 분기를 빠뜨리면 여기서 관통한다.
  const ol = cx - b.minX;
  const orr = b.maxX - cx;
  const ob = cz - b.minZ;
  const of = b.maxZ - cz;
  const m = Math.min(ol, orr, ob, of);
  if (m === ol) return { nx: -1, nz: 0, push: ol + r };
  if (m === orr) return { nx: 1, nz: 0, push: orr + r };
  if (m === ob) return { nx: 0, nz: -1, push: ob + r };
  return { nx: 0, nz: 1, push: of + r };
}

// pos: {x, z} 를 가진 아무 객체(THREE.Vector3도 그대로 통과). 제자리에서 수정한다.
export function resolve(pos, r, colliders, iterations = 3) {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const b of colliders) {
      const hit = circleVsAABB(pos.x, pos.z, r, b);
      if (!hit) continue;
      pos.x += hit.nx * hit.push;
      pos.z += hit.nz * hit.push;
      moved = true;
    }
    if (!moved) break;
  }
}
