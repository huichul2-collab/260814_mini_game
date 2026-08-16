import * as THREE from 'three';
import { ROOMS } from '../world/layout.js';

// ⚠️ 이전 버전은 방마다 오렌지(4.6)/마젠타(4.6)/거실(0.35)처럼 색과
// 강도를 크게 벌려 "조명으로" 방을 구분시켰다. 그 결과 침실A 바닥이
// 강한 오렌지 포인트라이트에 씻겨(overexpose) 클리핑 픽셀(채널 255)이
// 다른 방의 7~14배로 튀었고, 재질 원본색이 화면에서 거의 안 남았다
// (측정: 바닥 R/G 2.39~2.65, 재질 원본 R/G 1.44~1.53).
// 방을 구분하는 건 조명의 몫이 아니라 lane-rooms가 채울 소품의 몫이다.
// 여기서는 전 구역에 같은 따뜻한 백색(채널 간 편차 25% 이내)을 낮은
// 강도(최대 1.5, 방 간 차이 ±0.3 이내)로만 얹어 재질 원본색이 살아남게 한다.
const ROOM_LIGHT_COLOR = 0xfff1de; // R255,G241,B222 — 채널비 R/B 1.15, 편차 25% 이내
const ROOM_LIGHT_INTENSITY = {
  living: 1.3,
  bedA: 1.4,
  study: 1.2,
  bedB: 1.5,
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
  // X[-3,7]·Z[-7,7](최대 반경 9.9m)까지 커진 뒤 방마다 밝기 차이가 잘 안
  // 느껴진다는 리포트에 대한 대응 — 단, 색과 강도 편차는 좁게 유지한다.
  const roomLights = ROOMS.map((room) => {
    const cx = (room.x0 + room.x1) / 2;
    const cz = (room.z0 + room.z1) / 2;
    const intensity = ROOM_LIGHT_INTENSITY[room.id] ?? 1.3;
    const light = new THREE.PointLight(ROOM_LIGHT_COLOR, intensity, 9, 1.6);
    light.position.set(cx, 1.9, cz);
    scene.add(light);
    return light;
  });

  return { hemi, key, fill, roomLights };
}
