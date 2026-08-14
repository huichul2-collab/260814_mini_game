import * as THREE from 'three';
import { mat } from '../render/materials.js';
import { PLAYER } from '../config/player.js';

/* ------------------------------------------------------------------ *
 *  플레이스홀더 캡슐 캐릭터.
 *  ⚠️ M3에서 리깅된 GLB로 교체될 자리 — 지금은 A/B 레인(이동/카메라)이
 *  에셋 파이프라인 없이 개발 가능하도록 최소한의 스탠드인만 둔다.
 * ------------------------------------------------------------------ */
export function createPlayer(scene, spawn = [0, 0, 0]) {
  const root = new THREE.Group();
  root.position.set(spawn[0], 0, spawn[2]);
  scene.add(root);

  const bodyHeight = PLAYER.height - PLAYER.radius * 2;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER.radius, bodyHeight, 4, 8),
    mat(0xdfa25c)
  );
  body.position.y = PLAYER.height / 2;
  root.add(body);

  // 정면(-Z) 표시용 노즈 — 캡슐만으로는 어느 쪽을 보는지 안 보여서
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), mat(0xb15fd1));
  nose.position.set(0, PLAYER.height - 0.25, -PLAYER.radius - 0.02);
  nose.rotation.x = -Math.PI / 2;
  root.add(nose);

  return { root, radius: PLAYER.radius };
}
