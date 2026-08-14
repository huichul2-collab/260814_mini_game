# Gemini 작업 지시서 — Lane C: 룩(후처리 · 안개 · 바깥 지형)

> 이 문서는 이 프로젝트의 다른 대화 맥락을 전혀 모르는 상태에서 읽는다는 전제로 쓰였다.
> 필요한 배경은 전부 이 안에 있다. 모르는 걸 추측하지 말고, 애매하면 범위를 좁혀서 처리할 것.

## 0. 이 프로젝트가 뭔가

취미로 만드는 3D 방/집 탐험 게임. Three.js(r185) + 순수 ES 모듈, **빌드 단계 없음, npm 런타임 의존성 없음**.
`game/vendor/`에 three.js와 필요한 애드온을 전부 오프라인으로 미리 받아뒀다(unpkg에서 다운로드한 파일 그대로).
브라우저가 `<script type="importmap">`으로 `three` / `three/addons/`를 `vendor/`로 매핑해서 그냥 돌아간다.

현재 상태: 방 1개(바닥+벽3), 책상·의자·책장·화분 등 소품, 스탠드 클릭 상호작용 1개. 카메라는 아직 `OrbitControls`(마우스 드래그로 궤도 회전). sRGB 톤, flat 셰이딩(외곽선 없음).

**목표 아트 방향**: 프로젝트 루트의 `sample1.PNG`를 봐라(경로: `C:\Users\hcyang\claude\claude_project\260814_mini_games\sample1.PNG`). 로우폴리, 면 셰이딩, **강한 색보정(마젠타/노을 톤으로 게인 이동)**, **필름 그레인**, **비네트**, **거리 안개**가 특징이고 **외곽선이 없다**(이미 제거됨).

## 1. 네 작업 범위 (Lane C — "룩")

이 브랜치(`gemini/lane-c-look`)에서 아래 파일만 새로 만들거나 수정한다:

**새로 만들 파일**
- `game/src/render/post/GradeGrainVignetteShader.js`
- `game/src/render/post/composer.js`
- `game/src/world/exterior.js`

**수정해도 되는 기존 파일**
- `game/src/render/sky.js` (여기에 안개 설정 함수 추가)

**절대 건드리면 안 되는 파일** (다른 레인/통합자 소유 — 건드리면 나중에 merge 충돌이 나거나 다른 작업을 깨뜨림):
- `game/main.js`, `game/index.html`
- `game/src/core/*` (context.js, tags.js, loop.js)
- `game/src/render/materials.js`, `game/src/render/meshFactory.js`
- `game/src/world/rooms/*`
- `game/glb/*`, `game/src/assets/*`, `game/src/audio/*` (다른 레인이 씀)

네 코드는 `main.js`에 아직 연결되지 않은 **독립 모듈**이어야 한다. `composer.js`가 export하는 함수를 어떻게 호출할지는 통합할 때 결정한다 — 네가 `main.js`를 고치지 마라.

## 2. 구체적으로 만들 것

### 2.1 `game/src/render/post/GradeGrainVignetteShader.js`

그레인+색보정+비네트를 **하나의 셰이더 패스로 합친 것**. 세 개로 나누지 마라 — 서로 의존성이 없고 이웃 픽셀을 안 쓰는 단순 픽셀 연산이라 나누면 풀스크린 렌더타깃 왕복만 3배로 늘어난다.

`ShaderPass`가 기대하는 형식(three.js 애드온 셰이더 규약)으로 plain object를 export:
```js
export const GradeGrainVignetteShader = {
  name: 'GradeGrainVignetteShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGain: { value: new THREE.Vector3(1.25, 0.72, 0.85) },
    uLift: { value: new THREE.Vector3(0.06, 0.02, 0.08) },
    uSaturation: { value: 1.1 },
    uContrast: { value: 1.15 },
    uGrainAmount: { value: 0.06 },
    uGrainPixel: { value: 1.5 },
    uVignette: { value: 0.35 },
    uVignetteSoft: { value: 0.6 },
  },
  vertexShader: /* 표준 풀스크린 quad vertex shader, vUv 넘기기 */ `...`,
  fragmentShader: /* 아래 순서 참고 */ `...`,
};
```

`uGain`/`uLift` 초기값은 `sample1.PNG`를 스포이드로 눈대중 잡은 근사치다 — 실제로 렌더해보고 눈으로 맞춰라(§4 검증 방법 참고). 정답이 아니라 출발점이다.

