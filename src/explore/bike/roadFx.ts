import { CONFIG } from '../../config';
import { shared, weatherU } from '../../core/shared';

/* ===== [bike] Mặt đường nhìn gần + vệt đèn khi ướt (D-040 Task 8, spec §9 + §17.3; mốc bỏ được: CONFIG.bike.road.detail = false) =====
   Một hàm vá chuỗi shader dùng chung cho các vật liệu đường người lái xe máy chạy trên:
   - MAT.road, MAT.road2 (environment/streets.ts, thuan-phuoc/site.ts, đường lái mới gộp vào): đã có hook ảo ảnh mùa hè (weather/summer.ts) —
     một vật liệu chỉ có MỘT onBeforeCompile nên bkRoadPatch được gọi BÊN TRONG hook đó và khóa program thêm hậu tố bkRoadKey();
   - `road` của Cầu sông Hàn, Thuận Phước, Trần Thị Lý, `roadOut` (dốc hở hầm): roadSharePatch() của summer.ts gắn CHUNG hook + khóa của MAT.road2
     (ảo ảnh tắt hẳn bằng uHaze hằng 0) để dùng chung program, số program không tăng (khóa riêng thêm 3 program: ngày, có bóng, gương nước — đã đo);
   - `roadIn` (trong ống hầm, luôn khô): không vá (khóa riêng thêm program; tùy chọn trong plan).
   (1) Hạt nhựa: nhiễu giá trị theo tọa độ thế giới XZ, hai tần số (grainHz; tần số mịn mờ hẳn ở grainFineFar), nhân vào diffuseColor.rgb biên độ ±grain,
       mờ về 0 tại grainFar. (2) Vệt ướt: khi uWet > 0 và uNight > 0, cộng vào totalEmissiveRadiance các dải ấm kéo dọc hướng nhìn (dải theo góc quanh camera trên
       mặt XZ, như ánh đèn đường soi dài trên nhựa ướt), mạnh dần khi nhìn sượt (Fresnel giả). Không lấy mẫu texture, không đổi nhám / pháp tuyến
       (mặt ướt đã tối + bớt nhám ở weather/wetness.ts, không tối thêm).
   Cường độ = shared.uRoadNear: 0 ngoài chế độ xe máy ⇒ mọi đóng góp nằm trong nhánh `if (uRoadNear > 0.0 ...)` không chạy, ảnh góc cũ trùng từng điểm ảnh.
   Khóa program đổi một lần lúc dựng (hằng chuỗi), không theo khung ⇒ mỗi vật liệu vẫn một program. Uniform đặt tên riêng (uRnWet, uRnNight) để không
   khai lại uNight của hook ảo ảnh. */
const R = CONFIG.bike.road;
const f = (x: number) => x.toFixed(4);
/* Hậu tố khóa program cho vật liệu đã có hook riêng (ảo ảnh mùa hè); '' khi tắt mốc ⇒ khóa cũ giữ nguyên */
export const bkRoadKey = (opt: { wet?: boolean } = {}) => (R.detail ? (opt.wet ?? R.wet ? '-bkr' : '-bkrd') : '');

interface ShaderLike { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }

const VERT_DECL = '\nvarying vec3 vBkW;';
const VERT_BODY = `
  { vec4 rnW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    rnW = instanceMatrix * rnW;
  #endif
    vBkW = (modelMatrix * rnW).xyz; }`;
const fragDecl = (wet: boolean) => `
varying vec3 vBkW; uniform float uRoadNear;${wet ? ' uniform float uRnWet; uniform float uRnNight;' : ''}
float rnHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float rnNoise(vec2 x){ vec2 i = floor(x), t = fract(x); t = t * t * (3.0 - 2.0 * t);
  return mix(mix(rnHash(i), rnHash(i + vec2(1.0, 0.0)), t.x), mix(rnHash(i + vec2(0.0, 1.0)), rnHash(i + vec2(1.0, 1.0)), t.x), t.y); }`;
/* Hạt nhựa: biên độ ±grain, mờ từ grainNear·grainFar tới grainFar */
const GRAIN = `
  if (uRoadNear > 0.0) {
    float rnD = distance(cameraPosition, vBkW);
    float rnF = uRoadNear * (1.0 - smoothstep(${f(R.grainFar * R.grainNear)}, ${f(R.grainFar)}, rnD));
    float rnG = (rnNoise(vBkW.xz * ${f(R.grainHz[0])}) - 0.5) + (rnNoise(vBkW.xz * ${f(R.grainHz[1])}) - 0.5) * (1.0 - smoothstep(${f(R.grainFineFar * 0.4)}, ${f(R.grainFineFar)}, rnD));
    diffuseColor.rgb *= 1.0 + ${f(R.grain)} * rnG * rnF;
  }`;
/* Vệt ướt: dải theo góc quanh camera (tuần hoàn streakN dải / vòng, không đứt ở ±π), Fresnel giả theo pháp tuyến hướng lên */
const N = f(R.streakN), SC = R.streakColor;
const STREAK = `
  if (uRoadNear > 0.0 && uRnWet > 0.0 && uRnNight > 0.0) {
    vec3 rnV = cameraPosition - vBkW; float rnL = length(rnV.xz);
    float rnA = (atan(rnV.z, rnV.x) / 6.2831853 + 0.5) * ${N}, rnI = floor(rnA), rnT = fract(rnA); rnT = rnT * rnT * (3.0 - 2.0 * rnT);
    float rnS = mix(rnHash(vec2(mod(rnI, ${N}), 7.0)), rnHash(vec2(mod(rnI + 1.0, ${N}), 7.0)), rnT);
    float rnFr = pow(1.0 - clamp(rnV.y / max(length(rnV), 1e-3), 0.0, 1.0), 4.0);
    float rnK = smoothstep(0.62, 0.92, rnS) * rnFr * smoothstep(${f(R.streakNear)}, ${f(R.streakNear * 3)}, rnL) * (1.0 - smoothstep(${f(R.streakFar * 0.5)}, ${f(R.streakFar)}, rnL));
    totalEmissiveRadiance += vec3(${f(SC[0])}, ${f(SC[1])}, ${f(SC[2])}) * (uRoadNear * uRnWet * uRnNight * ${f(R.streak)} * rnK);
  }`;

/* Vá chuỗi shader (thuần chuỗi, gọi được từ hook sẵn có). Gọi lại trên shader đã vá thì không làm gì. */
export function bkRoadPatch(shader: ShaderLike, opt: { wet?: boolean } = {}): void {
  if (shader.fragmentShader.includes('uniform float uRoadNear;')) return;
  const wet = opt.wet ?? R.wet;
  shader.uniforms.uRoadNear = shared.uRoadNear;
  if (wet) { shader.uniforms.uRnWet = weatherU.uWet; shader.uniforms.uRnNight = shared.uNight; }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>' + VERT_DECL)
    .replace('#include <fog_vertex>', '#include <fog_vertex>' + VERT_BODY);
  let frag = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + fragDecl(wet))
    .replace('#include <color_fragment>', '#include <color_fragment>' + GRAIN);
  if (wet) frag = frag.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + STREAK);
  shader.fragmentShader = frag;
}

/* Bật / tắt theo chế độ xe máy: start() → true (nếu detail), stop() → false */
export function bkRoadSet(on: boolean): void { shared.uRoadNear.value = on && R.detail ? 1 : 0; }
