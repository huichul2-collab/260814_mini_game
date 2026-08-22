import * as THREE from 'three';
import { TAG } from '../core/tags.js';
import { INTERACTION_CONFIG } from '../../config.js';
import { OBJECTS, LOCKS, PUZZLES, ITEMS, OBJECT_PUZZLES } from '../../story.js';
import { showDialogue } from '../ui/dialogue.js';
import { showKeypadModal } from '../ui/modal.js';
import { showPaperModal } from '../ui/paperModal.js';
import { markInspected, isDoorUnlocked, unlockDoor, getInventory, addItem } from '../story/state.js';
import { rebuildFrom } from '../physics/colliders.js';
import { onFrame } from '../core/loop.js';

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

// 아이템 여러 개를 한 번에 지급하고 "○○을(를) 얻었다" 안내문을 만든다.
// 이미 갖고 있던 아이템은 다시 지급해도 안내문에 안 나온다(addItem이
// 멱등이라 상태는 안 바뀌지만, 매번 "얻었다"고 알리면 이상하다).
function grantItemsAndAnnounce(itemIds) {
  if (!itemIds || itemIds.length === 0) return '';
  const before = getInventory();
  const newlyGranted = itemIds.filter((id) => !before.includes(id));
  for (const id of itemIds) addItem(id);
  if (newlyGranted.length === 0) return '';
  return newlyGranted.map((id) => `${(ITEMS[id] && ITEMS[id].name) || id}을(를) 얻었다.`).join(' ');
}

// P4(기계장치 서랍) 전용 — Z- 방향으로 슬라이드해 열리는 연출(docs/spec/
// M9-escape.md §7 "숨은 서랍 ... 열리면 위치만 이동"). onFrame은 등록 해제
// API가 없어(core/loop.js) lamp.js의 펄스 애니메이션과 같은 패턴으로,
// 목표 시간에 도달하면 그 뒤로는 아무 것도 안 하는 콜백을 영구 등록한다.
function openMachineDrawer(machineGroup) {
  const drawer = machineGroup.getObjectByName('machineDrawer');
  if (!drawer || drawer.userData._opened) return;
  drawer.userData._opened = true;
  const startZ = drawer.position.z;
  const targetZ = startZ - 0.18;
  const duration = 0.6;
  let t = 0;
  onFrame((dt) => {
    if (t >= duration) return;
    t = Math.min(t + dt, duration);
    drawer.position.z = startZ + (targetZ - startZ) * (t / duration);
  });
}

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

    // M9-B/C: 잠긴 문 패널 — id가 'lock_D1'..'lock_D4' 형식이면 대화창이
    // 아니라 자물쇠 UI를 연다. 패널이 잠겨 있는 동안만 여기 도달한다
    // (해제되면 group.visible=false라 raycast가 애초에 이 오브젝트를 못
    // 맞힌다 — three.js Raycaster는 invisible 오브젝트를 건너뛴다).
    if (found.id.startsWith('lock_')) {
      const doorId = found.id.slice('lock_'.length);
      const lock = LOCKS[doorId];
      if (!lock) {
        console.warn('[probe] story.js LOCKS에 없는 문:', doorId);
        return;
      }
      if (isDoorUnlocked(doorId)) return; // 방어적 — 위 이유로 보통 도달 안 함
      const puzzle = PUZZLES[lock.puzzle];

      function unlockDoorPanel() {
        const unlockPanel = found.obj.userData._unlockPanel;
        if (unlockPanel) unlockPanel();
        unlockDoor(doorId);
        rebuildFrom(scene); // 콜라이더 재수집 — 패널 해제 절차의 마지막 단계
      }

      // D4처럼 코드 입력이 아니라 아이템 소지 여부만 보는 자물쇠(§3 P5의
      // 결과물인 현관 열쇠). 모달을 아예 안 띄운다 — 입력할 게 없다.
      if (puzzle.type === 'item') {
        if (!getInventory().includes(puzzle.requiredItem)) {
          showDialogue('', puzzle.wrongText);
          return;
        }
        unlockDoorPanel();
        showDialogue('', lock.unlockedText);
        return;
      }

      showKeypadModal({
        type: puzzle.type,
        promptText: lock.lockedText,
        length: puzzle.length,
        answer: puzzle.answer,
        wrongText: puzzle.wrongText,
        onSuccess: () => {
          unlockDoorPanel();
          const grantMsg = grantItemsAndAnnounce(lock.rewardItems);
          showDialogue('', grantMsg ? `${lock.unlockedText} ${grantMsg}` : lock.unlockedText);
        },
      });
      return;
    }

    // M9-C 배치2: P4(기계장치)·P5(조립머신) — 입력 없이 소지 여부만
    // 보는 오브젝트 퍼즐(§3). 별도 완료 플래그 없이 rewardItems를 이미
    // 갖고 있으면 그 자체가 "풀었다"는 뜻이다(아이템은 안 사라지므로).
    const objPuzzle = OBJECT_PUZZLES[found.id];
    if (objPuzzle) {
      const inv = getInventory();
      const entryName = (OBJECTS[found.id] && OBJECTS[found.id].name) || '';
      const already = objPuzzle.rewardItems.every((id) => inv.includes(id));
      if (already) {
        showDialogue(entryName, objPuzzle.alreadyText);
        markInspected(found.id);
        return;
      }
      const hasAll = objPuzzle.requiredItems.every((id) => inv.includes(id));
      if (!hasAll) {
        showDialogue(entryName, objPuzzle.missingText);
        return;
      }
      const grantMsg = grantItemsAndAnnounce(objPuzzle.rewardItems);
      showDialogue(entryName, grantMsg ? `${objPuzzle.successText} ${grantMsg}` : objPuzzle.successText);
      if (found.id === 'bedB.machine') openMachineDrawer(found.obj);
      markInspected(found.id);
      return;
    }

    const entry = OBJECTS[found.id];
    if (!entry) {
      console.warn('[probe] story.js OBJECTS에 없는 id:', found.id);
      return;
    }

    // P3 단서 — 백지/아크릴판 둘 다 같은 팝업을 연다(docs/spec/
    // M9-escape.md §3 P3, §6.1). 3D에서는 "조사" 클릭까지만 하고, UV
    // 랜턴 보유 여부·겹치기 토글은 전부 팝업 안에서 처리한다.
    if (entry.paperClue) {
      const puzzle = PUZZLES[entry.paperClue];
      showPaperModal({
        promptText: entry.text,
        hasLantern: getInventory().includes('uv_lantern'),
        answer: puzzle.answer,
      });
      markInspected(found.id);
      return;
    }

    let text = entry.text;
    if (entry.grantItems) {
      const grantMsg = grantItemsAndAnnounce(entry.grantItems);
      if (grantMsg) text = `${text} ${grantMsg}`;
    }
    showDialogue(entry.name, text);
    markInspected(found.id);
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
}
