import * as THREE from 'three';
import { TAG } from '../core/tags.js';
import { INTERACTION_CONFIG } from '../../config.js';
import { OBJECTS, LOCKS, PUZZLES, ITEMS, OBJECT_PUZZLES, NEWS_CLIPPINGS } from '../../story.js';
import { showDialogue } from '../ui/dialogue.js';
import { showKeypadModal } from '../ui/modal.js';
import { showPaperModal } from '../ui/paperModal.js';
import { showClippingsModal } from '../ui/clippingsModal.js';
import { markInspected, isDoorUnlocked, unlockDoor, getInventory, addItem, hasFlag, setFlag, incrementVisit } from '../story/state.js';
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

// M9-E(E-1) — 조건부 설명(variants, docs/spec/M9-escape.md §12.2).
// requires의 세 키(items/flags/visitedAtLeast)는 전부 AND, requires
// 자체가 없으면(조건 없는 기본 항목) 항상 통과한다.
function checkRequires(requires, invSet, visitCount) {
  if (!requires) return true;
  if (requires.items && !requires.items.every((id) => invSet.has(id))) return false;
  if (requires.flags && !requires.flags.every((f) => hasFlag(f))) return false;
  if (requires.visitedAtLeast != null && visitCount < requires.visitedAtLeast) return false;
  return true;
}

