/* ===== Người treo dù: đường lùi của plLoad (src/explore/pilot/load.ts) =====
   Bước tải thô giả qua __plSetRawLoad (không mạng, không GLTFLoader); loadMs ngắn tạm đặt rồi khôi phục. Kiểm: quá giờ, bị từ chối, thiếu `sit`, thiếu xương → null + đúng một console.warn. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { plLoad, __plSetRawLoad } from '../../src/explore/pilot/load.ts';

const P = CONFIG.explore.pilot;
const clone = (o: THREE.Object3D) => o.clone(true);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Chạy một ca với loadMs ngắn và đếm console.warn; luôn khôi phục */
async function ca(raw: Parameters<typeof __plSetRawLoad>[0], loadMs: number, f: (warns: unknown[][]) => Promise<void>): Promise<void> {
  const oldMs = P.loadMs, oldWarn = console.warn, warns: unknown[][] = [];
  P.loadMs = loadMs; console.warn = (...a: unknown[]) => { warns.push(a); };
  __plSetRawLoad(raw);
  try { await f(warns); } finally { P.loadMs = oldMs; console.warn = oldWarn; __plSetRawLoad(null); }
}

test('plLoad quá giờ: null, một warn, kết quả về muộn bị bỏ', async () => {
  await ca(() => new Promise((r) => setTimeout(() => r({ scene: new THREE.Group(), animations: [new THREE.AnimationClip('sit', 1, [])], clone }), 120)), 30, async (warns) => {
    assert.equal(await plLoad(), null);
    assert.equal(warns.length, 1);
    await sleep(250);   // kết quả muộn (và lỗi thiếu xương của nó) không sinh thêm warn, không đổi kết quả đã nhớ
    assert.equal(await plLoad(), null);
    assert.equal(warns.length, 1);
  });
});

test('plLoad bị từ chối: null, một warn, không ném', async () => {
  await ca(() => Promise.reject(new Error('mạng lỗi')), 5000, async (warns) => {
    assert.equal(await plLoad(), null);
    assert.equal(warns.length, 1);
  });
});

test('plLoad thiếu đoạn `sit`: null, một warn', async () => {
  await ca(async () => ({ scene: new THREE.Group(), animations: [new THREE.AnimationClip('khac', 1, [])], clone }), 5000, async (warns) => {
    assert.equal(await plLoad(), null);
    assert.equal(warns.length, 1);
  });
});

test('plLoad thiếu xương bắt buộc (có `sit`): null, một warn', async () => {
  await ca(async () => ({ scene: new THREE.Group(), animations: [new THREE.AnimationClip('sit', 1, [])], clone }), 5000, async (warns) => {
    assert.equal(await plLoad(), null);
    assert.equal(warns.length, 1);
  });
});
