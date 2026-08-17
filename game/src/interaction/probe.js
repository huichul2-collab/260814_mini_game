import * as THREE from 'three';
import { TAG } from '../core/tags.js';
import { INTERACTION_CONFIG } from '../../config.js';
import { OBJECTS, LOCKS, PUZZLES } from '../../story.js';
import { showDialogue } from '../ui/dialogue.js';
import { showKeypadModal } from '../ui/modal.js';
import { markInspected, isDoorUnlocked, unlockDoor } from '../story/state.js';
import { rebuildFrom } from '../physics/colliders.js';

/* ------------------------------------------------------------------ *
 *  가까운 사물을 좌클릭하면 하단에 설명이 뜬다(M9-A 완료 조건 전체).
 *
 *  1. 레이캐스트로 클릭 대상을 찾는다 — scene.children 전체를 대상으로
 *     한다(사전 수집 리스트를 안 쓴다). 클릭당 한 번뿐이라 성능 문제가
 *     없고, 무엇보다 상호작용 대상이 아닌 물체에 가려져 있으면(occlusion)
 *     자연히 무시되는 게 맞는 동작이라 "전체 씬 레이캐스트 → 조상 태그
 *     탐색"이 사전 수집보다 정확하다.
 *  2. 히트한 메시부터 조상을 거슬러 올라가며 TAG.INTERACTIVE(문자열 id)를
 *     찾는다 — desk/chair 등은 Group에 태그를 붙이고 그 안의 개별 메시는
 *     안 붙이므로, 다리를 클릭해도 책상 전체가 반응해야 한다.
 *  3. 거리(XZ 평면, interactRadius 이내)와 방향(플레이어 정면 기준
 *     fovAngleDeg/2 반각 이내) 둘 다 통과해야 반응한다. 실패 사유별로
 *     다른 안내를 dialogue.js로 띄운다(성공 시와 같은 UI, 이름줄만 없음).
 *  4. livingRoom.js의 램프 클릭과 똑같은 방식으로 드래그를 걸러낸다 —
 *     followCamera.js는 import하지 않는다(world/interaction 모듈이
 *     camera 모듈을 몰라야 한다는 로드맵 §3 원칙).
 * ------------------------------------------------------------------ */

const _forward = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _targetPos = new THREE.Vector3();

export function initProbe(scene, camera, renderer, player) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const fovHalfRad = (INTERACTION_CONFIG.fovAngleDeg * Math.PI) / 180 / 2;

  let downX = 0;
  let downY = 0;
  let downT = 0;

  function setPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findInteractive(hitObject) {
    let cur = hitObject;
    while (cur) {
      const id = cur.userData[TAG.INTERACTIVE];
      if (id) return typeof id === 'string' ? { id, obj: cur } : null; // boolean true 태그는 대사 연결 불가
      cur = cur.parent;
    }
    return null;
  }

  function onPointerDown(e) {
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
  }

  function onPointerUp(e) {
    const movedDist = Math.hypot(e.clientX - downX, e.clientY - downY);
    const heldMs = performance.now() - downT;
    if (movedDist >= 5 || heldMs >= 300) return; // 드래그였다 — 상호작용 무시

    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    if (!hits.length) return;

    const found = findInteractive(hits[0].object);
    if (!found) return; // 상호작용 대상이 아닌 걸 클릭 — 조용히 무시

    found.obj.getWorldPosition(_targetPos);
    const playerPos = player.root.position;
    const dx = _targetPos.x - playerPos.x;
    const dz = _targetPos.z - playerPos.z;
    const dist = Math.hypot(dx, dz);

    if (dist > INTERACTION_CONFIG.interactRadius) {
      showDialogue('', '너무 멀다');
      return;
    }

    // player/controller.js의 facing 컨벤션과 동일: rotation.y=theta일 때
    // 정면 방향은 (sin theta, cos theta) — atan2(x,z)로 facing을 구하는
    // controller.js 코드와 짝을 맞춘 것.
    const yaw = player.root.rotation.y;
    _forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    if (dist > 1e-6) {
      _toTarget.set(dx, 0, dz).normalize();
    } else {
      _toTarget.copy(_forward);
    }
    const angle = _forward.angleTo(_toTarget);

    if (angle > fovHalfRad) {
      showDialogue('', '그쪽을 보고 있지 않다');
      return;
    }

    // M9-B: 잠긴 문 패널 — id가 'lock_D2' 형식이면 대화창이 아니라 키패드
    // 모달을 연다. 패널이 잠겨 있는 동안만 여기 도달한다 — 해제되면
    // group.visible=false라 raycast가 애초에 이 오브젝트를 못 맞힌다
    // (three.js Raycaster는 invisible 오브젝트를 건너뛴다).
    if (found.id.startsWith('lock_')) {
      const doorId = found.id.slice('lock_'.length);
      const lock = LOCKS[doorId];
      if (!lock) {
        console.warn('[probe] story.js LOCKS에 없는 문:', doorId);
        return;
      }
      if (isDoorUnlocked(doorId)) return; // 방어적 — 위 이유로 보통 도달 안 함
      const puzzle = PUZZLES[lock.puzzle];
      showKeypadModal({
        promptText: lock.lockedText,
        length: puzzle.length,
        answer: puzzle.answer,
        wrongText: puzzle.wrongText,
        onSuccess: () => {
          const unlockPanel = found.obj.userData._unlockPanel;
          if (unlockPanel) unlockPanel();
          unlockDoor(doorId);
          rebuildFrom(scene); // 콜라이더 재수집 — 패널 해제 절차의 마지막 단계
          showDialogue('', lock.unlockedText);
        },
      });
      return;
    }

    const entry = OBJECTS[found.id];
    if (!entry) {
      console.warn('[probe] story.js OBJECTS에 없는 id:', found.id);
      return;
    }
    showDialogue(entry.name, entry.text);
    markInspected(found.id);
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
}
