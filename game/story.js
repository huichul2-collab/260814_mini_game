/* ------------------------------------------------------------------ *
 *  game/story.js — ⭐ 대사·설명 전용 파일. 이 파일만 고치면 게임 속
 *  오브젝트 설명과 오프닝 대사가 바뀐다. 코드는 다른 파일에 있다.
 *
 *  OBJECTS의 키는 '방id.오브젝트id' 형식이다(예: 'living.desk').
 *  방id/오브젝트id는 각 방 파일(livingRoom.js 등)이 소품에 붙인 태그와
 *  정확히 같아야 한다 — tools/render-check/interaction-check.mjs가 이
 *  대응을 자동 검사한다(오타·누락은 검증 스크립트가 FAIL로 잡는다).
 * ------------------------------------------------------------------ */

// M9-B: 거실 시계가 가리키는 시각 — 바늘 각도(props/clock.js)와 P1 정답이
// 전부 이 값 하나에서 파생된다. 여기만 고치면 바늘 각도·시계 조사 대사·
// D2 정답이 전부 같이 바뀐다("단서와 정답이 두 곳에 적히면 반드시 어긋난다",
// docs/spec/M9-escape.md §10.3).
export const CLOCK_TIME = { hour: 8, minute: 25 };

function pad2(n) {
  return String(n).padStart(2, '0');
}

export const OBJECTS = {
  'living.desk': { name: '책상', text: '오래 써서 반질반질해진 나무 책상.' },
  'living.chair': { name: '의자', text: '앉으면 삐걱 소리가 날 것 같다.' },
  'living.bookshelf': { name: '책장', text: '책이 몇 권 꽂혀 있다.' },
  'living.plant': { name: '화분', text: '누군가 꾸준히 물을 준 흔적이 있다.' },
  'living.frame': { name: '액자', text: '낡은 사진이 걸려 있다.' },
  'living.rug': { name: '러그', text: '푹신하고 붉은 러그.' },
  'living.lamp': { name: '스탠드 조명', text: '클릭하면 켜지고 꺼진다.' },
  'living.cushion': { name: '방석', text: '바닥에 놓인 방석.' },
  'living.clock': {
    name: '멈춘 시계',
    text: `${CLOCK_TIME.hour}시 ${pad2(CLOCK_TIME.minute)}분을 가리킨 채 멈춰 있다.`,
  },
  'living.assembler': { name: '조립 머신', text: '홈이 세 개 뚫려 있다. 뭔가를 끼워야 할 것 같다.' },

  'study.diary': {
    name: '일기장',
    text: '펼쳐진 채로 놓여 있다. "하늘 · 땅 · 심장 · 바른손" — 무슨 순서인지 적혀 있다.',
    grantItems: ['uv_lantern', 'key_piece_1'], // §2 — 서재 조사의 보상 두 가지, 한 번에 지급
  },
  'study.keyPiece1': { name: '열쇠 조각', text: '금속으로 된 조각. 무언가의 일부처럼 보인다.' },

  // 서재 배경 가구 6개 — 순수 배경 소품(퍼즐 무관). P2 단서(일기장)를
  // 가리지 않게 짧고 담백하게. 특히 책장은 "빼곡하다" 정도로만 —
  // 여기 또 다른 단서가 있는 것처럼 오해하게 만들지 않는다(가짜 단서는
  // 플레이어를 지치게 한다).
  'study.desk': { name: '책상', text: '서류 몇 장이 놓인 책상이다.' },
  'study.chair': { name: '의자', text: '바퀴 달린 사무용 의자다.' },
  'study.bookshelf': { name: '책장', text: '책이 빼곡하다.' },
  'study.armchair': { name: '안락의자', text: '구석에 놓인 안락의자다.' },
  'study.teaTable': { name: '찻상', text: '작은 탁자다.' },
  'study.rug': { name: '러그', text: '바닥에 깔린 러그다.' },

  'bedA.workbench': { name: '작업대', text: '공구 자국이 가득한 낡은 작업대.' },
  // P3 단서 — 두 오브젝트 모두 같은 팝업을 연다(paperModal.js). §6.1대로
  // "UV를 비춘다/판을 겹친다"는 3D가 아니라 2D 팝업 안에서 처리한다.
  'bedA.blankPaper': { name: '백지', text: '아무것도 적혀 있지 않은 종이다.', paperClue: 'P3' },
  'bedA.acrylicPanel': { name: '아크릴판', text: '구멍이 뚫린 투명한 판. 뭔가를 겹쳐 보라는 뜻 같다.', paperClue: 'P3' },
  'bedA.keyPiece2': { name: '열쇠 조각', text: '작업대 위에 놓인 금속 조각.' },

  'bedB.machine': { name: '기계 장치', text: '가운데 홈이 비어 있다. 톱니바퀴가 필요해 보인다.' },
  'bedB.keyPiece3': { name: '열쇠 조각', text: '서랍 안에 있던 마지막 조각.' },

  // 배치1 보완 — 퍼즐과 무관한 순수 배경 소품. 설명도 그만큼 짧게.
  'bedA.shelf': { name: '선반', text: '별 특별할 것 없는 선반이다.' },
  'bedA.toolbox': { name: '공구 상자', text: '낡은 공구들이 들어 있다.' },
  'bedA.crate1': { name: '나무 상자', text: '평범한 나무 상자다.' },
  'bedA.crate2': { name: '나무 상자', text: '평범한 나무 상자다.' },
  'bedB.cabinet': { name: '캐비닛', text: '오래된 캐비닛이다.' },
  'bedB.crateStack': { name: '상자 더미', text: '아무렇게나 쌓아둔 상자들이다.' },
  'bedB.oldRug': { name: '낡은 러그', text: '빛바랜 러그다.' },
};

