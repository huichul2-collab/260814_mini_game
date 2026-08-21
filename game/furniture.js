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
 *              'blankPaper', 'acrylicPanel', 'machine')
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
  { id: 'bedA.blankPaper', room: 'bedA', type: 'blankPaper', pos: [0.60, 1.40, -6.90], rotY: 0 }, // §11.2 — 북벽, 창문 W1 오른쪽
  { id: 'bedA.acrylicPanel', room: 'bedA', type: 'acrylicPanel', pos: [1.60, 1.40, -6.90], rotY: 0 }, // §11.2 — 백지 옆
  { id: 'bedA.keyPiece2', room: 'bedA', type: 'keyPiece', pos: [-0.50, 0.80, -5.00], rotY: 0 }, // §11.2 — 작업대 위

  // ---------- 작업실 (study) ----------
  { id: null, room: 'study', type: 'studyDesk', pos: [5.5, 0, -1.55], rotY: 0 },
  { id: null, room: 'study', type: 'officeChair', pos: [5.5, 0, -0.9], rotY: 0 },
  { id: null, room: 'study', type: 'largeBookshelf', pos: [6.65, 0, 0.8], rotY: 0 },
  { id: null, room: 'study', type: 'armchair', pos: [4.2, 0, 2.45], rotY: 0 },
  { id: null, room: 'study', type: 'teaTable', pos: [5.15, 0.225, 2.45], rotY: 0 },
  { id: null, room: 'study', type: 'rectRug', pos: [5.2, 0.01, 0.3], rotY: 0 },
  { id: 'study.diary', room: 'study', type: 'diary', pos: [5.35, 0.78, -1.50], rotY: 0 }, // §11.2 — studyDesk 상판 위
  { id: 'study.keyPiece1', room: 'study', type: 'keyPiece', pos: [6.60, 1.05, 0.80], rotY: 0 }, // §11.2 — largeBookshelf 선반 위

  // ---------- 침실 B (bedB) → 보관소 ----------
  { id: 'bedB.machine', room: 'bedB', type: 'machine', pos: [0, 0, 5.20], rotY: 0 }, // §11.2 — 방 한가운데. keyPiece3는 machine 조형의 자식
];
