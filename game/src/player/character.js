import * as THREE from 'three';
import { loadGLTF } from '../assets/loaders.js';
import { fitHeight, dropToFloor } from '../assets/normalize.js';
import { restyle, Restyle } from '../assets/restyle.js';
import { PLAYER } from '../config/player.js';
import { onFrame, Phase } from '../core/loop.js';
import { getMoveAxis } from './input.js';

/**
 * 대소문자 구분 없이 키워드 기반으로 애니메이션 클립을 찾는 헬퍼 함수
 */
function findClip(animations, keywords) {
  if (!animations || !animations.length) return null;
  for (const kw of keywords) {
    const found = animations.find((a) => a.name.toLowerCase().includes(kw.toLowerCase()));
    if (found) return found;
  }
  return animations[0];
}

/**
 * 리깅된 3D 캐릭터 생성 및 애니메이션/이동 상태 동기화 모듈
 * @param {THREE.Scene} scene 
 * @param {Array<number>} spawn [x, y, z] 스폰 위치
 * @returns {{ root: THREE.Group, radius: number, mixer: THREE.AnimationMixer|null, actions: Object }}
 */
export function createPlayer(scene, spawn = [0, 0, 0]) {
  const root = new THREE.Group();
  root.position.set(spawn[0], 0, spawn[2]);
  scene.add(root);

  // 비동기 로딩 전 플레이스홀더 (캡슐)
  const placeholder = new THREE.Group();
  const bodyHeight = PLAYER.height - PLAYER.radius * 2;
  const bodyMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER.radius, bodyHeight, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0xdfa25c, flatShading: true })
  );
  bodyMesh.position.y = PLAYER.height / 2;
  placeholder.add(bodyMesh);
  root.add(placeholder);

  const player = {
    root,
    radius: PLAYER.radius,
    mixer: null,
    actions: {},
    currentAction: null,
  };

  let walkAction = null;
  let idleAction = null;

  // 캐릭터 GLB 에셋 비동기 로드
  loadGLTF('./assets/glb/character-robot.glb')
    .then((gltf) => {
      const model = gltf.scene;

      // 1. 모델 크기/위치 정규화 (1.7m 높이맞춤, 지면 접지)
      fitHeight(model, PLAYER.height);
      dropToFloor(model);

      // 2. 렌더링 톤 맞춤 (Lambert flatShading 강등)
      restyle(model, { mode: Restyle.KEEP });

      // 3. 기존 플레이스홀더 제거 후 3D 모델 추가
      root.remove(placeholder);
      root.add(model);

      // 4. 애니메이션 믹서 및 액션 바인딩
      if (gltf.animations && gltf.animations.length > 0) {
        player.mixer = new THREE.AnimationMixer(model);

        const walkClip = findClip(gltf.animations, ['walk', 'walking', 'run', 'running']);
        const idleClip = findClip(gltf.animations, ['idle', 'standing', 'still']);

        if (walkClip) {
          walkAction = player.mixer.clipAction(walkClip);
          player.actions['walk'] = walkAction;
        }

        if (idleClip) {
          idleAction = player.mixer.clipAction(idleClip);
          player.actions['idle'] = idleAction;
        }

        // 초기 기본 애니메이션 재생 (Idle 우선)
        const initialAction = idleAction || walkAction;
        if (initialAction) {
          initialAction.play();
          player.currentAction = initialAction;
        }
      }
    })
    .catch((err) => {
      console.warn('[character] GLB 로드 실패 fallback 캡슐 유지:', err);
    });

  // 매 프레임 애니메이션 믹서 업데이트 및 이동 상태(WASD) 기반 액션 교체
  onFrame((dt) => {
    if (player.mixer) {
      player.mixer.update(dt);
    }

    if (!walkAction && !idleAction) return;

    const axis = getMoveAxis();
    const isMoving = axis.x !== 0 || axis.z !== 0;
    const targetAction = isMoving ? (walkAction || idleAction) : (idleAction || walkAction);

    if (targetAction && player.currentAction !== targetAction) {
      if (player.currentAction) {
        player.currentAction.fadeOut(0.2);
      }
      targetAction.reset().fadeIn(0.2).play();
      player.currentAction = targetAction;
    }
  }, Phase.SIM);

  return player;
}
