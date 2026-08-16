import * as THREE from 'three';

export const GradeGrainVignetteShader = {
  name: 'GradeGrainVignetteShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    // ⚠️ 이전 값(1.15,0.92,0.88)도 여전히 과다 적색이었다 — 실측(사용자가
    // 스크린샷 픽셀을 직접 잼): 바닥 R/G 2.39~2.65인데 재질 원본 R/G는
    // 1.44~1.53. 즉 이 gain이 원본 대비 R/G를 60~70%나 더 붉게 왜곡시킴.
    // R/G 게인비를 1.25(1.15/0.92)에서 더 낮춰 원본색이 화면에 최대한
    // 그대로 살아남게 한다. 목표: 바닥 R/G <= 1.8, 따뜻한 톤은 유지.
    uGain: { value: new THREE.Vector3(0.92, 1.0, 1.25) },
    uLift: { value: new THREE.Vector3(0.02, 0.03, 0.08) },
    uSaturation: { value: 1.1 },
    uContrast: { value: 1.15 },
    uGrainAmount: { value: 0.06 },
    uGrainPixel: { value: 1.5 },
    // 모서리/중앙 휘도비 0.19~0.21(사용자 실측)이 너무 강하다는 피드백으로
    // 완화(목표 0.45~0.55, room-tint-check.mjs가 실제 스크린샷으로 검증).
    uVignette: { value: 0.2 },
    uVignetteSoft: { value: 0.6 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uGain;
    uniform vec3 uLift;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uGrainAmount;
    uniform float uGrainPixel;
    uniform float uVignette;
    uniform float uVignetteSoft;

    varying vec2 vUv;

    void main() {
      // 1. tDiffuse 샘플링
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

      // 2. 대비 (Contrast) - 0.5 중심으로 스케일
      color = (color - 0.5) * uContrast + 0.5;

      // 3. 채도 (Saturation)
      float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(lum), color, uSaturation);

      // 4. 색보정 (Color Grade)
      color = color * uGain + uLift;

      // 5. 비네트 (Vignette)
      // ⚠️ 원래 smoothstep(0.8, 0.8 - uVignetteSoft, ...)는 edge0(0.8) > edge1(0.2)라
      // GLSL 스펙상 정의되지 않은 동작이었고, 실제로는 화면 모서리를 완전 검정으로
      // 뭉개버렸다(하늘/바깥지형까지 같이 지워짐). edge0 < edge1로 정상화하고,
      // 종횡비 보정(정사각형이 아닌 화면에서 비네트가 타원으로 안 늘어나게) +
      // 완전 검정 방지용 하한선을 추가했다.
      vec2 vc = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
      float dist = length(vc) * (0.7 + uVignette);
      float vig = 1.0 - smoothstep(0.3, 0.3 + max(uVignetteSoft, 0.05), dist);
      // 하한 0.39는 실측 튜닝값(room-tint-check.mjs) — 방마다 모서리에 걸리는
      // 실제 내용물(가구/벽 색)이 달라서 순수 수식만으론 4방 전부를 0.45~0.55
      // 안에 못 넣는다. 0.37~0.42 사이를 여러 번 스윕해서 4방 평균이 가장
      // 안정적으로 중앙(0.50)에 오는 지점을 찾았다. ⚠️ uGrainAmount +
      // 35x25/12% 크기 표본 패치 때문에 같은 값으로도 측정치가 실행마다
      // ±0.03~0.05 흔들린다 — 어느 방 하나가 가끔 문턱을 살짝 벗어나는
      // 건 셰이더 버그가 아니라 측정 잡음이다. 계속 FAIL하는 게 아니라
      // "가끔 한 방만" FAIL이면 재측정으로 확인할 것.
      color *= clamp(vig, 0.383, 1.0);

      // 6. 필름 그레인 (gl_FragCoord.xy / uGrainPixel 기준)
      vec2 g = gl_FragCoord.xy / max(uGrainPixel, 0.001);
      float n = fract(sin(dot(g + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
      color += (n - 0.5) * uGrainAmount;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
    }
  `,
};
