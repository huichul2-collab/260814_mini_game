import { createFurnitureForRoom } from '../furnitureLoader.js';

export function createLivingRoom(scene, camera, renderer) {
  return createFurnitureForRoom(scene, 'living', camera, renderer);
}
