import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { UP } from './geometry';

/* Người đi bộ mức chi tiết thấp. Mỗi người: { x, z, lo, hi, dir, speed, profile(c) → cao độ, axis: 'x' | 'z' } */
export interface Walker { x: number; z: number; lo: number; hi: number; dir: number; speed: number; profile: (c: number) => number; axis?: 'x' | 'z' }
export interface People { list: Walker[]; mesh: THREE.InstancedMesh; group: THREE.Group }

export function createPeople(bridge: { group: THREE.Group; noReflect: THREE.Object3D[] }, list: Walker[], mat: THREE.Material, name: string, rnd: () => number): People {
  const body = mergeGeometries([new THREE.CylinderGeometry(0.19, 0.24, 1.25, 7).translate(0, 0.63, 0), new THREE.SphereGeometry(0.13, 8, 6).translate(0, 1.42, 0)]);
  const mesh = new THREE.InstancedMesh(body, mat, list.length), col = new THREE.Color();
  const clothes = [0xd94b3d, 0x2f6fb5, 0xf2f2ee, 0x3a3a3a, 0xe0b23a, 0x4f9a5a, 0xc76fa8];
  list.forEach((_p, i) => mesh.setColorAt(i, col.setHex(clothes[Math.floor(rnd() * clothes.length)])));
  mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const group = new THREE.Group(); group.name = name; group.add(mesh);
  bridge.group.add(group); bridge.noReflect.push(group);
  return { list, mesh, group };
}
export function stepPeople(P: People, dt: number, elapsed: number) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  P.list.forEach((p, i) => {
    const alongZ = p.axis === 'z', key = alongZ ? 'z' : 'x';
    p[key] += p.dir * p.speed * dt; if (p[key] > p.hi) p[key] = p.lo; if (p[key] < p.lo) p[key] = p.hi;
    const y = p.profile(p[key]) + 0.05 * Math.abs(Math.sin(elapsed * 5.5 + i));
    q.setFromAxisAngle(UP, alongZ ? (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI));
    P.mesh.setMatrixAt(i, m.compose(v.set(p.x, y, p.z), q, one));
  });
  P.mesh.instanceMatrix.needsUpdate = true;
}
