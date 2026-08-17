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
//
// ⚠️ 예전엔 한 반복(iteration) 안에서 겹치는 콜라이더를 배열 순서대로 전부
// 즉시 적용했다. 서로 무관한 콜라이더 2개가 각자 다른 축(예: 벽은 X만,
// 가구는 Z만)을 막는 좁은 코너에서는, 그 둘의 push를 순서대로 더한 합이
// 그 프레임 이동량을 정확히 상쇄해서 제자리에 고정되는 사례가 실측으로
// 확인됐다(docs/STATE.md, tools/render-check/stuck-diagnose.mjs 참고).
// 반복마다 "가장 깊이 겹친 콜라이더 하나만" 해소하고 다음 반복에서 전체를
// 다시 검사하는 MTV 정석 방식으로 바꾼다. 하나씩 푸니 반복이 더 필요해서
// 3→4로 늘렸다(콜라이더 수십 개 × 4회 × 60Hz는 로드맵의 "300개 전엔
// 최적화 금지" 기준에 비해 여전히 무시할 연산량).
//
// ⚠️ 다만 이 방식도 "정말 서로 무관한 두 콜라이더가 각자 진짜로 막고
// 있는" 경우(예: 거실 책상↔문D1 벽 잔여조각처럼 간격이 플레이어 지름보다
// 좁은 코너)는 못 뚫는다 — 하나를 풀어도 다른 하나가 여전히 겹쳐서 다음
// 반복에 다시 적용되고, 결국 둘 다 적용된 최종 위치는 순서와 무관하게
// 똑같다(실측 확인됨). 이건 알고리즘 버그가 아니라 그 지점이 두 콜라이더
// 모두에 반지름만큼 정확히 접하는 진짜 기하학적 끼임이기 때문이다.
export function resolve(pos, r, colliders, iterations = 4) {
  for (let it = 0; it < iterations; it++) {
    let deepest = null;
    for (const b of colliders) {
      const hit = circleVsAABB(pos.x, pos.z, r, b);
      if (!hit) continue;
      if (!deepest || hit.push > deepest.push) deepest = hit;
    }
    if (!deepest) break;
    pos.x += deepest.nx * deepest.push;
    pos.z += deepest.nz * deepest.push;
  }
}
