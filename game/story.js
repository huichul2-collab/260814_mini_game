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
export const BOOKSHELF_BOOK_COUNTS = [0, 0, 3, 5];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export const OBJECTS = {
  'living.desk': { name: '책상', text: '오래 써서 반질반질해진 나무 책상.' },
  'living.chair': { name: '의자', text: '앉으면 삐걱 소리가 날 것 같다.' },
  'living.bookshelf': {
    name: '책장',
    text: `4칸 책장이다. 위에서부터 책이 ${BOOKSHELF_BOOK_COUNTS[0]}권, ${BOOKSHELF_BOOK_COUNTS[1]}권, ${BOOKSHELF_BOOK_COUNTS[2]}권, ${BOOKSHELF_BOOK_COUNTS[3]}권 꽂혀 있다.`,
    bookCounts: BOOKSHELF_BOOK_COUNTS,
  },
  'living.notepad': { name: '낙서장', text: '12월 24일. 오늘은 크리스마스 이브.' },
  'living.plant': { name: '화분', text: '누군가 꾸준히 물을 준 흔적이 있다.' },
  'living.frame': { name: '액자', text: '낡은 사진이 걸려 있다.' },
  'living.rug': { name: '러그', text: '푹신하고 붉은 러그.' },
  'living.lamp': { name: '스탠드 조명', text: '클릭하면 켜지고 꺼진다.' },
  'living.cushion': { name: '방석', text: '바닥에 놓인 방석.' },
  'living.clock': {
    name: '멈춘 시계',
    text: `${CLOCK_TIME.hour}시 ${pad2(CLOCK_TIME.minute)}분을 가리킨 채 멈춰 있다.`,
  },
  // M9-E(E-1) — variants 메커니즘 검증용 1번째 대상. 열쇠 조각을 하나라도
  // 얻기 전에는 이게 뭔지도 모른다(§12.2, §12.8 "이름 변경: 조립머신 →
  // '알 수 없는 기계'"). P5(열쇠 조립) 판정 자체는 story.OBJECT_PUZZLES가
  // 그대로 맡는다 — 여긴 "아직 안 풀린 상태"의 안내문만 조건부로 바뀐다.
  'living.assembler': {
    name: '알 수 없는 기계',
    variants: [
      { requires: { items: ['key_piece_1'] }, text: '구멍 세 개. 열쇠 조각이 들어갈 것 같다.' },
      { text: '구멍이 세 개 뚫려 있다. 용도를 알 수 없다.' }, // 조건 없음 = 기본, 항상 마지막
    ],
  },

  'study.diary': {
    name: '일기장',
    text: '펼쳐진 채로 놓여 있다. "하늘 · 땅 · 심장 · 바른손"',
    grantItems: ['uv_lantern', 'key_piece_1'], // §2 — 서재 조사의 보상 두 가지, 한 번에 지급
  },
  'study.pencilCase': { name: '필통', text: '지우개, 빨간 색연필, 0.5mm 샤프심, 검정 샤프가 들어 있다.' },
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
  // M9-E(E-4, §12.5) — "랜턴을 비춘다"와 "판을 겹친다"를 별개 발견으로
  // 나눈다. 백지 쪽 안내문(팝업 상단 promptText)이 UV 랜턴 보유 여부로
  // 바뀌는 건 variants가 맡고, 실제 글자 표시/겹치기 토글은 여전히
  // paperModal.js 안에서 처리한다(hasLantern/overlayOn). 아크릴판은
  // 이제 이 팝업과 무관하다 — paperClue를 빼서 그냥 평범한 소품이 됐다
  // ("따로 조사하면 '구멍이 뚫린 판이다' 정도만").
  'bedA.blankPaper': {
    name: '백지',
    paperClue: 'P3',
    variants: [
      { requires: { items: ['uv_lantern'] }, text: '자외선을 비추자 글자가 떠오른다.' },
      { text: '빈 종이다. 아무것도 쓰여 있지 않다.' }, // 조건 없음 = 기본
    ],
  },
  'bedA.acrylicPanel': { name: '아크릴판', text: '구멍이 뚫린 판이다.' },
  'bedA.keyPiece2': { name: '열쇠 조각', text: '작업대 위에 놓인 금속 조각.' },

  // M9-E(E-4, §12.6) — 톱니 미보유/보유 두 상태만 여기서 다룬다("이미
  // 해결"은 probe.js가 key_piece_3 소지 여부로 직접 판정한다 — 입력이
  // 필요한 다이얼 단계가 껴 있어 OBJECT_PUZZLES의 "가진 즉시 자동 해결"
  // 패턴이 안 맞는다, study.cabinet과 같은 이유로 이 오브젝트도 그
  // 테이블을 안 쓴다).
  'bedB.machine': {
    name: '기계 장치',
    variants: [
      { requires: { items: ['gear'] }, text: '톱니바퀴를 끼웠다. 다이얼을 돌려봐야겠다.' },
      { text: '축이 비어 있다. 무언가 끼워야 돌아갈 것 같다.' }, // 조건 없음 = 기본
    ],
  },
  'bedB.keyPiece3': { name: '열쇠 조각', text: '서랍 안에 있던 마지막 조각.' },

  // 배치1 보완 — 퍼즐과 무관한 순수 배경 소품. 설명도 그만큼 짧게.
  'bedA.shelf': { name: '선반', text: '별 특별할 것 없는 선반이다.' },
  'bedA.toolbox': { name: '공구 상자', text: '낡은 공구들이 들어 있다.' },
  // M9-E(E-1) — variants 메커니즘 검증용 2번째 대상: visitedAtLeast(§12.2,
  // §12.5). 두 상자 다 독립적으로 조사 횟수를 센다(state.js incrementVisit는
  // 오브젝트 id별).
  'bedA.crate1': {
    name: '나무 상자',
    variants: [
      { requires: { visitedAtLeast: 2 }, text: '힘들게 들었다. 아무것도 쓰여 있지 않다.' },
      { text: '밑에 뭔가 쓰여 있을까? 들어볼까.' },
    ],
  },
  'bedA.crate2': {
    name: '나무 상자',
    variants: [
      { requires: { visitedAtLeast: 2 }, text: '힘들게 들었다. 아무것도 쓰여 있지 않다.' },
      { text: '밑에 뭔가 쓰여 있을까? 들어볼까.' },
    ],
  },
  'bedB.cabinet': { name: '캐비닛', text: '오래된 캐비닛이다.' },
  'bedB.crateStack': { name: '상자 더미', text: '아무렇게나 쌓아둔 상자들이다.' },
  'bedB.oldRug': { name: '낡은 러그', text: '빛바랜 러그다.' },

  // M9-E(E-3, §12.4) — E-1의 variants를 실전에서 처음 쓰는 자리. 파이프렌치
  // 미보유/보유 두 상태만 있고 둘 다 여기서 끝난다(개봉·스크랩 열람 같은
  // 부수효과는 텍스트가 아니라 상태 변화라 variants가 못 맡는다 — 그건
  // interaction/probe.js가 found.id === 'study.cabinet'로 직접 처리한다,
  // machine.js 서랍 열기와 같은 패턴).
  'study.cabinet': {
    name: '캐비닛',
    variants: [
      { requires: { items: ['pipe_wrench'] }, text: '파이프렌치로 자물쇠를 부쉈다. 안에 신문 스크랩이 있다.' },
      { text: '잠겨 있다. 열쇠 구멍이 낡아 열쇠로도 열리지 않을 것 같다.' }, // 조건 없음 = 기본
    ],
  },
};

