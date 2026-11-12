/* ===== Người treo dù: nạp mô hình nhân vật có xương (public/people/pilot.glb) (src/explore/pilot/load.ts) =====
   - plLoad(): import() động GLTFLoader + SkeletonUtils (chunk riêng, trang thường không tải; cùng chunk với Đi dạo), nạp pilot.glb một lần trong phiên.
     Lỗi bất kỳ (mạng, tệp hỏng, thiếu đoạn `sit`, thiếu xương bắt buộc) hoặc quá CONFIG.explore.pilot.loadMs → console.warn một lần, trả null,
     không thử lại; promise không bao giờ bị từ chối. Về muộn sau khi đã quá giờ thì bỏ (giữ hình khối suốt phiên, spec §7).
   - plSource(): chuẩn hóa cảnh đã nạp: lớp 1 (không vào phản chiếu nước), không đổ / nhận bóng, tắt frustumCulled (hộp bao theo tư thế gốc sai khi diễn).
     KHÁC Đi dạo: giữ normalMap và roughnessMap (kênh G của ORM) của glb, không ghi đè độ nhám bằng hằng số.
   - Làm nóng shader (D-018): sau khi nạp, chờ hàm do plSetWarm gắn (compileAsync theo cảnh chính, ≤ pilot.warmMs) rồi mới trả nguồn. Thiết kế: spec §4, §7. */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { plBonesMissing } from './bones';

export interface PlSource {
  scene: THREE.Object3D;                          // cảnh gốc (không thêm vào scene; chỉ để sao chép)
  clip: THREE.AnimationClip;                      // đoạn `sit` (tư thế nền có nhịp thở)
  clone: (o: THREE.Object3D) => THREE.Object3D;   // SkeletonUtils.clone (test truyền bản giả)
}

/* Chuẩn hóa cảnh + đoạn đã nạp thành nguồn dùng chung. Thiếu `sit` hoặc thiếu xương bắt buộc thì ném (plLoad bắt, trả null) */
export function plSource(scene: THREE.Object3D, clips: THREE.AnimationClip[], clone: (o: THREE.Object3D) => THREE.Object3D): PlSource {
  const clip = clips.find((c) => c.name === 'sit');
  if (!clip) throw new Error('thiếu đoạn sit');
  const miss = plBonesMissing(scene);
  if (miss.length) throw new Error('thiếu xương ' + miss.join(', '));
  scene.traverse((o) => {
    o.layers.set(1);
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) if (mat.alphaTest > 0) mat.transparent = false;   // mảnh alpha (nếu có): cắt theo alphaTest, không trộn trong suốt
  });
  return { scene, clip, clone };
}

/* Làm nóng shader: explore/index.ts gắn hàm biên dịch sẵn (load.ts không import renderer để chạy được trong unit test) */
let warm: ((o: THREE.Object3D) => Promise<unknown>) | null = null;
export function plSetWarm(fn: ((o: THREE.Object3D) => Promise<unknown>) | null): void { warm = fn; }
async function plWarm(o: THREE.Object3D): Promise<void> {
  if (!warm) return;
  let timer = 0;
  try { await Promise.race([warm(o), new Promise<void>((r) => { timer = setTimeout(r, CONFIG.explore.pilot.warmMs) as unknown as number; })]); }
  catch { /* biên dịch trước lỗi: lần vẽ đầu tự biên dịch như cũ */ }
  finally { clearTimeout(timer); }
}

let cache: Promise<PlSource | null> | null = null;

/* Nạp một lần (nhớ đệm). Không bao giờ ném / từ chối: lỗi hoặc quá giờ → warn một lần, null */
export function plLoad(): Promise<PlSource | null> {
  if (cache) return cache;
  const P = CONFIG.explore.pilot;
  const work = (async (): Promise<PlSource | null> => {
    const [{ GLTFLoader }, SU] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/SkeletonUtils.js')]);
    const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + P.model);
    const src = plSource(gltf.scene, gltf.animations, SU.clone);
    await plWarm(src.scene);   // nguồn chỉ "sẵn sàng" sau khi shader skinning đã biên dịch: lần hiện đầu không khựng
    return src;
  })();
  let timer = 0;
  const late = new Promise<'late'>((r) => { timer = setTimeout(() => r('late'), P.loadMs) as unknown as number; });
  cache = Promise.race([work, late]).then((r) => {
    clearTimeout(timer);
    if (r === 'late') { console.warn('Dù lượn: tải người treo quá giờ, dùng hình khối'); return null; }
    return r;
  }, (e) => { clearTimeout(timer); console.warn('Dù lượn: không nạp được người treo, dùng hình khối', e); return null; });
  work.catch(() => { /* đã quá giờ: lỗi về muộn không còn ai nghe */ });
  return cache;
}
