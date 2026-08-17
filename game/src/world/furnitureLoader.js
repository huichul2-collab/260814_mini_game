import * as THREE from 'three';
import { FURNITURE } from '../../furniture.js';
import { makeDesk, makeStudyDesk } from './props/desk.js';
import { makeChair, makeOfficeChair } from './props/chair.js';
import { makeBookshelf, makeLargeBookshelf } from './props/bookshelf.js';
import { makePlant, makeLargePlant } from './props/plant.js';
import { makeFrame, makePictureFrame } from './props/frame.js';
import { makeRug, makeCushion, makeCircleRug, makeRectRug, makeSquareRug } from './props/rug.js';
import { makeLamp } from './props/lamp.js';
import { makeDoubleBed, makeSingleBed } from './props/bed.js';
import { makeNightstand, makeSmallNightstand } from './props/nightstand.js';
import { makeWardrobe } from './props/wardrobe.js';
import { makeDresser } from './props/dresser.js';
import { makeArmchair, makeTeaTable } from './props/seating.js';

const PROP_BUILDERS = {
  desk: (item) => makeDesk(item.id),
  studyDesk: (item) => makeStudyDesk(item.id),
  chair: (item) => makeChair(item.id),
  officeChair: (item) => makeOfficeChair(item.id),
  bookshelf: (item) => makeBookshelf(item.id),
  largeBookshelf: (item) => makeLargeBookshelf(item.id),
  plant: (item) => makePlant(item.id),
  largePlant: (item) => makeLargePlant(item.id),
  frame: (item) => makeFrame(item.id),
  pictureFrame: (item) => makePictureFrame(item.id),
  rug: (item) => makeRug(item.id),
  cushion: (item) => makeCushion(item.id),
  circleRug: (item) => makeCircleRug(item.id),
  rectRug: (item) => makeRectRug(item.id),
  squareRug: (item) => makeSquareRug(item.id),
  lamp: (item, camera, renderer) => makeLamp(item.id, camera, renderer),
  doubleBed: (item) => makeDoubleBed(item.id),
  singleBed: (item) => makeSingleBed(item.id),
  nightstand: (item) => makeNightstand(item.id),
  smallNightstand: (item) => makeSmallNightstand(item.id),
  wardrobe: (item) => makeWardrobe(item.id),
  dresser: (item) => makeDresser(item.id),
  armchair: (item) => makeArmchair(item.id),
  teaTable: (item) => makeTeaTable(item.id),
};

export function createFurnitureForRoom(scene, roomName, camera, renderer) {
  const roomGroup = new THREE.Group();
  scene.add(roomGroup);

  const roomItems = FURNITURE.filter((item) => item.room === roomName);
  for (const item of roomItems) {
    const builder = PROP_BUILDERS[item.type];
    if (!builder) {
      console.warn(`[furnitureLoader] 알 수 없는 가구 타입: ${item.type}`);
      continue;
    }
    const prop = builder(item, camera, renderer);
    if (prop) {
      prop.position.set(item.pos[0], item.pos[1], item.pos[2]);
      if (item.rotY) prop.rotation.y = item.rotY;
      roomGroup.add(prop);
    }
  }

  return { room: roomGroup };
}

export function createFurniture(scene, camera, renderer) {
  const rooms = ['living', 'bedA', 'study', 'bedB'];
  const roomGroups = {};
  for (const r of rooms) {
    roomGroups[r] = createFurnitureForRoom(scene, r, camera, renderer);
  }
  return roomGroups;
}
