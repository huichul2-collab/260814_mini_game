import * as THREE from 'three';
import { ROOMS } from '../world/layout.js';

// 방마다 다른 색조 — bedA/bedB는 바닥색(0x9a6a45)이 완전히 같아서 은은한
// 포인트라이트 색조로라도 갈라주지 않으면 스크린샷에서 구분이 안 된다
// (tools/render-check/room-tint-check.mjs가 이걸 정량으로 잡아냄).
// "따뜻한 실내톤"은 유지하되 방마다 살짝 다른 방향으로 기울인다.
// ⚠️ 4개 방을 전부 강하게 채색하니 living이 계속 bedA(오렌지) 또는
// bedB(마젠타) 중 하나와 번갈아 겹쳤다(측정값이 조정할 때마다 요동침) —
// living의 바닥(0x8a5a3c)이 이미 따뜻한 갈색이라 어느 쪽으로 채색해도
// 기존 hemi/key/fill(전역광, 이것도 따뜻한 톤)와 겹치는 방향으로 수렴한다.
// 해결: living은 포인트라이트를 약하게 둬서 "기존 전역광 그대로의 중립"으로
// 남기고, 나머지 3개 방만 강하게 채색해 서로+living과 갈라놓는다.
const ROOM_LIGHT = {
  living: { color: 0xffe9c2, intensity: 0.35 },
  bedA: { color: 0xff5a10, intensity: 4.6 }, // 오렌지
  study: { color: 0xb89464, intensity: 4.6 }, // 차분한 앰버/올리브
  bedB: { color: 0xc23bc7, intensity: 4.6 }, // 마젠타/보라
};

export function setupLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xfbe9d0, 0x5a3f45, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe9c2, 1.15);
  key.position.set(2.4, 3.6, 2.2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9db8ff, 0.25);
  fill.position.set(-2.5, 1.6, -1.5);
  scene.add(fill);

  // 방마다 은은한 포인트라이트 — layout.js의 ROOMS를 읽어서 중심에 배치하므로
  // 좌표를 여기서 새로 만들지 않는다. 집이 원점 방 1개(반경 2.5m) 기준에서
  // X[-3,7]·Z[-7,7](최대 반경 9.9m)까지 커진 뒤 방마다 밝기/톤 차이가
  // 잘 안 느껴진다는 리포트에 대한 대응.
  const roomLights = ROOMS.map((room) => {
    const cx = (room.x0 + room.x1) / 2;
    const cz = (room.z0 + room.z1) / 2;
    const cfg = ROOM_LIGHT[room.id] ?? { color: 0xffe9c2, intensity: 0.35 };
    const light = new THREE.PointLight(cfg.color, cfg.intensity, 9, 1.6);
    light.position.set(cx, 1.9, cz);
    scene.add(light);
    return light;
  });

  return { hemi, key, fill, roomLights };
}
