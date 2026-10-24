import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { device } from './device';

/* ======================= Renderer, scene, camera, controls ======================= */
export const canvas = document.getElementById('scene') as HTMLCanvasElement;
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: !device.phone, powerPreference: 'high-performance' });   // điện thoại: không MSAA (chỉ đặt được lúc tạo context, D-018)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcfdde6, 0.00016);
export const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 30000);
camera.layers.enable(1); // lớp 1: vật thể chỉ vẽ trực tiếp, không vẽ vào phản chiếu mặt nước
camera.position.set(-430, 330, 560);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

export const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 12, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 8;
controls.maxDistance = 7000;