**프래그먼트 셰이더 처리 순서 (이 순서가 중요하다)**:
1. `tDiffuse` 샘플
2. 대비(contrast): 0.5 중심으로 스케일
3. 채도(saturation): `mix(vec3(luminance), color, uSaturation)` — luminance는 `dot(c, vec3(0.2126,0.7152,0.0722))`
4. 색보정: `c = c * uGain + uLift`
5. 비네트: 화면 중심에서의 거리로 `smoothstep` 곱하기
6. **그레인은 맨 마지막에 더한다.** 그레인을 보정 이전에 넣으면 그레인 자체가 채도/대비 처리에 휩쓸려 뭉개진다. 인화지 위에 낟알이 얹힌 것처럼 맨 위에 있어야 한다.

**그레인은 `vUv`가 아니라 `gl_FragCoord.xy`를 `uGrainPixel`로 나눈 좌표에서 계산해라**:
```glsl
vec2 g = gl_FragCoord.xy / uGrainPixel;
float n = fract(sin(dot(g + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
c += (n - 0.5) * uGrainAmount;
```
`vUv` 기준으로 하면 해상도·`devicePixelRatio`에 따라 그레인 입자 크기가 변해서, 개발자 모니터에선 맞고 다른 화면에선 TV 노이즈처럼 보인다. 반드시 `gl_FragCoord` 기준으로.

**절대 하지 말 것**: 프래그먼트 셰이더에 `#include <colorspace_fragment>`를 넣지 마라. 이 셰이더에 들어오는 데이터는 이미 sRGB 인코딩된 값이다(2.2절 참고). 그 칙크는 three가 내부적으로 필요할 때만 주입하는 것이지, 커스텀 셰이더가 "친절하게" 추가하면 이중 변환이 일어난다.

### 2.2 `game/src/render/post/composer.js`

```js
export function createComposer(renderer, scene, camera) {
  // EffectComposer(WebGL2 MSAA 위해 samples:4 렌더타깃 명시)
  // RenderPass(scene, camera)
  // OutputPass()   ← 반드시 그다음
  // ShaderPass(GradeGrainVignetteShader), renderToScreen = true   ← OutputPass 뒤
  // resize(w, h) 함수도 export — composer.setSize + setPixelRatio
  // update(dt) 함수 export — uTime, uResolution uniform 갱신
}
```

**⚠️ 이게 이 작업에서 가장 자주 터지는 부분이다 — 반드시 이 순서로 해라: `RenderPass → OutputPass → GradePass`.**

이유: `renderer.outputColorSpace`(sRGB 인코딩 + 톤매핑)는 **기본 프레임버퍼에 직접 그릴 때만** 적용된다. `EffectComposer`를 쓰는 순간 렌더타깃에 그리게 되고, 렌더타깃은 선형(linear) 색공간이라 아무도 sRGB로 안 바꿔준다. **`OutputPass`가 그 변환을 하는 컴포넌트이고, 없으면 안 된다.**

빠뜨리면 무슨 일이 생기냐면: 화면 전체가 어둡고 탁하게 나온다. 그런데 이게 **버그처럼 안 보이고 "분위기 있는 조명"처럼 보인다.** 그래서 조명을 올려서 보정하고 싶어지는데, 그러면 이후 모든 조명 판단이 깨진 기반 위에 쌓여서 되돌리기 더 힘들어진다. **컴포저를 처음 넣는 커밋에서 조명은 절대 건드리지 말고 `OutputPass`부터 확인해라.**

그리고 `OutputPass`가 마지막이 아니라 **네 그레이드 패스가 `OutputPass` 뒤에 와야 한다** — 그래야 색보정이 디스플레이 기준 sRGB 값 위에서 동작해서, `uGain`/`uLift` 값이 참조 이미지 감과 맞아떨어진다. 선형 공간에서 보정하면 같은 숫자가 완전히 다르게 나온다.

`renderer.toneMapping = THREE.NoToneMapping`은 기존 코드에 이미 설정돼 있다 — 건들지 마라.

**MSAA 관련**: `WebGLRenderer({antialias:true})`는 렌더타깃에 그리는 순간 아무 효과가 없다. 로우폴리 면 실루엣에서 계단 현상이 매우 잘 보인다. `EffectComposer`의 렌더타깃을 `new THREE.WebGLRenderTarget(w, h, { samples: 4 })`로 명시해서 해결해라. `SMAAPass`는 쓰지 마라(추가 텍스처 파일이 필요해서 이 오프라인 vendoring 방식과 안 맞는다).

### 2.3 `game/src/world/exterior.js`

```js
export function createExterior(scene) {
  // 넓은 지면(Plane 또는 아주 큰 Box) + 로우폴리 언덕/나무 몇 개, 방 바깥에 배치
}
```