// M9-C 배치2: 인벤토리 아이템 6종(§4). icon은 이모지만 쓴다(§5 — 이미지
// 파일 금지, 무빌드·오프라인 원칙). key_piece_1~3은 이름이 같지만
// id는 서로 다르다 — 인벤토리에 3칸 따로 쌓인다("몇 개 남았는지 셀 수
// 있다"는 §4의 의도).
export const ITEMS = {
  uv_lantern: { name: 'UV 랜턴', icon: '🔦', desc: '자외선을 비추는 손전등. 숨겨진 글자를 드러낼 수 있을 것 같다.' },
  gear: { name: '철제 톱니바퀴', icon: '⚙️', desc: '이빨이 촘촘한 톱니바퀴. 뭔가의 홈에 끼우는 부품 같다.' },
  key_piece_1: { name: '열쇠 조각', icon: '🧩', desc: '열쇠의 일부로 보이는 금속 조각. 서재에서 찾았다.' },
  key_piece_2: { name: '열쇠 조각', icon: '🧩', desc: '열쇠의 일부로 보이는 금속 조각. 공방에서 찾았다.' },
  key_piece_3: { name: '열쇠 조각', icon: '🧩', desc: '열쇠의 일부로 보이는 금속 조각. 보관소에서 찾았다.' },
  front_key: { name: '현관 열쇠', icon: '🔑', desc: '조각 세 개를 조립해 완성한 열쇠. 현관문에 맞을 것 같다.' },
};

// M9-C 배치2: 문 4개 전부 잠근다(§10.1 예고대로 M9-B는 D2 하나였다).
// doorId로 이미 일반화된 world/doorLock.js·ui/modal.js·interaction/probe.js는
// 코드 수정 없이 이 데이터만으로 동작한다.
export const LOCKS = {
  D1: {
    puzzle: 'P2',
    lockedText: '화살표 자물쇠가 걸려 있다. 방향을 순서대로 눌러야 한다.',
    unlockedText: '자물쇠가 풀렸다.',
  },
  D2: {
    puzzle: 'P1',
    lockedText: '숫자 자물쇠가 걸려 있다. 네 자리다.',
    unlockedText: '자물쇠가 풀렸다.',
  },
  D3: {
    puzzle: 'P3',
    lockedText: '알파벳 자물쇠가 걸려 있다. 다섯 글자를 맞춰야 한다.',
    unlockedText: '자물쇠가 풀렸다.',
    rewardItems: ['gear', 'key_piece_2'], // §2 — D3 해제가 공방 보상의 트리거
  },
  D4: {
    puzzle: 'P_D4',
    lockedText: '현관문이 잠겨 있다. 열쇠가 필요해 보인다.',
    unlockedText: '문이 열렸다. 이제 나갈 수 있다.',
  },
};

