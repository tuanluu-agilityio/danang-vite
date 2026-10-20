/* Cầu Rồng: thân, đầu, vảy, phun lửa & nước. Cầu Rồng dựng thẳng vào scene (không dùng BridgeBase) như bản gốc */
import './materials';
import { buildBridgeDeck, buildPiers } from './deck';
import { buildDragonBody, buildScales, buildHangers } from './body';
import { buildDragonHead } from './head';

export { deckY, flatY } from './profile';
export { createFire, createWaterJet, updateShow, updateEffects, show, showLabel, mouthW } from './effects';
export { buildBridgeDeck, buildPiers, buildDragonBody, buildScales, buildHangers, buildDragonHead };
