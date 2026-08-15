import * as THREE from 'three';

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
      color *= clamp(vig, 0.15, 1.0);

      // 6. 필름 그레인 (gl_FragCoord.xy / uGrainPixel 기준)
      vec2 g = gl_FragCoord.xy / max(uGrainPixel, 0.001);
      float n = fract(sin(dot(g + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
      color += (n - 0.5) * uGrainAmount;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
    }
  `,
};
