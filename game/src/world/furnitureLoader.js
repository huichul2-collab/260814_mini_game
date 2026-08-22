import * as THREE from 'three';
import { FURNITURE } from '../../furniture.js';
import { makeDesk, makeStudyDesk } from './props/desk.js';
import { makeChair, makeOfficeChair } from './props/chair.js';
import { makeBookshelf, makeLargeBookshelf } from './props/bookshelf.js';
import { makePlant, makeLargePlant } from './props/plant.js';
import { makeFrame, makePictureFrame } from './props/frame.js';
import { makeRug, makeCushion, makeCircleRug, makeRectRug, makeSquareRug, makeOldRug } from './props/rug.js';
import { makeLamp } from './props/lamp.js';
import { makeArmchair, makeTeaTable } from './props/seating.js';
import { makeClock } from './props/clock.js';
import { makeWorkbench } from './props/workbench.js';
import { makeBlankPaper } from './props/blankPaper.js';
import { makeAcrylicPanel } from './props/acrylicPanel.js';
import { makeMachine } from './props/machine.js';
import { makeDiary } from './props/diary.js';
import { makeAssembler } from './props/assembler.js';
import { makeKeyPiece } from './props/keyPiece.js';
import { makeShelf } from './props/shelf.js';
import { makeToolbox } from './props/toolbox.js';
import { makeCrate, makeCrateStack } from './props/crate.js';
import { makeCabinet, makeLockedCabinet } from './props/cabinet.js';

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
  armchair: (item) => makeArmchair(item.id),
  teaTable: (item) => makeTeaTable(item.id),
  clock: (item) => makeClock(item.id),
  workbench: (item) => makeWorkbench(item.id),
  blankPaper: (item) => makeBlankPaper(item.id),
  acrylicPanel: (item) => makeAcrylicPanel(item.id),
  machine: (item) => makeMachine(item.id),
  diary: (item) => makeDiary(item.id),
  assembler: (item) => makeAssembler(item.id),
  keyPiece: (item) => makeKeyPiece(item.id),
  shelf: (item) => makeShelf(item.id),
  toolbox: (item) => makeToolbox(item.id),
  crate: (item) => makeCrate(item.id),
  crateStack: (item) => makeCrateStack(item.id),
  cabinet: (item) => makeCabinet(item.id),
  lockedCabinet: (item) => makeLockedCabinet(item.id),
  oldRug: (item) => makeOldRug(item.id),
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
