/* ===== Ảnh xem trước hai nhân vật Đi dạo ở sảnh (nam / nữ): public/people/thumb-m.webp, thumb-f.webp =====
   npm run gen:thumbs. Mở Chromium (Playwright, như các test), nạp p<k>.glb bằng GLTFLoader của three, đặt dáng đứng (đoạn idle), vẽ lên canvas nền trong suốt rồi ghi WebP.
   Mô hình lấy theo CHARS bên dưới: phải khớp CONFIG.stroll.anim.chars (tests/stroll-unit/glb.test.ts kiểm hai tệp ảnh có và đủ nhỏ). Chỉ chạy lại khi đổi nhân vật. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serveDir, launch } from '../../tests/lib.mjs';

const CHARS = [['thumb-m', 0], ['thumb-f', 3]];   // [tên ảnh, số mô hình]: nam p0, nữ p3 (CONFIG.stroll.anim.chars)
const W = 240, H = 360;                           // px — gấp đôi cỡ hiện ở sảnh (120 × 180 tối đa)
const PUB = fileURLToPath(new URL('../../public/', import.meta.url));

const HTML = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
window.shot = async (k, w, h) => {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(w, h); r.setClearColor(0, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 2.2));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4); sun.position.set(3, 4, 2); scene.add(sun);
  const g = await new GLTFLoader().loadAsync('/people/p' + k + '.glb');
  g.scene.traverse((o) => { o.frustumCulled = false; });
  scene.add(g.scene);
  const idle = g.animations.find((a) => a.name === 'idle');
  if (idle) { const m = new THREE.AnimationMixer(g.scene); m.clipAction(idle).play(); m.setTime(0.5); }
  const top = Number(g.scene.userData.height) || 1.75;
  const cam = new THREE.PerspectiveCamera(18, w / h, 0.1, 50);
  const a = 0.45, d = 6.4;   // mô hình hướng +X: camera lệch 26° sang bên, ngang ngực
  cam.position.set(Math.cos(a) * d, top * 0.56, Math.sin(a) * d); cam.lookAt(0, top * 0.5, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/webp', 0.86);
  r.dispose();
  return url;
};
window.ready = true;
</script>`;

const srv = await serveDir(PUB);
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.route('**/__thumb.html', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: HTML }));
  page.on('pageerror', (e) => console.error(String(e)));
  await page.goto(srv.url + '__thumb.html');
  await page.waitForFunction(() => window.ready === true);
  for (const [name, k] of CHARS) {
    const url = await page.evaluate(([k, w, h]) => window.shot(k, w, h), [k, W, H]);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(PUB + 'people/' + name + '.webp', buf);
    console.log(`people/${name}.webp ← p${k}.glb: ${buf.length} byte`);
  }
} finally { await browser.close(); srv.close(); }
