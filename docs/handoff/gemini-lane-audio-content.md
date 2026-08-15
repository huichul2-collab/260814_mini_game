# Gemini 작업 지시서 — Lane: BGM/효과음 실제 에셋

> 이 문서는 이 프로젝트의 다른 대화 맥락을 전혀 모르는 상태에서 읽는다는 전제로 쓰였다.
> 필요한 배경은 전부 이 안에 있다. 모르는 걸 추측하지 말고, 애매하면 범위를 좁혀서 처리할 것.

## -1. 작업 공간 분리 (반드시 먼저 할 것 — 이거 안 하면 작업이 통째로 날아갈 수 있다)

**`C:\Users\hcyang\claude\claude_project\260814_mini_games` 폴더를 그대로 열어서 작업하지 마라.** 그 폴더는 Claude가 `main` 브랜치에서 동시에 M4(집 확장) 작업 중이다. 같은 폴더에서 브랜치를 전환하면 서로 커밋 안 된 변경사항이 뒤섞이거나 날아가는 사고가 실제로 있었다.

**시작 전에 반드시 별도 폴더에 저장소를 새로 클론해라**:
```
git clone https://github.com/huichul2-collab/260814_mini_game.git C:\Users\hcyang\gemini-workspace\lane-audio-content
cd C:\Users\hcyang\gemini-workspace\lane-audio-content
git checkout -b gemini/lane-audio-content origin/main
```
(경로 이름은 예시고, 다른 레인과 폴더만 겹치지 않으면 된다.)

이 새 클론 폴더 **안에서만** 작업하고, 커밋도 push도 전부 이 폴더에서 해라. 원본 `260814_mini_games` 폴더는 절대 열거나 건드리지 마라.

작업이 끝나면 `git push origin gemini/lane-audio-content`까지 하고 끝내라. `main`으로 merge하지 마라(§6 참고).

## 0. 이 프로젝트가 뭔가

취미로 만드는 3D 방/집 탐험 게임. Three.js(r185) + 순수 ES 모듈, **빌드 단계 없음**.

**오디오 재생 시스템은 이미 완성돼 있고 실제로 검증됐다** — `game/src/audio/audio.js`(`playBGM`, `createSfxPool`, `createPositionalSfx`), `game/src/audio/gate.js`(브라우저 오토플레이 정책 우회용 "게임 시작" 버튼, `#loading` 오버레이 안에 DOM으로 주입됨). 이 레인의 목표는 **실제로 재생할 오디오 파일을 구해서 넣는 것**이지, 재생 시스템 자체를 만드는 게 아니다. `audio.js`/`gate.js`는 이미 동작 확인됐으니 읽기만 하고 고치지 마라.

지금 `game/assets/audio/test.mp3`(4.1MB)이 테스트용으로 있는데, **이건 예산 초과 사례다** — §3에서 다룬다.

## 1. 네 작업 범위

**새로 만들 파일**:
- `game/assets/audio/` 안에 실제 BGM/SFX 파일들 (파일명은 소문자-케밥, 예: `bgm-main.mp3`, `sfx-footstep.mp3`)
- `game/src/audio/footsteps.js` (선택 사항, §4 참고 — 발소리를 이동에 맞춰 자동 재생하는 자체완결 모듈)
- 필요하면 `game/_scratch/preview_audio.html` + `.js` (검증용 임시 페이지)
- CC-BY 등 출처표기 필요한 소스를 썼다면 프로젝트 루트에 `ATTRIBUTION.md` 새로 작성

**읽기만 허용(수정 금지)**: `game/src/audio/audio.js`, `game/src/audio/gate.js`, `game/src/assets/loaders.js`, `game/src/core/loop.js`, `game/src/player/input.js`

**절대 건드리면 안 되는 파일**: `game/main.js`, `game/index.html`, `game/src/core/*`(위 audio.js/gate.js 제외 나머지), `game/src/player/character.js`, `game/src/player/controller.js`, `game/src/camera/*`, `game/src/physics/*`, `game/src/world/*`, `game/src/render/*`

**`game/main.js`를 못 건드리는 이유**: 지금 거기서 `playBGM('./assets/audio/test.mp3', {...})`를 이미 호출하고 있다. 네가 만든 진짜 BGM 파일 경로로 바꾸는 연결은 **통합자(Claude)가 나중에 한다** — 파일만 정확한 이름/위치에 두면 된다.

## 2. 구체적으로 할 것

### 2.1 BGM 소싱

- 분위기: `sample1.PNG`(프로젝트 루트, 로우폴리+노을톤) + 지금 게임의 아늑한 방/노을 배경음악에 어울리는 걸로. Lo-fi, ambient, 잔잔한 acoustic 계열 추천.
- **CC0 우선.** freesound.org(CC0 필터 있음), opengameart.org, kenney.nl(오디오 팩 CC0)에서 찾아라. CC-BY 등 출처표기 필요한 것도 되지만 `ATTRIBUTION.md`에 반드시 기록.
- **길이/용량 예산**: 60~90초 루프, **최종 파일 1.5MB 이하.** `test.mp3`(4.1MB)가 이 예산을 3배 가까이 넘긴 실패 사례다 — 비트레이트를 128kbps 이하로 낮추거나 루프 길이를 줄여서 맞춰라.
- `game/assets/audio/bgm-main.mp3`로 저장.

