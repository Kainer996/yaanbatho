/**
 * QuarryPro — open-source environment asset library.
 *
 * Loads the CC0 GLB models in assets/models/ (see CREDITS.md) and hands out
 * normalised, shadow-ready clones. Everything degrades gracefully: if a
 * model cannot be fetched (offline, single-file build, blocked CDN), callers
 * get null and fall back to the procedural geometry.
 */

import * as THREE from 'https://esm.sh/three@0.161.0';
import { GLTFLoader } from 'https://esm.sh/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';

const MODEL_MANIFEST = [
  { key: 'pineA', url: 'assets/models/pine-a.glb', targetHeight: 13 },
  { key: 'pineB', url: 'assets/models/pine-b.glb', targetHeight: 15 },
  { key: 'rockA', url: 'assets/models/rock-a.glb', targetHeight: 2.4 },
  { key: 'rockB', url: 'assets/models/rock-b.glb', targetHeight: 3.2 },
  { key: 'rockC', url: 'assets/models/rock-c.glb', targetHeight: 2.0 },
  { key: 'rockD', url: 'assets/models/rock-d.glb', targetHeight: 4.2 },
  { key: 'bushA', url: 'assets/models/bush-a.glb', targetHeight: 1.9 },
  { key: 'bushB', url: 'assets/models/bush-b.glb', targetHeight: 2.6 },
];

const library = {
  ready: false,
  models: {},
};

function normalisePrototype(gltfScene, targetHeight) {
  const proto = gltfScene;
  // Scale so the model's height matches the requested world height and its
  // base sits on y=0, regardless of how the source file was authored.
  const box = new THREE.Box3().setFromObject(proto);
  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(0.001, size.y);
  const scale = targetHeight / height;
  proto.scale.setScalar(scale);
  proto.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(proto);
  proto.position.y -= scaledBox.min.y;
  const centre = scaledBox.getCenter(new THREE.Vector3());
  proto.position.x -= centre.x;
  proto.position.z -= centre.z;

  proto.traverse(child => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.material) {
      child.material.roughness = Math.max(0.7, child.material.roughness ?? 0.9);
      child.material.metalness = 0;
    }
  });
  return proto;
}

export async function loadAssetLibrary({ timeoutMs = 12000 } = {}) {
  if (library.ready) return library;
  const loader = new GLTFLoader();

  const withTimeout = promise => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('asset timeout')), timeoutMs)),
  ]);

  await Promise.all(MODEL_MANIFEST.map(async spec => {
    try {
      const gltf = await withTimeout(loader.loadAsync(spec.url));
      const wrapper = new THREE.Group();
      wrapper.add(normalisePrototype(gltf.scene, spec.targetHeight));
      library.models[spec.key] = wrapper;
    } catch (err) {
      // Missing model is fine — procedural fallback covers it.
      library.models[spec.key] = null;
    }
  }));

  library.ready = Object.values(library.models).some(Boolean);
  return library;
}

function cloneModel(key, { scaleJitter = 0.25 } = {}) {
  const proto = library.models[key];
  if (!proto) return null;
  const clone = proto.clone(true);
  const jitter = 1 + (Math.random() - 0.5) * 2 * scaleJitter;
  clone.scale.multiplyScalar(jitter);
  clone.rotation.y = Math.random() * Math.PI * 2;
  return clone;
}

export function isAssetLibraryReady() {
  return library.ready;
}

export function createTreeModel() {
  const key = Math.random() < 0.6 ? 'pineA' : 'pineB';
  return cloneModel(key) || cloneModel(key === 'pineA' ? 'pineB' : 'pineA');
}

export function createRockModel({ large = false } = {}) {
  const keys = large ? ['rockD', 'rockB'] : ['rockA', 'rockC', 'rockB'];
  const key = keys[Math.floor(Math.random() * keys.length)];
  return cloneModel(key, { scaleJitter: 0.35 });
}

export function createBushModel() {
  const key = Math.random() < 0.5 ? 'bushA' : 'bushB';
  return cloneModel(key, { scaleJitter: 0.3 });
}