// entry.variants가 있으면 위에서부터 첫 번째로 조건을 만족하는 항목의
// text를 쓴다(조건 없는 기본 항목이 배열 끝에 있어 항상 뭔가는 매치된다
// — interaction-check.mjs의 variants 정합성 검사가 이를 보장한다).
// variants가 없으면 기존 단일 text 필드 그대로(하위호환).
function resolveEntryText(entry, fallbackText, visitCount) {
  if (!entry || !entry.variants) return fallbackText;
  const invSet = new Set(getInventory());
  for (const variant of entry.variants) {
    if (checkRequires(variant.requires, invSet, visitCount)) return variant.text;
  }
  return fallbackText; // 정합성 검사를 통과했다면 위 루프에서 이미 반환됨 — 방어적 fallback
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

// M9-E(E-3) — 서재 캐비닛(§12.4) 개봉. variants(story.js)가 이미 텍스트
// 전환을 맡고 있으니 여기서는 "실제로 열렸는지"에 딸린 부수효과(신문
// 스크랩 자식 보이기 + flag + 열람 UI)만 처리한다 — machine.js 서랍
// 열기와 같은 급의 id 하드코딩 분기다(§12.2가 커버 못 하는 부분).
function revealNewsClippings(cabinetGroup) {
  const clippings = cabinetGroup.getObjectByName('newsClippings');
  if (clippings) clippings.visible = true;
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

  // 3인칭이라 카메라와 오브젝트 사이에 플레이어 캐릭터 자신이 흔히
  // 서 있다 — 레이가 캐릭터 몸(로봇 GLB, 메시 3개+스킨 2개)에 먼저
  // 맞으면 실제 대상을 코앞에 두고도 클릭이 무시된다(실사용 버그,
  // escape-flow.mjs가 카메라 yaw를 180도 돌려 우회하고 있던 게 증거).
  // 씬 구조가 바뀌어도 안전하게 조상을 거슬러 올라가며 player.root
  // 서브트리에 속한 히트를 건너뛴다.
  function isUnderPlayer(obj) {
    let cur = obj;
    while (cur) {
      if (cur === player.root) return true;
      cur = cur.parent;
    }
    return false;
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
    const firstRealHit = hits.find((h) => !isUnderPlayer(h.object));
    if (!firstRealHit) return;

    const found = findInteractive(firstRealHit.object);
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

    // M9-E(E-1): variants의 visitedAtLeast가 읽는 조사 횟수 — 이 지점(거리·
    // 방향 통과 이후, 실제로 뭔가 반응하기 직전)에서 한 번만 올린다. 문
    // 잠금 패널은 variants를 안 쓰지만 여기서 같이 올려도 무해하다.
    const visitCount = incrementVisit(found.id);

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

    // M9-E(E-4, §12.6) — 보관소 기계장치: 톱니 + 다이얼 2단. 입력(다이얼
    // 회전)이 끼어 있어 아래 OBJECT_PUZZLES의 "가진 즉시 자동 해결"
    // 패턴이 안 맞는다 — 문 자물쇠(lock_)와 같은 급의 전용 분기다. 이미
    // 풀렸는지는 key_piece_3 소지 여부로 판정한다(다른 오브젝트 퍼즐과
    // 같은 원칙 — 아이템은 안 사라지므로 그 자체가 "풀었다"는 표시).
    if (found.id === 'bedB.machine') {
      const machineEntry = OBJECTS['bedB.machine'];
      const inv = getInventory();
      if (inv.includes('key_piece_3')) {
        showDialogue(machineEntry.name, '서랍이 열려 있다. 안은 비어 있다.');
        markInspected(found.id);
        return;
      }
      const machineText = resolveEntryText(machineEntry, '', visitCount);
      if (!inv.includes('gear')) {
        showDialogue(machineEntry.name, machineText);
        markInspected(found.id);
        return;
      }
      showKeypadModal({
        type: 'dial',
        promptText: machineText,
        answer: PUZZLES.P4.answer,
        wrongText: PUZZLES.P4.wrongText,
        onSuccess: () => {
          const grantMsg = grantItemsAndAnnounce(['key_piece_3']);
          const successText = '톱니바퀴를 홈에 끼우자 서랍이 스르륵 열렸다.';
          showDialogue(machineEntry.name, grantMsg ? `${successText} ${grantMsg}` : successText);
          openMachineDrawer(found.obj);
        },
      });
      markInspected(found.id);
      return;
    }

    // M9-C 배치2: P5(조립머신) — 입력 없이 소지 여부만 보는 오브젝트
    // 퍼즐(§3). 별도 완료 플래그 없이 rewardItems를 이미 갖고 있으면
    // 그 자체가 "풀었다"는 뜻이다(아이템은 안 사라지므로).
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
        const missingText = resolveEntryText(OBJECTS[found.id], objPuzzle.missingText, visitCount);
        showDialogue(entryName, missingText);
        return;
      }
      const grantMsg = grantItemsAndAnnounce(objPuzzle.rewardItems);
      showDialogue(entryName, grantMsg ? `${objPuzzle.successText} ${grantMsg}` : objPuzzle.successText);
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
      // M9-E(E-4, §12.5) — "랜턴을 비춘다"와 "판을 겹친다"를 별개 발견으로
      // 나눈 부분: 팝업 상단 안내문도 UV 랜턴 보유 여부로 바뀐다(variants,
      // entry.text가 없으니 fallback은 방어적 빈 문자열).
      showPaperModal({
        promptText: resolveEntryText(entry, '', visitCount),
        hasLantern: getInventory().includes('uv_lantern'),
        answer: puzzle.answer,
      });
      markInspected(found.id);
      return;
    }

    let text = resolveEntryText(entry, entry.text, visitCount);
    if (entry.grantItems) {
      const grantMsg = grantItemsAndAnnounce(entry.grantItems);
      if (grantMsg) text = `${text} ${grantMsg}`;
    }
    showDialogue(entry.name, text);
    // M9-E(E-3, §12.4) — 파이프렌치를 갖고 캐비닛을 클릭한 순간이 곧
    // "열었다"다(별도 확인 입력 없음). 처음 여는 순간에만 flag를 세우고
    // 자식을 드러내지만, 열람 UI는 그 뒤로도 클릭할 때마다 다시 연다
    // (한 번 보고 닫으면 다시 볼 방법이 없어지면 안 된다).
    if (found.id === 'study.cabinet' && getInventory().includes('pipe_wrench')) {
      if (!hasFlag('cabinet_opened')) {
        setFlag('cabinet_opened');
        revealNewsClippings(found.obj);
      }
      showClippingsModal({ clippings: NEWS_CLIPPINGS });
    }
    markInspected(found.id);
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
}
