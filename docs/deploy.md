# 배포 절차 (itch.io)

## 0. 배포 전 검증

저장소 루트에서 전부 통과해야 한다(경고만 내는 asset-check/prop-bounds-check 제외하고는 exit 0 필수):

```
node tools/asset-check.mjs
node tools/layout-check.mjs
node tools/render-check/m4-rooms.mjs game       # 스크린샷 4장도 이걸로 재생성
node tools/render-check/character-check.mjs game
node tools/render-check/audio-check.mjs game
node tools/render-check/room-tint-check.mjs tools/render-check
node tools/render-check/prop-bounds-check.mjs game
node tools/render-check/input-check.mjs game
```

## 1. zip 만들기 — 반드시 스크립트로

```
node tools/make-dist.mjs
```

기본 출력: `dist/game-dist.zip` (저장소 밖 원본 소스 파일이 남아있으면 에러로 막고, 만든 뒤 용량을 출력한다).

**수동으로 압축하지 말 것.** 탐색기에서 `game` 폴더를 우클릭 압축하면 zip 안이 `game/index.html`이 되어버려 itch.io가 실행 파일을 못 찾는다. itch.io는 **zip 루트에 index.html이 있어야** 한다 — `make-dist.mjs`는 `game/` 안의 내용물(`index.html`, `main.js`, `src/`, `assets/`, `vendor/`)만 개별로 나열해서 zip 루트에 바로 넣기 때문에 이 실수가 구조적으로 안 난다.

제외되는 것:
- `game/_scratch/` — 개발용 프리뷰, 배포물 아님
- `game/.claude/` — 로컬 세션 설정
- `*_source.*` 패턴 파일(예: `bgm-main_source.mp3`) — `game/` 밖 `_assets_source/`에 있어야 정상. `game/` 안에 남아있으면 스크립트가 에러로 막는다.

압축 후 용량이 15MB를 넘으면 스크립트가 경고를 낸다 — `node_modules`나 소스 파일이 잘못 딸려 들어갔다는 신호일 가능성이 높으니 위 "포함 항목" 로그를 확인할 것.

### 수동으로 확인하고 싶을 때

```
powershell -Command "Expand-Archive -Path dist\game-dist.zip -DestinationPath dist\_verify -Force; Get-ChildItem dist\_verify"
```

`index.html`이 최상위(다른 하위 폴더 없이 바로)에 보여야 한다.

## 2. itch.io 프로젝트 설정

itch.io "Edit game" 페이지에서:

| 설정 | 값 |
|---|---|
| Kind of project | **HTML** |
| Uploads | `dist/game-dist.zip` 업로드 후 **"This file will be played in the browser"** 체크 (필수 — 안 하면 그냥 다운로드 파일 취급됨) |
| Viewport | `960 x 600` 고정 권장(스크린샷/카메라 프레이밍이 이 비율 기준) — "Enable fullscreen button" 켜는 것도 무방 |
| Mobile friendly | **체크 해제** — `player/input.js`가 키보드 전용이라 터치로는 캐릭터가 안 움직인다(`src/audio/gate.js`가 터치 기기 접속 시 "PC에서 열어주세요" 안내를 로딩 화면에 띄우지만, itch.io 자체의 모바일 노출도 막는 게 낫다) |

## 3. 업로드 후 확인

itch.io가 게임을 iframe으로 감싸서 서빙하므로, 로컬 정적 서버(`python -m http.server` 등)로 `dist/game-dist.zip`을 풀어서 한 번 열어보는 것과 실제 itch.io 페이지에서 여는 것 사이에 차이가 있을 수 있다(특히 상대 경로, CORS). 업로드 직후 반드시 itch.io 프로젝트 페이지에서 직접 열어 다음을 확인:

- 로딩 화면 → "게임 시작" 버튼이 정상적으로 활성화되는지(에셋 로딩 완료 후)
- BGM/발소리/램프 클릭 sfx가 실제로 들리는지
- WASD 이동, 드래그 시점 회전, 휠 줌
- 콘솔에 404가 없는지(경로 대소문자 문제는 로컬 Windows에선 안 터지고 itch.io 서버에서만 터질 수 있다 — `tools/check-imports.mjs`가 이걸 미리 잡아준다)
