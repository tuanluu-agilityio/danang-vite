import * as THREE from 'three';

/* Uniform dùng chung cho mọi hiệu ứng LED / cửa sổ đêm */
export const shared = { uTime: { value: 0 }, uNight: { value: 0 },
  uRoadNear: { value: 0 } };   // D-040 Task 8: cường độ hạt nhựa + vệt ướt trên vật liệu đường (explore/bike/roadFx.ts); 0 ngoài chế độ xe máy ⇒ không đổi điểm ảnh
/* Hệ số cỡ hạt lửa / nước theo chiều cao khung hình (cập nhật khi đổi kích thước) */
export const pScale = { value: 1 };
/* Uniform thời tiết (mặt ướt, mưa, gió, mù nóng, hệ số lắc). TÁCH khỏi `shared` vì MAT.ledRail dùng nguyên object `shared` làm uniforms.
   Mặc định 0 = không đổi gì; chỉ weather/index.ts ghi vào.
   Gió (GĐ4): uWindDir = hướng gió thổi tới (cos, sin) trên mặt XZ; biên độ lắc ĐÃ nhân hệ số phóng đại (m): uSwayTp (hanger TP),
   uSwayTtl (dây văng TTL, đường cong mưa–gió), uSwaySh (dây văng Cầu sông Hàn); uTreeLean / uTreeSway: độ nghiêng tĩnh / dao động tán cây (m dịch trên mỗi m cao). */
export const weatherU = {
  uWet: { value: 0 }, uRain: { value: 0 }, uWind: { value: 0 }, uGust: { value: 0 }, uHaze: { value: 0 }, uSwayK: { value: 0 },
  uWindDir: { value: [1, 0] }, uSwayTp: { value: 0 }, uSwayTtl: { value: 0 }, uSwaySh: { value: 0 }, uTreeLean: { value: 0 }, uTreeSway: { value: 0 },
  uSagTp: { value: 0 },  // GĐ7: võng thêm của cáp chủ Thuận Phước khi nóng (m, ĐÃ nhân phóng đại); 0 = không đổi gì
  /* Sương cho vài ShaderMaterial tự viết không có fog của three (tấm LED trái tim, màn LED quảng cáo; D-043): chỉ chế độ Trực tiếp đặt uFogLive = 1
     (weather/atmosphere.ts chép mật độ + màu FogExp2 mỗi khung). Mô phỏng / ?test = 0 ⇒ mix(…, 0) giữ nguyên điểm ảnh; đổi uniform, không biên dịch lại shader */
  uFogLive: { value: 0 }, uFogDensity: { value: 0 }, uFogColor: { value: new THREE.Color() }
};
/* GLSL kèm weatherU.uFogLive / uFogDensity / uFogColor: VERT_DECL + VERT_MAIN (trong main, không đổi gl_Position) ở vertex; FRAG_DECL + FRAG_MAIN sau tonemapping_fragment, TRƯỚC colorspace_fragment
   (màu sương là màu tuyến tính của scene.fog; colorspace_fragment tự đổi đúng cho màn hình lẫn render target của bloom, three thì đổi màu uniform theo đích vẽ). Công thức FogExp2 của three: 1 − exp(−(mật độ · độ sâu)²) */
export const LIVE_FOG = {
  VERT_DECL: 'varying float vLfDepth;', VERT_MAIN: 'vLfDepth = -(modelViewMatrix * vec4(position, 1.0)).z;',
  FRAG_DECL: 'uniform float uFogLive; uniform float uFogDensity; uniform vec3 uFogColor; varying float vLfDepth;',
  FRAG_MAIN: '{ float lfD = uFogDensity * vLfDepth; gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, uFogLive * (1.0 - exp(-lfD * lfD))); }'   // nhân mật độ × độ sâu trước (như fog_fragment): bình phương riêng từng số tràn / mất số ở độ chính xác mediump
};
/* Hệ số gió cho code CPU (thuyền, lửa/nước Cầu Rồng, râu rồng, sóng). Mặc định trung tính: x = z = 0, nhân 1 → không đổi hành vi. */
export const windFx = { x: 0, z: 0, boatRock: 1, whisker: 1, waveSpeed: 1 };
/* Vận hành theo thời tiết (GĐ5), mặc định trung tính: clear = tiến độ dọn xe khi đóng cầu (0–1); boatAway = tiến độ thuyền về bến (0–1);
   showAllowed = trình diễn Cầu Rồng được chạy; swingBlocked = khoá quay Cầu sông Hàn; wheelStopped = Vòng quay Mặt Trời dừng (GĐ6). KHÔNG đụng nút người dùng (lifeOn, show.on, quảng cáo). */
export const weatherFx = { clear: 0, boatAway: 0, showAllowed: true, swingBlocked: false, wheelStopped: false };
/* Phương tiện thứ i đã biến mất chưa khi tiến độ k (thứ tự cố định theo i, không dùng rand()): k = 0 → không ai, k = 1 → tất cả */
export const vanished = (i: number, k: number) => k > 0 && (i * 0.6180339887) % 1 < k;