// M9-E(E-3, §12.7) — 캐비닛 개봉 후 열람 UI(ui/clippingsModal.js)가 그대로
// 읽어 보여주는 신문 스크랩 3장. 다이얼 퍼즐(§12.6, E-4)의 단서이기도
// 하다 — ②만 정답(좌3·우4·좌1), ①③은 함정. 문안은 §12.7 표 그대로.
export const NEWS_CLIPPINGS = [
  '주가가 3년 만에 최고치를 경신, 지수 3000 시대를 열었다.',
  '한 회에 홈런 3개. 첫 홈런은 왼쪽 담장을 넘겨 3득점, 다음은 오른쪽 담장을 넘긴 만루 홈런 4득점, 마지막은 왼쪽 담장을 넘긴 솔로 홈런.',
  '연쇄 살인사건, 마지막 사건 발생 이후 13일째. 미궁에 빠진 수사.',
];

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
  // M9-E(E-3, §12.5·§12.8) — 공방 공구상자에서 획득. 서재 캐비닛(§12.4)을
  // 여는 유일한 방법이다.
  pipe_wrench: { name: '파이프렌치', icon: '🔧', desc: '녹슨 파이프렌치. 낡은 자물쇠 정도는 부술 수 있을 것 같다.' },
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
  // M9-E(E-4, §12.6) — 보관소 다이얼. 신문 스크랩 ②(§12.7)에서 유도되는
  // 좌3·우4·좌1. 형식은 modal.js buildDialUI()가 직렬화하는 그대로
  // '[L|R][자릿수]' 반복 문자열이다 — 여기 말고 다른 곳에 새로 안 적는다.
  P4: {
    type: 'dial',
    answer: 'L3R4L1', // ⭐ 정답
    wrongText: '헛돈다.',
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
  // bedB.machine은 여기 없다 — M9-E(E-4)부터 톱니+다이얼 2단계라 "가진
  // 즉시 자동 해결"이 안 맞는다(위 OBJECTS.bedB.machine 주석 참고).
  // probe.js가 found.id === 'bedB.machine'로 직접 처리한다.
  'living.assembler': {
    requiredItems: ['key_piece_1', 'key_piece_2', 'key_piece_3'],
    // OBJECTS['living.assembler']에 variants가 있으므로 "아직 안 풀림"
    // 상태에서는 probe.js가 이 missingText 대신 그 variants를 쓴다(§12.2).
    // 여긴 variants가 없는 오브젝트를 위한 하위호환 fallback으로 남겨둔다.
    missingText: '아직 열쇠 조각이 다 모이지 않았다.',
    successText: '조각 세 개를 끼우자 열쇠가 완성됐다.',
    alreadyText: '이미 조립을 마쳤다.',
    rewardItems: ['front_key'],
  },
  // M9-E(E-3, §12.5) — requiredItems가 빈 배열이라 처음 클릭하면 바로
  // 지급된다(잠금 단계 없음, "공구상자: 획득 전 → ... 획득 후 → ..."
  // 두 단계뿐). rewardItems가 비어 있으면 안 된다 — probe.js의 "이미
  // 풀었는가" 판정(rewardItems.every(...))이 빈 배열에서 항상 참이 돼
  // 매 클릭이 alreadyText로 새는 버그가 난다(실제로 이 순서로 짜봤다가
  // 잡음, 그래서 캐비닛은 이 테이블을 안 쓰고 probe.js에서 직접 처리한다).
  'bedA.toolbox': {
    requiredItems: [],
    missingText: '', // requiredItems가 비어 있어 이 분기는 절대 안 탄다(방어적으로만 존재)
    successText: '낡은 공구들이 가득하다.',
    alreadyText: '쓸 만한 건 다 꺼냈다.',
    rewardItems: ['pipe_wrench'],
  },
};

// M9-C 배치2 / M9-D — D4로 마당에 들어간 순간 한 번만 뜨는 종료 연출 및 대사.
export const ENDING_TITLE = '— 탈출 성공 —';
export const ENDING_TEXT = '차가운 바깥 공기가 느껴진다. 드디어 이 집을 빠져나왔다.';

// M9-D: 게임 시작 시 3초 페이드인 중 화면에 순차 표시되는 인트로 독백 대사.
export const INTRO = [
  '눈을 떠보니 낯선 집이다.',
  '머리가 멍하고 아무것도 기억나지 않는다.',
  '어떻게든 여기서 나가야 한다.',
];

// M9-D: 페이드인 완료 후 화면 하단에 표시되는 조작법 안내.
export const CONTROL_HINT = 'WASD: 이동 · 마우스 드래그: 시점 회전 · 좌클릭: 조사 · Space: 점프';
