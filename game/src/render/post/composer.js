import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GradeGrainVignetteShader } from './GradeGrainVignetteShader.js';

/**
 * Post-processing EffectComposer 생성 함수
 * RenderPass -> OutputPass -> GradeGrainVignetteShader 순서 엄격 준수
 */
export function createComposer(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const pixelRatio = renderer.getPixelRatio();

  // WebGL2 MSAA를 위해 samples: 4 명시
  const renderTarget = new THREE.WebGLRenderTarget(
    Math.floor(size.x * pixelRatio),
    Math.floor(size.y * pixelRatio),
    { samples: 4 }
  );

  const composer = new EffectComposer(renderer, renderTarget);

  // 1. RenderPass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. OutputPass (sRGB 변환 & 톤매핑 관리를 위해 GradePass 이전에 필수 배치)
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // 3. GradePass (색보정, 비네트, 그레인) - OutputPass 뒤에 배치하여 sRGB 디스플레이 공간에서 동작
  const gradePass = new ShaderPass(GradeGrainVignetteShader);
  gradePass.renderToScreen = true;
  composer.addPass(gradePass);

  // uResolution 초기값 설정
  if (gradePass.uniforms.uResolution) {
    gradePass.uniforms.uResolution.value.set(size.x * pixelRatio, size.y * pixelRatio);
  }

  let elapsedTime = 0;

  function resize(w, h) {
    const pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    if (gradePass.uniforms.uResolution) {
      gradePass.uniforms.uResolution.value.set(w * pr, h * pr);
    }
  }

  function update(dt) {
    elapsedTime += dt;
    if (gradePass.uniforms.uTime) {
      gradePass.uniforms.uTime.value = elapsedTime;
    }
  }

  function render() {
    composer.render();
  }

  return {
    composer,
    renderPass,
    outputPass,
    gradePass,
    resize,
    update,
    render,
  };
}
