import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * 전역 공유 LoadingManager 및 자원 로더 모듈
 */
const manager = new THREE.LoadingManager();

const gltfLoader = new GLTFLoader(manager);
export const texLoader = new THREE.TextureLoader(manager);
export const audioLoader = new THREE.AudioLoader(manager);

export function loadGLTF(url, onProgress) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf),
      onProgress,
      (error) => reject(error)
    );
  });
}

/**
 * 텍스처 로드 (컬러/알베도 텍스처는 기본적으로 SRGBColorSpace 적용)
 * 노멀/러프니스/메탈니스 등 선형 텍스처는 { colorSpace: THREE.LinearSRGBColorSpace } 전달
 */
export function loadTexture(url, { colorSpace = THREE.SRGBColorSpace } = {}) {
  return new Promise((resolve, reject) => {
    texLoader.load(
      url,
      (texture) => {
        if (colorSpace) {
          texture.colorSpace = colorSpace;
        }
        resolve(texture);
      },
      undefined,
      (error) => reject(error)
    );
  });
}

export { manager };
