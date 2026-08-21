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

  'study.diary': { name: '일기장', text: '펼쳐진 채로 놓여 있다. 손글씨가 빼곡하다.' },
  'study.keyPiece1': { name: '열쇠 조각', text: '금속으로 된 조각. 무언가의 일부처럼 보인다.' },

  'bedA.workbench': { name: '작업대', text: '공구 자국이 가득한 낡은 작업대.' },
  'bedA.blankPaper': { name: '백지', text: '아무것도 적혀 있지 않은 종이다.' },
  'bedA.acrylicPanel': { name: '아크릴판', text: '구멍이 뚫린 투명한 판. 뭔가를 겹쳐 보라는 뜻 같다.' },
  'bedA.keyPiece2': { name: '열쇠 조각', text: '작업대 위에 놓인 금속 조각.' },

  'bedB.machine': { name: '기계 장치', text: '가운데 홈이 비어 있다. 톱니바퀴가 필요해 보인다.' },
  'bedB.keyPiece3': { name: '열쇠 조각', text: '서랍 안에 있던 마지막 조각.' },
};

// M9-B: 잠긴 문. 이 배치에서는 D2 하나뿐이다 — D1/D3/D4는 M9-C에서 데이터
// 한 줄씩 추가한다(코드는 이미 doorId로 일반화돼 있다, world/doorLock.js).
export const LOCKS = {
  D2: {
    puzzle: 'P1',
    lockedText: '숫자 자물쇠가 걸려 있다. 네 자리다.',
    unlockedText: '자물쇠가 풀렸다.',
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
};

// M9-A 시점에는 자리만 만들어둔다 — 오프닝 연출은 M9-B 이후 붙는다.
// 채워둔 두 줄은 예시이며, 실제 오프닝 도입 시 이 배열을 그대로 쓰거나
// 바꿔써도 된다.
export const INTRO = ['일어나 보니 모르는 공간이었다.', '여기서 나가야 한다.'];
