# STATE — 세션 시작 시 여기만 읽는다

> 60줄 유지. 서술 금지, 상태만. 세션 끝에 **Claude Code CLI가 갱신**한다.
> 배경/경위가 필요하면 `handoff-2026-08-15.md`, 전체 로그는 `dev-log.md`.
> 최종 갱신: 2026-08-16 (Claude Code CLI) — M4c 드레싱까지 완료, M5 배포 판단 가능한 상태

## 3층 운영규칙

| 층 | 표면 | 하는 일 | **하면 안 되는 일** |
|---|---|---|---|
| 1 | Claude 앱 (Opus) | 결정·숫자·수용기준. `docs/spec/*.md` 작성. 레인 분할 판정 | 코드 작성, 지시서 본문 작성, 실행 검증 |
| 2 | Claude Code CLI | `main` 구현, 지시서 확장, merge, `main.js` 연결, 검증 스크립트 | 자기 코드를 육안으로 최종 판정 → 스크립트에 위임 |
| 3 | Gemini / Antigravity | 배타 소유 파일만 (`player/`, `audio/`, `world/rooms/*`) | `main.js`·`index.html`·`layout.js` 수정, `main`에 merge |

**불변 규칙**
1. 3층은 **반드시 별도 클론 폴더**에서 작업 (같은 폴더 브랜치 전환 사고 — M4 작업 중에도 재발, `dev-log.md` (16) 참고)
2. 각 레인은 `init()` 하나만 노출. 씬 등록은 2층이 `main.js`에서
3. 작업 단위마다 즉시 commit + push. 몰아서 금지
4. 1층은 `dev-log.md`를 읽지 않는다. 이 파일 + 필요한 소스 1~2개만
5. 품질 게이트는 사람 리뷰가 아니라 **자동 검증 스크립트**
6. **레인은 작업 시작 전 `git merge origin/main`을 반드시 하고, 그 결과를 커밋 하나로 먼저 push한다** — `gemini/lane-rooms`가 964a265에서 분기한 뒤 origin/main을 한 번도 안 받아와 최신 커밋 5개(색보정 재작업 포함)가 빠진 채 남아있었던 사고 재발 방지(`dev-log.md` (22))

## 마일스톤

| | 상태 |
|---|---|
| M0 기반 | ✅ |
| M1 이동/충돌/카메라 (휠 줌 포함) | ✅ |
| M2 룩 (후처리·안개·바깥지형) | ✅ |
| M3 (a)에셋 파이프라인 ✅ / (b)걷는 캐릭터 | ✅ `gemini/lane-character` merge 완료(리깅 로봇+idle/walk, `character-check.mjs` 통과) |
| **M4 집 4칸 구조** (`layout.js`+`house.js`, 거실 소품) | ✅ 완료 — `layout-check.mjs` 7/7, `m4-rooms.mjs` 13/13 통과 |
| M4c 방 3개 드레싱 | ✅ 완료 — `gemini/lane-rooms`가 origin/main 안 받아와 merge 대신 소품 파일 3개만 `git checkout`으로 가져옴(`dev-log.md` (22)) |
| M5 배포 (itch.io) | 🟡 **판단 가능한 상태** — 구조/이동/캐릭터/오디오/방4개 전부 ✅, 사용자 최종 판단만 남음 |
| M6 증식 (오디오 시스템 ✅ 실제 에셋까지 완료 / 소품) | 🟡 `gemini/lane-audio-content` merge 완료, 소품 추가는 대기 |
| M7 폴리시 | 🔴 |

## 브랜치

| 브랜치 | 담당 | 상태 |
|---|---|---|
| `main` | 2층 CLI | M4 구조+캐릭터+오디오+방3개 드레싱 전부 완료 |
| `gemini/lane-character`, `gemini/lane-audio-content` | 3층 | merge 완료 — 삭제 대상(아직 안 지움) |
| `gemini/lane-rooms` | 3층 | **origin에서 삭제 완료**(파일 3개만 건지고 merge 안 함) |
| `gemini/lane-c-look`, `gemini/lane-e-assets-audio` | — | **origin에서 삭제 완료**, 로컬 추적 참조도 prune 완료 |

## 지금 열려 있는 작업 (우선순위)

1. **M5 배포 판단** — 사용자 몫, 기술적으로는 준비됨
2. 벽 페이드 (`TAG.FADEABLE` 실제 투명도) — 2층, 문 있는 벽 구조가 이제 있으니 착수 가능
3. `player/character.js`의 `findClip`이 idle 키워드로 'Attacking_Idle'을 'Idle'보다 먼저 매치함(현재 GLB 애니메이션 배열 순서 때문) — 정지 포즈가 살짝 어색함. 3층 소유 파일이라 다음 캐릭터 레인에서 손볼 것
4. 죽은 브랜치(`gemini/lane-character`, `gemini/lane-audio-content`) origin 삭제 — merge 완료됐으니 아무 때나
5. 카메라: `maxDistance` 8.0 이상 휠 줌아웃 시 일부 방(문 근처)에서 카메라가 문 개구부를 넘어가는 아티팩트 있음(`config/camera.js` 주석 참고) — pitch 튜닝 필요, 지금은 기본 시야만 조정함

## 열린 결정 / 미확정

- 방 크기 6.0/5×4/4×5/4×4 m는 **계산값, 실제로 걸어본 뒤 문제없음 확인**(m4-rooms.mjs 13/13) — 미적 만족도는 별개, 드레싱 후 재평가
- 콜라이더 실측 24개(스펙 추정 ~43보다 적음 — 상인방 9개가 의도대로 non-solid라 그렇다, 문제 아님)
- 현관문(집 밖 출입) 만들지 여부 — M5 이후 판단
- 안개 far, 카메라 기본 거리 — 6m 방 기준 재확인 아직 안 함
- `character-robot.glb`(660KB, 애니메이션 24개)·`bgm-main.mp3`(4.2MB)가 사용자가 직접(git 안 거침) 교체함(2026-08-16 22시경) — 기존 `_old` 파일 남아있음. `ATTRIBUTION.md`는 이전 파일 기준이라 새 에셋 출처 미기재, BGM은 예산(1.5MB) 재초과 — 사용자 확인·의도된 상태, 후속 정리 필요하면 사용자가 지시
