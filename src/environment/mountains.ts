import * as THREE from 'three';
import { scene } from '../core/renderer';
import { MAT } from '../core/materials';
import { mtGeometry } from './mountainGeo';

/* Núi Sơn Trà (đông bắc) và dãy Hải Vân (tây bắc) làm đường chân trời.
   D-047: một lưới địa hình liền mạch phủ rừng (hình: terrain.ts, lưới + màu: mountainGeo.ts, vật liệu: mountainMat.ts) thay 7 hình nón cũ; vẫn một lệnh vẽ.
   Không đổ / nhận bóng: vùng bóng của mặt trời chỉ phủ quanh sông (core/lights.ts). */
export function buildMountains() {
  const mesh = new THREE.Mesh(mtGeometry(), MAT.mountain); mesh.name = 'mountains';
  scene.add(mesh);
}
