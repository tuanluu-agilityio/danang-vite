import { CONFIG } from '../../config';
import { prepColored, loftOct, boxAt, fillBlock } from '../../common/geometry';
import { TTL, ttlRoadY } from './profile';
import type { TranThiLyBridge } from './TranThiLyBridge';

/* [approaches] trụ thân rộng, mố, đường đắp */
export function ttlBuildApproaches(bridge: TranThiLyBridge) {
  const W = TTL.westEnd, E = TTL.eastEnd, B = CONFIG.bankX;
  // Trụ thân rộng: trong sông có bệ móng (vệt nước bám qua shader 'wet'); trên bờ đặt trên dải phân cách đường ven sông.
  // Trụ là hình tĩnh nên gộp chung vào khối bê tông (1 draw call) thay vì InstancedMesh.
  TTL.piers.forEach((x) => {
    const inRiver = Math.abs(x) < B, y0 = inRiver ? -3 : CONFIG.landY - 1, top = ttlRoadY(x) - TTL.girderDepth;
    bridge.concreteParts.push(prepColored(loftOct([2.6, 19], [2.6, 19], y0, top, [x, 0], [x, 0], 0.5)));
    if (inRiver) bridge.concreteParts.push(prepColored(boxAt(7, 6.6, 25, x, -2.7, 0, 4)));
  });
  // mố + tường chắn đường đắp hai đầu
  for (const [x, a, b] of [[W, -470, W], [E, E, 450]]) {
    bridge.concreteParts.push(prepColored(boxAt(6, ttlRoadY(x) - CONFIG.landY + 1, TTL.deckWidth + 1, x, (ttlRoadY(x) + CONFIG.landY - 1) / 2 - 0.3, 0)));
    bridge.concreteParts.push(prepColored(fillBlock(a, b, TTL.deckWidth, 0, CONFIG.landY - 0.5, (xx) => ttlRoadY(xx) - 0.05, 40), () => 0.82));
  }
}
