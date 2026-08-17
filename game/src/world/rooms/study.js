import { createFurnitureForRoom } from '../furnitureLoader.js';

export function createStudy(scene) {
  return createFurnitureForRoom(scene, 'study');
}
