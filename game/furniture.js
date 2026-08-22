/* ------------------------------------------------------------------ *
 *  game/furniture.js — ⭐ 방별 가구 및 소품 배치 데이터 파일
 *
 *  가구의 좌표, 회전, 종류(type)를 관리합니다.
 *  각 배치 항목 필드 설명:
 *    - id    : 상호작용 ID (story.js OBJECTS 키와 1:1 대응, 없는 소품은 null)
 *    - room  : 가구가 위치할 방 ID ('living', 'bedA', 'study', 'bedB')
 *    - type  : 가구 조형 함수 타입 ('desk', 'chair', 'bookshelf', 'plant',
 *              'frame', 'rug', 'lamp', 'cushion', 'clock', 'assembler',
 *              'studyDesk', 'officeChair', 'largeBookshelf', 'armchair',
 *              'teaTable', 'rectRug', 'diary', 'keyPiece', 'workbench',
 *              'blankPaper', 'acrylicPanel', 'machine', 'shelf', 'toolbox',
 *              'crate', 'crateStack', 'cabinet', 'oldRug')
 *    - pos   : 월드 좌표 [X, Y, Z] (단위: 미터)
 *    - rotY  : Y축 수평 회전각 (단위: 라디안, 기본값: 0)
 * ------------------------------------------------------------------ */

export const FURNITURE = [
  // ---------- 거실 (living) ----------
  { id: 'living.rug', room: 'living', type: 'rug', pos: [0.2, 0.02, 0.9], rotY: 0 },
  { id: 'living.desk', room: 'living', type: 'desk', pos: [0.4, 0, -2.66], rotY: 0 },
  { id: 'living.lamp', room: 'living', type: 'lamp', pos: [0.75, 0.75, -2.66], rotY: 0 },
  { id: 'living.chair', room: 'living', type: 'chair', pos: [0.4, 0, -1.75], rotY: 0 },
  { id: 'living.bookshelf', room: 'living', type: 'bookshelf', pos: [-2.75, 0, 1.8], rotY: 0 },
  { id: 'living.plant', room: 'living', type: 'plant', pos: [-2.75, 0, 1.15], rotY: 0 },
  { id: 'living.frame', room: 'living', type: 'frame', pos: [1.0, 1.55, -2.88], rotY: 0 },
  { id: 'living.cushion', room: 'living', type: 'cushion', pos: [0.9, 0.04, 1.5], rotY: 0 },
  { id: 'living.clock', room: 'living', type: 'clock', pos: [2.90, 1.60, -1.10], rotY: -Math.PI / 2 }, // §11.2 — 서벽 → 동벽 북쪽 구간
  { id: 'living.assembler', room: 'living', type: 'assembler', pos: [1.40, 0, 2.60], rotY: Math.PI }, // §11.2 — 남벽 D3 동쪽 잔여

  // ---------- 침실 A (bedA) → 공방 ----------
  { id: 'bedA.workbench', room: 'bedA', type: 'workbench', pos: [-0.50, 0, -5.00], rotY: 0 }, // §11.2 — 방 중앙
  // 배치1 보완: y 1.40→1.15(창문 y중심 1.4보다 아래), x 0.60→0.75(백지)
  // /1.60→1.45(아크릴판) — 창문과 안 헷갈리게, 둘 사이 간격은 좁혀서
  // 한 세트로 보이게. 창문 우단(0.2)·동벽(1.94) 제약은 그대로 지킨다.
  { id: 'bedA.blankPaper', room: 'bedA', type: 'blankPaper', pos: [0.75, 1.15, -6.90], rotY: 0 },
  { id: 'bedA.acrylicPanel', room: 'bedA', type: 'acrylicPanel', pos: [1.45, 1.15, -6.90], rotY: 0 },
  { id: 'bedA.keyPiece2', room: 'bedA', type: 'keyPiece', pos: [-0.50, 0.80, -5.00], rotY: 0 }, // §11.2 — 작업대 위
  // 배치1 보완: 순수 배경 소품(퍼즐 무관). 문 앞 통로·작업대 주변은 비움.
  { id: 'bedA.shelf', room: 'bedA', type: 'shelf', pos: [1.92, 1.0, -5.6], rotY: -Math.PI / 2 },
  { id: 'bedA.toolbox', room: 'bedA', type: 'toolbox', pos: [-1.0, 0, -6.3], rotY: 0 },
  { id: 'bedA.crate1', room: 'bedA', type: 'crate', pos: [-2.74, 0, -6.0], rotY: 0 },
  { id: 'bedA.crate2', room: 'bedA', type: 'crate', pos: [1.2, 0, -4.0], rotY: Math.PI / 6 },

  // ---------- 작업실 (study) ----------
  // 배경 가구 6개 — M9-A "study는 나중에" / M9-C "study는 손대지 마라"
  // 사이에서 id 부여 단계가 통째로 빠져 있었다(클릭 불가 버그). 좌표·
  // 조형은 그대로, id만 추가한다.
  { id: 'study.desk', room: 'study', type: 'studyDesk', pos: [5.5, 0, -1.55], rotY: 0 },
  { id: 'study.chair', room: 'study', type: 'officeChair', pos: [5.5, 0, -0.9], rotY: 0 },
  { id: 'study.bookshelf', room: 'study', type: 'largeBookshelf', pos: [6.65, 0, 0.8], rotY: 0 },
  { id: 'study.armchair', room: 'study', type: 'armchair', pos: [4.2, 0, 2.45], rotY: 0 },
  { id: 'study.teaTable', room: 'study', type: 'teaTable', pos: [5.15, 0.225, 2.45], rotY: 0 },
  { id: 'study.rug', room: 'study', type: 'rectRug', pos: [5.2, 0.01, 0.3], rotY: 0 },
  { id: 'study.diary', room: 'study', type: 'diary', pos: [5.35, 0.78, -1.50], rotY: 0 }, // §11.2 — studyDesk 상판 위
  { id: 'study.keyPiece1', room: 'study', type: 'keyPiece', pos: [6.60, 1.05, 0.80], rotY: 0 }, // §11.2 — largeBookshelf 선반 위

  // ---------- 침실 B (bedB) → 보관소 ----------
  { id: 'bedB.machine', room: 'bedB', type: 'machine', pos: [0, 0, 5.20], rotY: 0 }, // §11.2 — 방 한가운데. keyPiece3는 machine 조형의 자식
  // 배치1 보완: 순수 배경 소품(퍼즐 무관). 기계장치 사방 1.0m는 비움.
  { id: 'bedB.cabinet', room: 'bedB', type: 'cabinet', pos: [-1.69, 0, 6.15], rotY: Math.PI / 2 },
  { id: 'bedB.crateStack', room: 'bedB', type: 'crateStack', pos: [1.03, 0, 4.28], rotY: 0 },
  { id: 'bedB.oldRug', room: 'bedB', type: 'oldRug', pos: [0, 0.01, 5.0], rotY: 0 },
  { id: 'living.notepad', room: 'living', type: 'notepad', pos: [0.35, 0.75, -2.66], rotY: 0 },
  { id: 'study.pencilCase', room: 'study', type: 'pencilCase', pos: [5.80, 0.75, -1.50], rotY: 0 },
];
