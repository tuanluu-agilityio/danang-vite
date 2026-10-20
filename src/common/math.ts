import * as THREE from 'three';

/* Số ngẫu nhiên có hạt giống (mulberry32): cảnh dựng ra giống hệt nhau mỗi lần tải */
export const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
/* Chuỗi dùng chung cho Cầu Rồng và khu phố. Thứ tự gọi quyết định hình dạng cảnh: giữ đúng thứ tự dựng trong main.ts */
export const rand = rng(20130329); // ngày khánh thành Cầu Rồng
export const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
export const smooth = (t: number) => t * t * (3 - 2 * t);