export const PUZZLES = {
  P1: {
    type: 'digits',
    length: 4,
    answer: '0825', // ⭐ 정답 — 여기만 고치면 된다. CLOCK_TIME과 독립적으로 적는
    // 값이라, 여기 또는 CLOCK_TIME 둘 중 하나만 고치면 어긋난다 — 그래서
    // escape-flow.mjs 1번이 매번 자동으로 둘을 대조한다(사람이 놓쳐도 잡힘).
    wrongText: '맞지 않는다.',
  },
  P2: {
    type: 'arrows',
    length: 4,
    answer: '↑↓←→', // ⭐ 정답 — 일기장 힌트("하늘·땅·심장·바른손")의 해석 결과
    wrongText: '맞지 않는다.',
  },
  P3: {
    type: 'letters',
    length: 5,
    answer: 'TRUTH', // ⭐ 정답 — 백지+아크릴판 겹치기로 드러나는 글자(paperModal.js가
    // 이 값을 그대로 읽어 표시한다. 여기 말고 다른 곳에 "TRUTH"를 또 적지 않는다)
    wrongText: '맞지 않는다.',
  },
  // D4는 코드 입력이 아니라 아이템 소지 판정이다(§3 P5의 결과물).
  P_D4: {
    type: 'item',
    requiredItem: 'front_key',
    wrongText: '열쇠가 없다.',
  },
};

// M9-C 배치2: 문 잠금이 아니라 "아이템 소지 여부"로 풀리는 오브젝트
// 퍼즐 2개(P4, P5) — §3. 입력 UI가 없어 LOCKS/PUZZLES 구조를 그대로
// 쓰기엔 안 맞아서(door 하나에 물리는 게 아니라 오브젝트 자체가
// 대상) 별도 테이블로 둔다. rewardItems는 이미 소지 여부 자체가
// "풀었다"의 표시라 별도 완료 플래그가 필요 없다(§2 막힘 방지 원칙과
// 같은 이유 — 아이템은 안 사라진다).
export const OBJECT_PUZZLES = {
  'bedB.machine': {
    requiredItems: ['gear'],
    missingText: '톱니바퀴가 필요해 보인다.',
    successText: '톱니바퀴를 홈에 끼우자 서랍이 스르륵 열렸다.',
    alreadyText: '서랍이 열려 있다. 안은 비어 있다.',
    rewardItems: ['key_piece_3'],
  },
  'living.assembler': {
    requiredItems: ['key_piece_1', 'key_piece_2', 'key_piece_3'],
    missingText: '아직 열쇠 조각이 다 모이지 않았다.',
    successText: '조각 세 개를 끼우자 열쇠가 완성됐다.',
    alreadyText: '이미 조립을 마쳤다.',
    rewardItems: ['front_key'],
  },
};

// M9-C 배치2 — D4로 마당에 들어간 순간 한 번만 뜨는 종료 대사.
export const ENDING_TEXT = '차가운 바깥 공기가 느껴진다. 드디어 이 집을 빠져나왔다.';

// M9-A 시점에는 자리만 만들어둔다 — 오프닝 연출은 M9-B 이후 붙는다.
// 채워둔 두 줄은 예시이며, 실제 오프닝 도입 시 이 배열을 그대로 쓰거나
// 바꿔써도 된다.
export const INTRO = ['일어나 보니 모르는 공간이었다.', '여기서 나가야 한다.'];
