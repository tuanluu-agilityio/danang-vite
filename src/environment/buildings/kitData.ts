/* ===== Nhà ven sông (D-037 bản 2): nạp bộ phụ kiện public/buildings/kit.glb =====
   - bkLoad(): import() động GLTFLoader (cùng chunk với xe / người treo), nạp kit.glb một lần; main.ts chờ trước khi dựng cảnh (như crowdLoad).
     Lỗi bất kỳ / quá CONFIG.buildings.loadMs / tệp thiếu họ hay thuộc tính → console.warn một lần, null: nhà vẫn là hộp như trước.
     ?buildings=off → null ngay, không gửi yêu cầu.
   - Hợp đồng tệp: spec §6.2. GLTFLoader r165 đặt tên thuộc tính tùy biến bằng chữ thường (_OFF → _off, _RULE → _rule, _GLOW → _glow);
     COLOR_0 → color (vec4 ubyte chuẩn hóa). Ở đây đổi tên sang bkOff / bkRule / bkGlow cho shader của kit.ts. */
import * as THREE from 'three';
import { CONFIG } from '../../config';

export type BkKit = Map<number, THREE.BufferGeometry>;   // họ 1..5 → hình học (position = neo trong hộp đơn vị, normal, color, bkOff, bkRule, bkGlow)

let loaded: BkKit | null = null;
let pending: Promise<BkKit | null> | null = null;
export let bkAttrNames: string[] = [];   // tên thuộc tính GLTFLoader thật sự trả về (của fam1), cho test / báo cáo

export function bkGet(): BkKit | null { return loaded; }

/* Tìm thuộc tính theo tên gốc của glTF, chấp nhận cả chữ hoa lẫn chữ thường */
const attr = (g: THREE.BufferGeometry, name: string) => g.getAttribute(name.toLowerCase()) ?? g.getAttribute(name);

/* Kiểm và chuẩn hóa một họ; lỗi thì ném */
function bkCheck(id: number, g: THREE.BufferGeometry | undefined): THREE.BufferGeometry {
  if (!g) throw new Error(`thiếu lưới fam${id}`);
  const need: [string, string, number][] = [['position', 'position', 3], ['normal', 'normal', 3], ['color', 'color', 4], ['_OFF', 'bkOff', 3], ['_RULE', 'bkRule', 1], ['_GLOW', 'bkGlow', 1]];
  const out = new THREE.BufferGeometry();
  for (const [src, dst, n] of need) {
    const a = attr(g, src);
    if (!a || a.itemSize !== n || a.count !== g.getAttribute('position')?.count) throw new Error(`fam${id}: thuộc tính ${src} thiếu hoặc sai cỡ`);
    out.setAttribute(dst, a);
  }
  if (g.index) out.setIndex(g.index);
  return out;
}

export function bkLoad(): Promise<BkKit | null> {
  if (pending) return pending;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('buildings') === 'off') return (pending = Promise.resolve(null));
  pending = (async () => {
    const C = CONFIG.buildings;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`quá ${C.loadMs} ms`)), C.loadMs); });
    const work = (async (): Promise<BkKit> => {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + C.url);
      const byName = new Map<string, THREE.BufferGeometry>();
      gltf.scene.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) byName.set(me.name || me.parent?.name || '', me.geometry); });
      const f1 = byName.get('fam1'); bkAttrNames = f1 ? Object.keys(f1.attributes) : [];
      const kit: BkKit = new Map();
      for (let id = 1; id <= 5; id++) kit.set(id, bkCheck(id, byName.get(`fam${id}`)));
      for (const g of byName.values()) g.dispose();   // bản gốc: thuộc tính đã chuyển sang hình học mới, chưa lên GPU
      return kit;
    })();
    work.catch(() => {}); timeout.catch(() => {});
    try {
      loaded = await Promise.race([work, timeout]);
    } catch (e) {
      console.warn('[buildings] không dùng được kit nhà ven sông, nhà giữ khối hộp:', e instanceof Error ? e.message : e);
      loaded = null;
    } finally { clearTimeout(timer); }
    return loaded;
  })();
  return pending;
}
