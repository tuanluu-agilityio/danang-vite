import * as THREE from 'three';
import { HR, hrBedY, hrTrenchY, hrTrenchTop } from './profile';
import type { HrMaterials } from './materials';

/* [riverbed] Đáy sông dọc tuyến hầm (chỉ thấy khi nước trong suốt hoặc ở chế độ mặt cắt): đáy nông dần về kè, hào nạo vét cho
   hầm dìm, và lớp đá hộc phủ nóc từng đốt (dải ribbon mỗi đốt để mô phỏng dìm đốt số 3 có thể ẩn riêng).
   Tọa độ cục bộ của group hầm (z = 0 ở tim tuyến). */
const ZMIN = -2600 - HR.z, ZMAX = 2600 - HR.z, XB = 264, STEP = 6;

export interface Riverbed { group: THREE.Group; ribbons: THREE.Mesh[] }
export function hrBuildRiverbed(M: HrMaterials): Riverbed {
  const group = new THREE.Group(); group.name = 'hr-riverbed';
  // lưới đáy sông: mỗi hàng ngang x có 6 cột z: biên, mép miệng hào, chân hào (×2)
  const xs: number[] = []; for (let x = -XB; x <= XB + 1e-6; x += STEP) xs.push(x);
  const pos: number[] = [], idx: number[] = [], C = 6;
  for (const x of xs) {
    const bed = hrBedY(x), tb = hrTrenchY(x), top = hrTrenchTop(x), bot = HR.trenchBottomHalf;
    for (const [z, y] of [[ZMIN, bed], [-top, bed], [-bot, tb], [bot, tb], [top, bed], [ZMAX, bed]]) pos.push(x, y, z);
  }
  for (let r = 0; r < xs.length - 1; r++) for (let c = 0; c < C - 1; c++) {
    const a = r * C + c, b = a + 1, d = (r + 1) * C + c, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const bed = new THREE.Mesh(g, M.bed); bed.receiveShadow = true; bed.name = 'hr-bed'; group.add(bed);

  // đá hộc phủ nóc: dải theo bề rộng miệng hào, nằm ngang mực đáy sông; mỗi đốt một dải
  const ribbons: THREE.Mesh[] = [];
  for (let i = 0; i < HR.elements; i++) {
    const lo = Math.max(HR.elementEdges[i], -XB), hi = Math.min(HR.elementEdges[i + 1], XB), n = Math.max(1, Math.ceil((hi - lo) / STEP));
    const p: number[] = [], uv: number[] = [], ix: number[] = [];
    for (let k = 0; k <= n; k++) {
      const x = lo + (hi - lo) * k / n, y = hrBedY(x) + 0.04, w = hrTrenchTop(x);
      p.push(x, y, -w, x, y, w); uv.push(x / 8, -w / 8, x / 8, w / 8);
      if (k < n) { const a = k * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    rg.setIndex(ix); rg.computeVertexNormals();
    const m = new THREE.Mesh(rg, M.rubble); m.receiveShadow = true; m.name = `hr-rubble-${i + 1}`;
    ribbons.push(m); group.add(m);
  }
  return { group, ribbons };
}
