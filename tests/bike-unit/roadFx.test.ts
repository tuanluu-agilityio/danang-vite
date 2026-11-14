/* ===== Xe máy: hạt nhựa đường nhìn gần + vệt đèn khi ướt (src/explore/bike/roadFx.ts, D-040 Task 8) =====
   bkRoadPatch thuần chuỗi trên shader mẫu của MeshStandardMaterial: chèn đúng một lần, giữ các #include gốc,
   có uniform uRoadNear, mọi đóng góp nằm trong nhánh uRoadNear > 0 (= 0 ⇒ ảnh cũ trùng từng điểm ảnh). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { shared, weatherU } from '../../src/core/shared.ts';
import { bkRoadPatch, bkRoadKey, bkRoadSet } from '../../src/explore/bike/roadFx.ts';

const sample = () => ({ uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms), vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader });
const count = (s: string, sub: string) => s.split(sub).length - 1;

test('bkRoadPatch: chèn một lần, gọi hai lần không chèn đôi', () => {
  const sh = sample(); bkRoadPatch(sh);
  const f1 = sh.fragmentShader, v1 = sh.vertexShader;
  assert.equal(count(f1, 'uniform float uRoadNear;'), 1);
  assert.equal(count(v1, 'varying vec3 vBkW;'), 1);
  assert.equal(count(f1, 'varying vec3 vBkW;'), 1);
  bkRoadPatch(sh);
  assert.equal(sh.fragmentShader, f1); assert.equal(sh.vertexShader, v1);
});

test('bkRoadPatch: giữ #include gốc (roughnessmap, map, color, emissivemap, lights)', () => {
  const sh = sample(); bkRoadPatch(sh);
  for (const inc of ['roughnessmap_fragment', 'map_fragment', 'color_fragment', 'emissivemap_fragment', 'lights_physical_fragment', 'normal_fragment_maps'])
    assert.equal(count(sh.fragmentShader, `#include <${inc}>`), 1, inc);
  for (const inc of ['project_vertex', 'fog_vertex', 'common']) assert.equal(count(sh.vertexShader, `#include <${inc}>`), 1, inc);
});

test('bkRoadPatch: uniform dùng chung (uRoadNear, uWet, uNight) gắn đúng đối tượng; tên không trùng uniform của hook khác', () => {
  const sh = sample(); bkRoadPatch(sh);
  assert.equal(sh.uniforms.uRoadNear, shared.uRoadNear);
  assert.equal(sh.uniforms.uRnWet, weatherU.uWet);
  assert.equal(sh.uniforms.uRnNight, shared.uNight);
  assert.equal(shared.uRoadNear.value, 0, 'ngoài chế độ xe máy = 0');
  assert.ok(!/uniform float uNight;|uniform float uWet;/.test(sh.fragmentShader.replace(THREE.ShaderLib.standard.fragmentShader, '')), 'không khai lại uNight / uWet (ảo ảnh mùa hè đã khai uNight)');
});

test('bkRoadPatch: mọi đóng góp nằm trong nhánh uRoadNear > 0; không đụng roughness / normal', () => {
  const sh = sample(); bkRoadPatch(sh);
  const added = sh.fragmentShader.split('\n').filter((l) => !THREE.ShaderLib.standard.fragmentShader.includes(l)).join('\n');
  const writes = added.match(/(diffuseColor\.rgb|totalEmissiveRadiance)\s*[*+]?=/g) || [];
  assert.equal(writes.length, 2, `hai chỗ ghi: ${writes}`);
  assert.ok(!/roughnessFactor|normal\s*=/.test(added), 'không đổi nhám / pháp tuyến');
  /* mỗi chỗ ghi nằm trong khối if (uRoadNear > 0.0 ...) { ... } */
  const blocks = added.match(/if \(uRoadNear > 0\.0[^{]*\{[\s\S]*?\n\s*\}/g) || [];
  assert.equal(blocks.length, 2, 'hai khối if uRoadNear');
  for (const b of blocks) assert.ok(/diffuseColor\.rgb \*=|totalEmissiveRadiance \+=/.test(b));
  assert.ok(/uRoadNear/.test(blocks[0]) && /uRoadNear/.test(blocks[1]));
  assert.ok(!/texture2D|texture\(/.test(added), 'không lấy mẫu texture mới');
  /* vệt ướt chỉ khi uWet > 0 và uNight > 0 */
  assert.ok(/if \(uRoadNear > 0\.0 && uRnWet > 0\.0 && uRnNight > 0\.0\)/.test(added));
});

test('bkRoadPatch(wet: false): không có vệt ướt, vẫn có hạt', () => {
  const sh = sample(); bkRoadPatch(sh, { wet: false });
  assert.ok(!/totalEmissiveRadiance \+=/.test(sh.fragmentShader.replace(THREE.ShaderLib.standard.fragmentShader, '')));
  assert.ok(/diffuseColor\.rgb \*=/.test(sh.fragmentShader));
});

test('bkRoadPatch: thông số CONFIG.bike.road nằm trong chuỗi shader', () => {
  const R = CONFIG.bike.road, sh = sample(); bkRoadPatch(sh);
  assert.ok(R.detail === true && R.wet === true);
  for (const v of [R.grain, R.grainFar, R.streak]) assert.ok(sh.fragmentShader.includes(v.toFixed(4)), String(v));
});

test('bkRoadKey: hậu tố khóa program cố định (đổi một lần, không theo khung); bkRoadSet bật / tắt uRoadNear', () => {
  assert.equal(bkRoadKey(), '-bkr'); assert.equal(bkRoadKey(), bkRoadKey());
  assert.equal(bkRoadKey({ wet: false }), '-bkrd');
  bkRoadSet(true); assert.equal(shared.uRoadNear.value, 1);
  bkRoadSet(false); assert.equal(shared.uRoadNear.value, 0);
});