### 2.2 효과음(SFX) 소싱

- **발소리** 1종(짧은 "톡" 계열, 나무바닥 느낌) — `sfx-footstep.mp3`, 30KB 이하
- (선택) **스탠드 조명 클릭음** — 짧은 "딸깍" — `sfx-click.mp3`, 30KB 이하. 지금 게임엔 책상 위 스탠드를 클릭하면 불이 켜지는 상호작용이 이미 있는데 소리는 없다. **단, 이 클릭 이벤트를 실제로 발생시키는 코드는 `world/rooms/livingRoom.js`에 있고 그 파일은 네 범위 밖이다 — 소리 파일만 준비해두고, 실제로 그 클릭에 연결하는 건 통합자가 한다.** 파일명을 예측 가능하게(`sfx-click.mp3`) 지어두면 통합이 쉬워진다.

### 2.3 발소리 자동 재생 — `footsteps.js` (선택이지만 권장)

이건 **다른 파일을 전혀 안 건드리고** 만들 수 있다. `core/loop.js`의 `onFrame`과 `player/input.js`의 `getMoveAxis()`는 읽기 전용 사용이 허용돼 있다:

```js
import { onFrame, Phase } from '../core/loop.js';
import { getMoveAxis } from '../player/input.js';
import { createSfxPool } from './audio.js';

export function initFootsteps(url = './assets/audio/sfx-footstep.mp3', interval = 0.38) {
  const pool = createSfxPool(url, 4, { volume: 0.5 });
  let timer = 0;

  onFrame((dt) => {
    const axis = getMoveAxis();
    const moving = axis.x !== 0 || axis.z !== 0;
    if (!moving) { timer = 0; return; }
    timer += dt;
    if (timer >= interval) {
      pool.play();
      timer = 0;
    }
  }, Phase.SIM);
}
```
이 함수를 만들어두면, 통합자가 `main.js`에서 `initFootsteps()` 한 줄만 호출하면 끝난다. **`initFootsteps()`를 스스로 호출하지 마라** — export만 해두고, 실제로 부르는 건 `main.js`가 할 일이다(그 파일은 네 범위 밖).

## 3. 검증 방법

헤드리스 Chrome 스크린샷 도구(로컬 Chrome 그대로 사용, 별도 다운로드 없음):
```
cd tools/render-check
node shot.mjs "<game 폴더 절대경로>" "./out.png" 2000
```

**오디오 재생 자체를 확인하려면**: `main.js`를 건드릴 수 없으니, `game/_scratch/preview_audio.html`(간단한 `<button>` + 스크립트) 같은 임시 페이지를 만들어서 `import { playBGM } from '../src/audio/audio.js'`로 직접 호출해봐라. puppeteer로 확인한다면 **반드시 `page.click()`(CDP 레벨 클릭)을 써라** — 합성 DOM 클릭(`dispatchEvent`)은 브라우저 오토플레이 정책의 "진짜 사용자 제스처" 판정을 통과하지 못해서 재생이 막힌다. 재생 후 아래로 상태를 확인할 수 있다:
```js
const sound = playBGM(url, {...});
// sound.context.state === 'running', sound.isPlaying === true, sound.hasBuffer 등
```

용량 확인도 잊지 마라:
```
node -e "console.log(require('fs').statSync('game/assets/audio/bgm-main.mp3').size / 1024 / 1024, 'MB')"
```

커밋 전에:
```
node --check game/src/audio/footsteps.js   # 만들었다면
node tools/check-imports.mjs "<game 폴더 절대경로>"
```
(`footsteps.js`는 아직 아무도 안 부르니 `check-imports.mjs`의 그래프엔 안 잡힌다 — `node --check`로 문법만 확인하면 충분하다.)

## 4. 완료 기준

- [ ] `bgm-main.mp3` — CC0 또는 출처표기(ATTRIBUTION.md), 60~90초 루프, **1.5MB 이하**
- [ ] `sfx-footstep.mp3` — 30KB 이하
- [ ] (선택) `sfx-click.mp3` — 30KB 이하
- [ ] (선택) `footsteps.js` — `core/loop.js`/`player/input.js` 읽기 전용 사용, 자체 등록만 하고 아무도 안 부름(통합자 몫)
- [ ] `game/main.js` 등 off-limits 파일 미접촉 — `git diff --stat main...HEAD`로 확인
- [ ] `node --check`, `check-imports.mjs` 통과
- [ ] `dev-log.md` 맨 위에 항목 추가(어떤 파일을 어디서 구했는지, 라이선스, 최종 용량)

## 5. Git 작업 방식

`-1절`에서 만든 별도 클론 안에서, `gemini/lane-audio-content` 브랜치에만 커밋해라. `main`으로 merge하거나 강제 push하지 마라. 끝나면 push만 하고 두면 리뷰 후 병합된다.