**이게 왜 필요한지**: `scene.fog`를 넣어도 지금 씬엔 안개가 걸릴 대상이 없다. 유일한 원거리 물체인 스카이돔은(2.4절) `fog:false`라 안개를 안 받는다. **이 파일이 없으면 안개를 아무리 튜닝해도 화면에 아무 변화가 없어 보인다** — 그게 버그가 아니라 이 파일을 아직 안 만들어서 그런 거다.

지면과 언덕은 `game/src/render/materials.js`의 `mat(color)`를 import해서 써라(읽기 전용 사용은 허용 — 그 파일을 수정하지만 않으면 된다). 방 자체(`world/rooms/livingRoom.js`)는 건드리지 말고, 그 바깥 좌표에 새로 추가만 해라.

### 2.4 `game/src/render/sky.js`에 추가

이미 있는 `createSkyDome()` 옆에 안개 설정 함수를 추가해라:
```js
export function setupFog(scene) {
  scene.fog = new THREE.Fog(FOG_COLOR, near, far); // 지수형(FogExp2) 말고 선형
}
```
**`FOG_COLOR`는 스카이돔 그라디언트의 지평선 쪽 색(`#e0793f` 근방, `createSkyDome()` 안의 `grad.addColorStop(1, '#e0793f')` 참고)과 반드시 맞춰라.** 안 맞으면 지형이 하늘과 만나는 지점에 뚜렷한 경계선이 생긴다.

## 3. 재질/셰이딩 관련 참고 (건드리지 않아도 알아야 할 것)

면 셰이딩(flat shading) 자체는 이미 `materials.js`에서 처리돼 있다(`MeshLambertMaterial({flatShading:true})`). 네가 손댈 필요 없다. 다만 `mat()`으로 만든 재질은 기본적으로 `material.fog = true`라 자동으로 안개를 받는다 — 확인만 해봐라.

## 4. 검증 방법 (직접 스크린샷을 볼 수 있다)

이 프로젝트엔 헤드리스 Chrome 스크린샷 도구가 이미 있다. 로컬 Chrome/Edge 실행파일을 그대로 쓰고 별도 다운로드가 없다.

```
cd tools/render-check
node shot.mjs "<game 폴더 절대경로>" "./out.png" 2000
```
- 콘솔 에러/경고, HTTP 4xx/5xx, WebGL 컨텍스트 상태까지 같이 출력된다
- `out.png`를 열어서 직접 눈으로 확인해라 — sample1.PNG와 톤이 비슷한지, 그레인이 과하지 않은지, **화면이 어둡거나 탁해 보이면 OutputPass 순서부터 의심해라**(2.2절)

**임시로 확인해보고 싶다면**: `main.js`를 고치지 않고도, `game/_scratch/preview.html` + `game/_scratch/preview.js` 같은 임시 파일을 만들어서 방 씬 + 네 컴포저 + `setupFog`/`createExterior`를 직접 연결해 스크린샷을 찍어봐도 된다. 이 임시 파일은 커밋해도 되고 마지막에 지워도 된다 — 둘 다 무방하다.

커밋 전에 문법 검사와 import 검증도 돌려라:
```
node --check game/src/render/post/composer.js   # 새로 만든 파일마다
node tools/check-imports.mjs "<game 폴더 절대경로>"
```

## 5. 완료 기준

- [ ] `GradeGrainVignetteShader.js`, `composer.js`, `exterior.js` 작성
- [ ] `sky.js`에 `setupFog()` 추가
- [ ] `RenderPass → OutputPass → GradePass` 순서 확인(스크린샷으로 화면이 어둡거나 탁하지 않은지 확인)
- [ ] 스크린샷에서 sample1.PNG와 톤이 비슷한지 육안 확인, 그레인이 과하지 않은지 확인
- [ ] `node --check`, `check-imports.mjs` 통과
- [ ] `1. 작업 범위`에 나열된 "절대 건드리면 안 되는 파일"을 하나도 건드리지 않았는지 `git diff --stat main...HEAD`로 확인
- [ ] `dev-log.md` 맨 위에 항목 하나 추가 (무엇을 했는지, `uGain`/`uLift` 최종값이 초기 추정치에서 얼마나 바뀌었는지)

## 6. Git 작업 방식

이 브랜치(`gemini/lane-c-look`)에서만 커밋해라. `main`으로 merge하거나 강제 push하지 마라 — 작업이 끝나면 그대로 두면 리뷰 후 병합된다. 커밋 메시지는 뭘 했는지 한두 줄로.
