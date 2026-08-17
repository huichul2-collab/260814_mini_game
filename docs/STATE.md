# STATE — 세션 시작 시 여기만 읽는다

> 60줄 유지. 서술 금지, 상태만. 세션 끝에 **Claude Code CLI / Antigravity가 갱신**한다.
> 배경/경위가 필요하면 `handoff-2026-08-15.md`, 전체 로그는 `dev-log.md`.
> 최종 갱신: 2026-08-17 — 이동 정지 버그 해결(M4 스펙 오류였음, 책상 벽밀착 + 웨이포인트). m4-rooms.mjs 13/13 복구

## 3층 운영규칙

| 층 | 표면 | 하는 일 | **하면 안 되는 일** |
|---|---|---|---|
| 1 | Claude 앱 (Opus) | 결정·숫자·수용기준. `docs/spec/*.md` 작성. 레인 분할 판정 | 코드 작성, 지시서 본문 작성, 실행 검증 |
| 2 | Claude Code CLI | `main` 구현, 지시서 확장, merge, `main.js` 연결, 검증 스크립트 | 자기 코드를 육안으로 최종 판정 → 스크립트에 위임 |
| 3 | Gemini / Antigravity | 레인 지시서에서 명시 지정한 소유 파일 (미지정 시 기본: `player/`, `audio/`, `world/rooms/*`) | 지정 없는 `main.js`·`index.html` 수정, `main`에 직접 merge |

**불변 규칙**
1. 3층은 **반드시 별도 클론 폴더**에서 작업 (같은 폴더 브랜치 전환 사고 — M4 작업 중에도 재발, `dev-log.md` (16) 참고)
2. 각 레인은 `init()` 하나만 노출. 씬 등록은 2층이 `main.js`에서
3. 작업 단위마다 즉시 commit + push. 몰아서 금지
4. 1층은 `dev-log.md`를 읽지 않는다. 이 파일 + 필요한 소스 1~2개만
5. 품질 게이트는 사람 리뷰가 아니라 **자동 검증 스크립트**
6. 레인은 작업 시작 전 `git merge origin/main`을 반드시 하고, 그 결과를 커밋 하나로 먼저 push한다
7. **레인별 소유 파일은 지시서에서 명시적으로 지정하며, 기본 금지 목록은 지정이 없을 때의 기본값이다.**

## 마일스톤

| | 상태 |
|---|---|
| M0 기반 | ✅ |
| M1 이동/충돌/카메라 (휠 줌 포함) | ✅ |
| M2 룩 (후처리·안개·바깥지형) | ✅ |
| M3 (a)에셋 파이프라인 ✅ / (b)걷는 캐릭터 | ✅ `gemini/lane-character` merge 완료 |
| **M4 집 4칸 구조** (`layout.js`+`house.js`, 거실 소품) | ✅ 완료 — `layout-check.mjs` 7/7, `m4-rooms.mjs` 13/13 통과 |
| M4c / M4-ext 방 3개 드레싱 + B-4a/b, B-5 | ✅ 완료 — `gemini/lane-rooms` merge 완료 (D4 현관문·마당, 창문 3개, Space 점프 물리) |
| M5 배포 (itch.io) | 🟡 **배포 도구까지 준비됨** — `docs/deploy.md`+`tools/make-dist.mjs` |
| M6 증식 (오디오 시스템 ✅ 실제 에셋까지 완료 / 소품) | 🟡 `gemini/lane-audio-content` merge 완료 |
| M9-A 방탈출 기반(사물 클릭→설명, `story.js`+`probe.js`+`dialogue.js`) | ✅ 완료 — `interaction-check.mjs` 6/6 통과. 퍼즐/자물쇠/아이템은 M9-B |
| M7 폴리시 | 🔴 |

## 브랜치

| 브랜치 | 담당 | 상태 |
|---|---|---|
| `main` | 2층 CLI / 통합 | M4 구조+캐릭터+오디오+방3개 드레싱+D4/마당/창문/점프 merge 완료 |
| `gemini/lane-character`, `gemini/lane-audio-content` | 3층 | merge 완료 |
| `gemini/lane-rooms` | 3층 | merge 완료 |

## 지금 열려 있는 작업 (우선순위)

1. **M5 배포 판단** — 사용자 몫, 도구까지 준비됨(`docs/deploy.md`)
2. 벽 페이드 (`TAG.FADEABLE` 실제 투명도) — 2층, 문/창문 있는 벽 구조가 정립됨
3. 카메라: `maxDistance` 8.0 이상 휠 줌아웃 시 일부 방 아티팩트 피치 튜닝
4. 모바일: 가상 조이스틱은 스트레치 목표라 미구현

## 열린 결정 / 미확정

- ✅(해결) 이동 정지 버그: M4 스펙의 책상 좌표 실수(z=-2.55, 벽까지 여유 0.115m — 플레이어 지름 0.44m보다 좁은 죽은 주머니)였다. z=-2.66(벽 밀착, 간격 0.005m)로 수정 + `m4-rooms.mjs`/`stuck-diagnose.mjs`가 문D1 코너를 지나는 경로에 웨이포인트 추가. `resolve.js`는 MTV(반복마다 최심 콜라이더 1개만 해소)로도 재구조화했지만 이 특정 코너 자체는 알고리즘이 아니라 지오메트리 문제였음(입력 반전 시 정상 탈출 확인됨). `m4-rooms.mjs` 13/13, `stuck-diagnose.mjs` KNOWN_FAILURES=[] 로 통과. `prop-bounds-check.mjs`에 벽↔가구/가구↔가구 틈(<플레이어 지름) 경고 추가(책상↔의자 0.425m는 화이트리스트, 정상 배치)
- 현관문(집 밖 출입) & 마당 울타리 (B-4a) 완료
