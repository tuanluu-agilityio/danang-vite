/* ===== Đoạn giới thiệu điện ảnh: tư thế camera (thuần) — D-045 ===== */
export type InVec = [number, number, number];
export interface InPose { pos: InVec; target: InVec }
export interface InShot { from: InPose; to: InPose }

/* smootherstep 6k⁵ − 15k⁴ + 10k³, kẹp [0, 1] */
export function inEase(k: number): number {
  const x = k < 0 ? 0 : k > 1 ? 1 : k;
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/* Ghi vào pos / target (không cấp phát), nội suy theo inEase(k) */
export function inPose(shot: InShot, k: number, pos: InVec, target: InVec): void {
  const e = inEase(k);
  for (let j = 0; j < 3; j++) {
    pos[j] = shot.from.pos[j] + (shot.to.pos[j] - shot.from.pos[j]) * e;
    target[j] = shot.from.target[j] + (shot.to.target[j] - shot.from.target[j]) * e;
  }
}

/* Quay pos quanh trục Y qua target một góc ang (rad), ghi tại chỗ */
export function inOrbit(pos: InVec, target: InVec, ang: number): void {
  const dx = pos[0] - target[0], dz = pos[2] - target[2], c = Math.cos(ang), s = Math.sin(ang);
  pos[0] = target[0] + dx * c + dz * s;
  pos[2] = target[2] - dx * s + dz * c;
}
