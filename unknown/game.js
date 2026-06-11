// Unknown — Island Colony v19
// A peaceful RimWorld-inspired island colony sim.
// Procedural terrain · day/night cycle · autonomous residents with
// personality brains (optional per-resident LLM) · free-form building.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ============================================================
   0. DOM + quality
   ============================================================ */
const $ = (id) => document.getElementById(id);
const stage = $('ocean-stage');
const loaderEl = $('loader');
const loaderStep = $('loader-step');
const errorBox = $('webgl-error');

const isMobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const quality = {
    mobile: isMobile,
    pixelRatio: Math.min(devicePixelRatio, isMobile ? 1.1 : 1.7),
    shadows: !isMobile,
    shadowSize: 2048,
    bloom: !isMobile,
    reflectionSize: isMobile ? 256 : 768,
    terrainSegs: isMobile ? [120, 100] : [196, 160],
    grassCount: isMobile ? 420 : 1700,
    flowerCount: isMobile ? 90 : 320,
    treeFronds: isMobile ? 6 : 9,
    starCount: isMobile ? 500 : 1300,
    rainCount: isMobile ? 280 : 750
};

window.__unknownOcean = {
    status: 'booting',
    version: 'island-colony-v19-beautiful',
    runtimeMarker: 'island-colony-v19-beautiful',
    quality
};
window.__unknownOceanErrors = [];

function bootStep(text) { if (loaderStep) loaderStep.textContent = text; }

/* ============================================================
   1. RNG + noise
   ============================================================ */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const worldRng = mulberry32(20260611);

function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
}
function vnoise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const xf = x - x0, yf = y - y0;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash2(x0, y0), b = hash2(x0 + 1, y0);
    const c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, octaves = 4) {
    let value = 0, amp = 0.55, freq = 1;
    for (let i = 0; i < octaves; i++) {
        value += amp * vnoise(x * freq + i * 17.13, y * freq + i * 9.7);
        freq *= 2.02;
        amp *= 0.5;
    }
    return value;
}
function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

/* ============================================================
   2. Terrain — single analytic height function used by
      geometry, AI pathing, walking and object placement.
   ============================================================ */
const ISLAND = { rx: 230, rz: 185 };

function gauss(x, z, cx, cz, height, sigma) {
    const dx = x - cx, dz = z - cz;
    return height * Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
}

function heightAt(x, z) {
    const d = Math.hypot(x / ISLAND.rx, z / ISLAND.rz);
    const mask = smoothstep(1.04, 0.42, d);
    let h = 15 * mask;
    h += gauss(x, z, -70, -62, 23, 46) * smoothstep(1.05, 0.5, d);
    h += gauss(x, z, 62, -42, 7.5, 52);
    h += gauss(x, z, 42, 86, 6.5, 46);
    h += gauss(x, z, -92, 72, 5.0, 40);
    h += fbm(x * 0.013 + 3.1, z * 0.013 - 1.7, 4) * 5.2 * smoothstep(1.02, 0.55, d);
    h -= 7.4;
    if (h < 0) h *= 1.55;                       // steeper sea floor
    else if (h < 4) h *= 0.52 + 0.48 * (h / 4); // gentle beach shelf
    return h;
}

function slopeAt(x, z) {
    const e = 1.4;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
}

function insideIsland(x, z, margin = 0.96) {
    return Math.hypot(x / (ISLAND.rx * margin), z / (ISLAND.rz * margin)) < 1;
}

const terrainPalette = {
    deepSand: new THREE.Color(0x9c8a5e),
    wetSand: new THREE.Color(0xcdb787),
    drySand: new THREE.Color(0xe8d7a4),
    grassLight: new THREE.Color(0x8cc063),
    grass: new THREE.Color(0x5aa84e),
    grassDark: new THREE.Color(0x3c8743),
    rock: new THREE.Color(0x8d8a7d),
    rockHigh: new THREE.Color(0xa8a496)
};

function terrainColorAt(x, z, h, slope, out) {
    const n = fbm(x * 0.035 + 11, z * 0.035 - 7, 3);
    if (h < 0.4) {
        out.copy(terrainPalette.deepSand).lerp(terrainPalette.wetSand, smoothstep(-6, 0.4, h));
    } else if (h < 3.4) {
        out.copy(terrainPalette.wetSand).lerp(terrainPalette.drySand, smoothstep(0.4, 2.2, h));
    } else if (h < 6.5) {
        out.copy(terrainPalette.drySand).lerp(terrainPalette.grassLight, smoothstep(3.4, 6.0, h));
    } else {
        const deep = smoothstep(8, 19, h + n * 5);
        out.copy(terrainPalette.grassLight).lerp(terrainPalette.grass, smoothstep(6.2, 9.5, h));
        out.lerp(terrainPalette.grassDark, deep * 0.8);
    }
    const rocky = smoothstep(0.62, 0.95, slope) + smoothstep(21, 26, h);
    if (rocky > 0) {
        const rockCol = h > 24 ? terrainPalette.rockHigh : terrainPalette.rock;
        out.lerp(rockCol, clamp(rocky, 0, 1));
    }
    const tint = 0.92 + n * 0.16;
    out.multiplyScalar(tint);
}

function buildTerrain() {
    const [sx, sz] = quality.terrainSegs;
    const width = ISLAND.rx * 2.3, depth = ISLAND.rz * 2.3;
    const geo = new THREE.PlaneGeometry(width, depth, sx, sz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const h = heightAt(x, z);
        pos.setY(i, h);
        terrainColorAt(x, z, h, slopeAt(x, z), col);
        colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'island-terrain';
    mesh.receiveShadow = quality.shadows;
    return mesh;
}

/* ============================================================
   3. Renderer, scene, sky, lights, time-of-day
   ============================================================ */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbfe0f2, 0.00038);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 9000);
camera.position.set(180, 128, 245);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;
if (quality.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
stage.appendChild(renderer.domElement);

bootStep('summoning water…');
const water = new Water(new THREE.PlaneGeometry(9000, 9000, 1, 1), {
    textureWidth: quality.reflectionSize,
    textureHeight: quality.reflectionSize,
    waterNormals: makeWaterNormalTexture(isMobile ? 256 : 512),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xfff2c2,
    waterColor: 0x06425e,
    distortionScale: isMobile ? 3.4 : 4.4,
    fog: true
});
water.rotation.x = -Math.PI / 2;
water.material.uniforms.size.value = isMobile ? 3.2 : 2.4;
scene.add(water);

function makeWaterNormalTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    const data = image.data;
    const height = (x, y) => {
        let value = 0, amp = 0.55, freq = 0.035;
        for (let i = 0; i < 5; i++) {
            value += amp * vnoise(x * freq + i * 19.7, y * freq + i * 7.3);
            freq *= 2.06; amp *= 0.52;
        }
        value += 0.11 * Math.sin(x * 0.19 + y * 0.06);
        value += 0.08 * Math.sin(x * -0.08 + y * 0.23);
        return value;
    };
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nx = (height(x - 1, y) - height(x + 1, y)) * 1.85;
            const ny = (height(x, y - 1) - height(x, y + 1)) * 1.85;
            const inv = 1 / Math.hypot(nx, ny, 1);
            const i = (y * size + x) * 4;
            data[i] = ((nx * inv) * 0.5 + 0.5) * 255;
            data[i + 1] = ((ny * inv) * 0.5 + 0.5) * 255;
            data[i + 2] = (inv * 0.5 + 0.5) * 255;
            data[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 8;
    return texture;
}

// Shallow-water glow ring hugging the island
const shallows = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1.18, 96),
    new THREE.MeshBasicMaterial({ color: 0x6fd8da, transparent: true, opacity: 0.16, depthWrite: false })
);
shallows.rotation.x = -Math.PI / 2;
shallows.scale.set(ISLAND.rx, ISLAND.rz, 1);
shallows.position.y = 0.12;
scene.add(shallows);

const foamRing = new THREE.Mesh(
    new THREE.RingGeometry(0.965, 1.0, 128),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false })
);
foamRing.rotation.x = -Math.PI / 2;
foamRing.scale.set(ISLAND.rx * 0.84, ISLAND.rz * 0.84, 1);
foamRing.position.y = 0.18;
scene.add(foamRing);

bootStep('painting the sky…');
const sky = new Sky();
sky.scale.setScalar(8000);
scene.add(sky);
const skyUniforms = sky.material.uniforms;
skyUniforms.turbidity.value = 5.4;
skyUniforms.rayleigh.value = 1.6;
skyUniforms.mieCoefficient.value = 0.008;
skyUniforms.mieDirectionalG.value = 0.85;

const sunVec = new THREE.Vector3();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
let envTarget = null;

const hemiLight = new THREE.HemisphereLight(0xdff7ff, 0x2c4a30, 1.0);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffedbd, 2.2);
sunLight.position.set(200, 300, 100);
if (quality.shadows) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    sunLight.shadow.camera.near = 50;
    sunLight.shadow.camera.far = 1400;
    const ext = 300;
    sunLight.shadow.camera.left = -ext;
    sunLight.shadow.camera.right = ext;
    sunLight.shadow.camera.top = ext;
    sunLight.shadow.camera.bottom = -ext;
    sunLight.shadow.bias = -0.0008;
    sunLight.shadow.normalBias = 1.6;
}
scene.add(sunLight);
scene.add(sunLight.target);

const moonLight = new THREE.DirectionalLight(0x9db8ff, 0);
scene.add(moonLight);

// Stars
const starGeo = new THREE.BufferGeometry();
{
    const positions = new Float32Array(quality.starCount * 3);
    for (let i = 0; i < quality.starCount; i++) {
        const theta = worldRng() * Math.PI * 2;
        const phi = Math.acos(worldRng() * 0.92);
        const r = 3600;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi) + 120;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xeaf4ff, size: 5.4, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat);
stars.name = 'night-stars';
scene.add(stars);

// Moon disc
const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(72, 40),
    new THREE.MeshBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0, depthWrite: false, fog: false })
);
scene.add(moonDisc);

// Sun glare disc
const sunGlare = new THREE.Mesh(
    new THREE.CircleGeometry(95, 64),
    new THREE.MeshBasicMaterial({ color: 0xfff1aa, transparent: true, opacity: 0.7, depthWrite: false, fog: false })
);
scene.add(sunGlare);

// Drifting clouds
const cloudGroup = new THREE.Group();
cloudGroup.name = 'drifting-clouds';
{
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78, depthWrite: false, fog: false });
    const puffGeo = new THREE.SphereGeometry(1, 10, 8);
    const count = isMobile ? 7 : 13;
    for (let i = 0; i < count; i++) {
        const cloud = new THREE.Group();
        const puffs = 3 + Math.floor(worldRng() * 4);
        for (let p = 0; p < puffs; p++) {
            const puff = new THREE.Mesh(puffGeo, cloudMat);
            puff.position.set((p - puffs / 2) * 26 + worldRng() * 14, worldRng() * 9, worldRng() * 20 - 10);
            puff.scale.set(22 + worldRng() * 22, 11 + worldRng() * 8, 16 + worldRng() * 12);
            cloud.add(puff);
        }
        cloud.position.set(worldRng() * 2600 - 1300, 300 + worldRng() * 160, worldRng() * 2600 - 1300);
        cloud.userData.speed = 2.5 + worldRng() * 3.2;
        cloudGroup.add(cloud);
    }
}
scene.add(cloudGroup);

/* ---- game clock ---- */
const gameClock = {
    day: 1,
    hour: 9.0,           // 0-24
    speed: 1,            // 0 paused, 1, 3
    minutesPerRealSecond: 2.4   // 1x: a full day lasts 10 real minutes
};

function phaseOfDay() {
    const h = gameClock.hour;
    if (h < 5.5) return 'night';
    if (h < 8) return 'dawn';
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 20) return 'evening';
    if (h < 21.5) return 'dusk';
    return 'night';
}

function sunElevation() {
    // peaks ~62° at 13:00, below horizon at night
    return Math.sin(((gameClock.hour - 6.4) / 13.6) * Math.PI) * 62;
}

let lastEnvElevationBucket = null;
function updateDayNight(force = false) {
    const elev = sunElevation();
    const azimuth = 95 + (gameClock.hour / 24) * 150;
    const phi = THREE.MathUtils.degToRad(90 - Math.max(elev, -12));
    const theta = THREE.MathUtils.degToRad(azimuth);
    sunVec.setFromSphericalCoords(1, phi, theta);
    skyUniforms.sunPosition.value.copy(sunVec);
    water.material.uniforms.sunDirection.value.copy(sunVec).normalize();

    const dayness = smoothstep(-4, 10, elev);          // 0 night → 1 day
    const golden = smoothstep(-3, 7, elev) * (1 - smoothstep(14, 30, elev)); // sunrise/sunset warmth

    sunLight.position.copy(sunVec).multiplyScalar(620);
    sunLight.intensity = 2.5 * dayness;
    sunLight.color.setHSL(0.12 - golden * 0.045, 0.62, 0.62 + golden * 0.1);
    hemiLight.intensity = 0.22 + dayness * 0.95;
    moonLight.intensity = (1 - dayness) * 0.34;
    moonLight.position.set(-sunVec.x * 500, Math.abs(sunVec.y) * 380 + 150, -sunVec.z * 500);
    starMat.opacity = (1 - dayness) * 0.95;
    moonDisc.material.opacity = (1 - dayness) * 0.92;
    moonDisc.position.copy(moonLight.position).normalize().multiplyScalar(3500);
    sunGlare.position.copy(sunVec).multiplyScalar(3500);
    sunGlare.material.opacity = 0.7 * dayness + golden * 0.2;
    sunGlare.material.color.setHSL(0.12 - golden * 0.05, 1.0, 0.78);

    // fog and water tint follow the light
    const fogCol = new THREE.Color(0xbfe0f2).lerp(new THREE.Color(0x0a1626), 1 - dayness);
    fogCol.lerp(new THREE.Color(0xf7c98e), golden * 0.35);
    scene.fog.color.copy(fogCol);
    const waterCol = new THREE.Color(0x06425e).lerp(new THREE.Color(0x021320), 1 - dayness);
    water.material.uniforms.waterColor.value.copy(waterCol);
    skyUniforms.rayleigh.value = 1.6 + golden * 1.9;
    skyUniforms.mieCoefficient.value = 0.008 + golden * 0.012;
    renderer.toneMappingExposure = 0.55 + dayness * 0.26;

    cloudGroup.children.forEach((cloud) => {
        cloud.children.forEach((puff) => {
            puff.material.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x33405e), 1 - dayness).lerp(new THREE.Color(0xffc489), golden * 0.5);
        });
    });

    // refresh environment map only when sun moved meaningfully
    const bucket = Math.round(elev / 4);
    if (force || bucket !== lastEnvElevationBucket) {
        lastEnvElevationBucket = bucket;
        envScene.add(sky);
        if (envTarget) envTarget.dispose();
        envTarget = pmremGenerator.fromScene(envScene);
        scene.add(sky);
        scene.environment = envTarget.texture;
    }
}

/* ============================================================
   4. Shared materials + asset builders
   ============================================================ */
const MAT = {
    trunk: new THREE.MeshStandardMaterial({ color: 0x7b5631, roughness: 0.92 }),
    trunkLight: new THREE.MeshStandardMaterial({ color: 0x9a7445, roughness: 0.9 }),
    palmLeaf: new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 0.8, side: THREE.DoubleSide }),
    palmLeafLight: new THREE.MeshStandardMaterial({ color: 0x3f9d56, roughness: 0.82, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3c8743, roughness: 0.88 }),
    leafDark: new THREE.MeshStandardMaterial({ color: 0x2c6b38, roughness: 0.9 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x83806f, roughness: 0.97 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8b5f36, roughness: 0.88 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x5e4023, roughness: 0.9 }),
    thatch: new THREE.MeshStandardMaterial({ color: 0xc9a25e, roughness: 0.98 }),
    thatchDark: new THREE.MeshStandardMaterial({ color: 0xa9854a, roughness: 0.98 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xf4ead0, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2f2118, roughness: 0.92 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc08457, roughness: 0.8 }),
    water: new THREE.MeshStandardMaterial({ color: 0x55b9d7, roughness: 0.25, transparent: true, opacity: 0.85 }),
    berry: new THREE.MeshStandardMaterial({ color: 0xc23a55, roughness: 0.65 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x6b4d31, roughness: 0.98 }),
    crop: new THREE.MeshStandardMaterial({ color: 0x7fb84a, roughness: 0.85 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x9a988c, roughness: 0.96 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a9aa2, roughness: 0.55, metalness: 0.35 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffd984 }),
    ember: new THREE.MeshBasicMaterial({ color: 0xff7b2c, transparent: true, opacity: 0.85 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.8 }),
    fish: new THREE.MeshStandardMaterial({ color: 0x7fc6d6, roughness: 0.5 }),
    shell: new THREE.MeshStandardMaterial({ color: 0xf3e8d3, roughness: 0.62 }),
    reed: new THREE.MeshStandardMaterial({ color: 0xc6ba77, roughness: 0.92 }),
    herb: new THREE.MeshStandardMaterial({ color: 0x5ba56a, roughness: 0.9 }),
    research: new THREE.MeshStandardMaterial({ color: 0x79b8ff, roughness: 0.5, emissive: 0x1c3a66, emissiveIntensity: 0.6 })
};

function shadowify(object) {
    if (!quality.shadows) return object;
    object.traverse((node) => {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    return object;
}

const world = new THREE.Group();
world.name = 'island-world';
scene.add(world);

bootStep('raising the island…');
const terrain = buildTerrain();
world.add(terrain);

// Sea floor far out, so deep water has something beneath it
const seafloor = new THREE.Mesh(
    new THREE.CircleGeometry(3200, 48),
    new THREE.MeshStandardMaterial({ color: 0x274b56, roughness: 1 })
);
seafloor.rotation.x = -Math.PI / 2;
seafloor.position.y = -14;
world.add(seafloor);

/* ---- trees ---- */
function makePalm(rng) {
    const palm = new THREE.Group();
    const height = 17 + rng() * 10;
    const lean = (rng() - 0.5) * 0.34;
    const segments = 5;
    let px = 0, py = 0, angle = lean;
    for (let s = 0; s < segments; s++) {
        const segLen = height / segments;
        const seg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.85 - s * 0.09, 1.05 - s * 0.09, segLen + 0.5, 7),
            s % 2 ? MAT.trunk : MAT.trunkLight
        );
        seg.position.set(px + Math.sin(angle) * segLen * 0.5, py + Math.cos(angle) * segLen * 0.5, 0);
        seg.rotation.z = -angle;
        palm.add(seg);
        px += Math.sin(angle) * segLen;
        py += Math.cos(angle) * segLen;
        angle += lean * 0.5;
    }
    const crown = new THREE.Group();
    crown.position.set(px, py, 0);
    for (let i = 0; i < quality.treeFronds; i++) {
        const frond = new THREE.Group();
        const fl = 10 + rng() * 4;
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(2.6, fl, 1, 4), rng() > 0.5 ? MAT.palmLeaf : MAT.palmLeafLight);
        // curve the frond
        const bp = blade.geometry.attributes.position;
        for (let v = 0; v < bp.count; v++) {
            const yy = bp.getY(v) / fl + 0.5;
            bp.setZ(v, Math.sin(yy * Math.PI) * -1.6);
            bp.setX(v, bp.getX(v) * (1 - yy * 0.7));
        }
        bp.needsUpdate = true;
        blade.geometry.computeVertexNormals();
        blade.position.y = fl * 0.5;
        frond.add(blade);
        frond.rotation.y = (i / quality.treeFronds) * Math.PI * 2 + rng() * 0.5;
        frond.rotation.x = Math.PI * 0.42 + rng() * 0.22;
        crown.add(frond);
    }
    for (let c = 0; c < 3; c++) {
        const nut = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), MAT.woodDark);
        nut.position.set(Math.cos(c * 2.1) * 1.5, -0.6, Math.sin(c * 2.1) * 1.5);
        crown.add(nut);
    }
    palm.add(crown);
    palm.userData.crown = crown;
    palm.userData.sway = rng() * Math.PI * 2;
    return shadowify(palm);
}

function makeBroadleaf(rng) {
    const tree = new THREE.Group();
    const h = 10 + rng() * 6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.35, h, 7), MAT.trunk);
    trunk.position.y = h / 2;
    tree.add(trunk);
    const blobs = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < blobs; i++) {
        const r = 3.0 + rng() * 2.2;
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), rng() > 0.45 ? MAT.leaf : MAT.leafDark);
        blob.position.set((rng() - 0.5) * 4.4, h + (rng() - 0.2) * 3, (rng() - 0.5) * 4.4);
        blob.scale.y = 0.78;
        tree.add(blob);
    }
    tree.userData.sway = rng() * Math.PI * 2;
    return shadowify(tree);
}

const trees = [];
function plantTree(builder, x, z) {
    const t = builder(worldRng);
    const h = heightAt(x, z);
    t.position.set(x, h - 0.3, z);
    t.rotation.y = worldRng() * Math.PI * 2;
    const s = 0.85 + worldRng() * 0.45;
    t.scale.setScalar(s);
    world.add(t);
    trees.push(t);
    return t;
}

bootStep('planting the forests…');
const occupied = [];   // [{x,z,r}] keep-clear zones, filled by camp/buildings
function isClear(x, z, r = 7) {
    return !occupied.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
}
function reserve(x, z, r) { occupied.push({ x, z, r }); }

// Reserve the village plaza + key prop sites before scattering trees
reserve(2, 20, 46);       // village
reserve(-60, -68, 34);    // farm terrace
reserve(72, -32, 30);     // workshop yard
reserve(44, 84, 28);      // research garden
reserve(-150, 46, 26);    // dock shore

{
    let planted = 0, attempts = 0;
    while (planted < (isMobile ? 26 : 44) && attempts < 1200) {
        attempts++;
        const a = worldRng() * Math.PI * 2;
        const rr = 0.5 + worldRng() * 0.55;
        const x = Math.cos(a) * ISLAND.rx * rr;
        const z = Math.sin(a) * ISLAND.rz * rr;
        const h = heightAt(x, z);
        if (!isClear(x, z, 13)) continue;
        if (h > 2.2 && h < 8.5 && slopeAt(x, z) < 0.5) { plantTree(makePalm, x, z); reserve(x, z, 7); planted++; }
        else if (h >= 8.5 && h < 21 && slopeAt(x, z) < 0.55 && worldRng() < 0.7) { plantTree(makeBroadleaf, x, z); reserve(x, z, 7); planted++; }
    }
}

/* ---- scattered rocks ---- */
{
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < (isMobile ? 14 : 26); i++) {
        const a = worldRng() * Math.PI * 2;
        const rr = 0.3 + worldRng() * 0.68;
        const x = Math.cos(a) * ISLAND.rx * rr;
        const z = Math.sin(a) * ISLAND.rz * rr;
        const h = heightAt(x, z);
        if (h < 0.6 || !isClear(x, z, 5)) continue;
        const rock = new THREE.Mesh(rockGeo, MAT.rock);
        rock.position.set(x, h - 0.4, z);
        rock.scale.set(1.6 + worldRng() * 4.4, 1.1 + worldRng() * 2.4, 1.5 + worldRng() * 3.6);
        rock.rotation.set(worldRng() * 0.5, worldRng() * Math.PI, worldRng() * 0.4);
        shadowify(rock);
        world.add(rock);
    }
}

/* ---- instanced grass + flowers with gentle wind ---- */
let windUniform = { value: 0 };
function patchWind(material, strength = 1) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uWind = windUniform;
        shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             #ifdef USE_INSTANCING
             float windPhase = instanceMatrix[3][0] * 0.21 + instanceMatrix[3][2] * 0.17;
             transformed.x += sin(uWind * 1.7 + windPhase) * ${strength.toFixed(2)} * transformed.y * 0.16;
             transformed.z += cos(uWind * 1.3 + windPhase) * ${strength.toFixed(2)} * transformed.y * 0.1;
             #endif`
        );
    };
}

bootStep('sowing meadows…');
{
    // grass: two crossed quads
    const blade = new THREE.PlaneGeometry(1.1, 2.1);
    blade.translate(0, 1.05, 0);
    const grassGeo = blade; // simple single quad, doubled by material side
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x67b04f, roughness: 0.9, side: THREE.DoubleSide });
    patchWind(grassMat, 1.0);
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, quality.grassCount);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const colorTint = new THREE.Color();
    let placedG = 0, triesG = 0;
    while (placedG < quality.grassCount && triesG < quality.grassCount * 14) {
        triesG++;
        const a = worldRng() * Math.PI * 2;
        const rr = Math.sqrt(worldRng()) * 0.9;
        const x = Math.cos(a) * ISLAND.rx * rr;
        const z = Math.sin(a) * ISLAND.rz * rr;
        const h = heightAt(x, z);
        if (h < 5.4 || h > 20 || slopeAt(x, z) > 0.5) continue;
        p.set(x, h - 0.12, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), worldRng() * Math.PI);
        const sc = 0.55 + worldRng() * 0.65;
        s.set(sc, sc * (0.8 + worldRng() * 0.55), sc);
        m.compose(p, q, s);
        grass.setMatrixAt(placedG, m);
        colorTint.setHSL(0.28 + worldRng() * 0.05, 0.5 + worldRng() * 0.2, 0.34 + worldRng() * 0.14);
        grass.setColorAt(placedG, colorTint);
        placedG++;
    }
    grass.count = placedG;
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    world.add(grass);

    // flowers
    const flowerGeo = new THREE.ConeGeometry(0.55, 1.0, 5);
    flowerGeo.translate(0, 1.7, 0);
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    patchWind(flowerMat, 0.7);
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, quality.flowerCount);
    const petal = new THREE.Color();
    const petals = [0xff8fb3, 0xffd166, 0xc792ff, 0xff7f7f, 0xfff4b8];
    let placedF = 0, triesF = 0;
    while (placedF < quality.flowerCount && triesF < quality.flowerCount * 16) {
        triesF++;
        const a = worldRng() * Math.PI * 2;
        const rr = Math.sqrt(worldRng()) * 0.85;
        const x = Math.cos(a) * ISLAND.rx * rr;
        const z = Math.sin(a) * ISLAND.rz * rr;
        const h = heightAt(x, z);
        if (h < 5.8 || h > 16 || slopeAt(x, z) > 0.42) continue;
        p.set(x, h - 0.1, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), worldRng() * Math.PI);
        const sc = 0.6 + worldRng() * 0.55;
        s.set(sc, sc, sc);
        m.compose(p, q, s);
        flowers.setMatrixAt(placedF, m);
        petal.set(petals[Math.floor(worldRng() * petals.length)]);
        flowers.setColorAt(placedF, petal);
        placedF++;
    }
    flowers.count = placedF;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    world.add(flowers);
}

/* ============================================================
   5. Camp props, resource nodes, building factories
   ============================================================ */
function placeOnGround(obj, x, z, lift = 0) {
    obj.position.set(x, heightAt(x, z) + lift, z);
    return obj;
}

function makeBubbleSprite(width = 30, height = 13) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 224;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, height, 1);
    sprite.userData = { canvas, texture, lastText: '', hideAt: 0 };
    sprite.visible = false;
    return sprite;
}

function paintBubble(sprite, text, style = 'thought') {
    const { canvas, texture } = sprite.userData;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isSay = style === 'say';
    ctx.fillStyle = isSay ? 'rgba(255,236,170,0.95)' : 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(12,35,42,0.5)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(16, 14, 480, 150, 42);
    ctx.fill(); ctx.stroke();
    // tail
    ctx.beginPath();
    if (isSay) {
        ctx.moveTo(96, 160); ctx.lineTo(72, 208); ctx.lineTo(140, 162);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
        ctx.arc(86, 184, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(64, 208, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(12,35,42,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // word-wrap up to 3 lines
    const words = String(text).split(/\s+/);
    let lines = [''];
    let fontSize = 40;
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
    for (const word of words) {
        const candidate = (lines[lines.length - 1] + ' ' + word).trim();
        if (ctx.measureText(candidate).width > 430 && lines[lines.length - 1] !== '') lines.push(word);
        else lines[lines.length - 1] = candidate;
    }
    if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] += '…'; }
    if (lines.length === 3) fontSize = 33;
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
    const lineH = fontSize * 1.16;
    const y0 = 89 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => ctx.fillText(line, 256, y0 + i * lineH));
    texture.needsUpdate = true;
}

function showBubble(sprite, text, style = 'thought', seconds = 5) {
    paintBubble(sprite, text, style);
    sprite.visible = true;
    sprite.userData.hideAt = performance.now() / 1000 + seconds;
}

/* ---- bonfire (with light) ---- */
function makeBonfire() {
    const fire = new THREE.Group();
    fire.name = 'camp-bonfire';
    for (let i = 0; i < 9; i++) {
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), MAT.rock);
        const a = (i / 9) * Math.PI * 2;
        stone.position.set(Math.cos(a) * 3.6, 0.4, Math.sin(a) * 3.6);
        stone.scale.set(1.25, 0.7, 1);
        fire.add(stone);
    }
    [[-1.7, 0.5], [1.7, -0.5], [0, 1.6]].forEach(([x, rot]) => {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 6, 7), MAT.trunk);
        log.position.set(x, 1.0, 0);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = rot;
        fire.add(log);
    });
    const ember = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 8), MAT.ember);
    ember.scale.y = 0.35; ember.position.y = 0.9;
    fire.add(ember);
    const flames = [];
    for (let i = 0; i < 3; i++) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(1.2 - i * 0.16, 4.6 - i * 0.7, 10), MAT.flame);
        flame.position.set((i - 1) * 0.8, 2.9 + i * 0.2, 0.3 * i);
        fire.add(flame);
        flames.push(flame);
    }
    const light = new THREE.PointLight(0xff9d4a, 0, 70, 1.8);
    light.position.y = 5;
    fire.add(light);
    fire.userData.flames = flames;
    fire.userData.light = light;
    shadowify(fire);
    return fire;
}

/* ---- the main hut ---- */
function makeHut() {
    const hut = new THREE.Group();
    hut.name = 'village-hut';
    const stiltH = 3.4;
    [[-7.5, -5], [7.5, -5], [-7.5, 5], [7.5, 5]].forEach(([x, z]) => {
        const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, stiltH + 2, 6), MAT.trunk);
        stilt.position.set(x, stiltH / 2 - 1, z);
        hut.add(stilt);
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(19, 1.2, 14), MAT.wood);
    floor.position.y = stiltH;
    hut.add(floor);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(15, 8.5, 11), MAT.wood);
    cabin.position.y = stiltH + 4.8;
    hut.add(cabin);
    // plank stripes
    for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(15.3, 0.34, 11.3), MAT.woodDark);
        stripe.position.y = stiltH + 2.4 + i * 2.4;
        hut.add(stripe);
    }
    // layered thatch roof
    for (let l = 0; l < 3; l++) {
        const roof = new THREE.Mesh(new THREE.ConeGeometry(12.5 - l * 2.6, 3.4, 4), l % 2 ? MAT.thatchDark : MAT.thatch);
        roof.position.y = stiltH + 9.8 + l * 2.1;
        roof.rotation.y = Math.PI / 4;
        roof.scale.z = 0.78;
        hut.add(roof);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.8, 0.5), MAT.dark);
    door.position.set(-2.4, stiltH + 3.6, 5.75);
    hut.add(door);
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.2), MAT.glow);
    doorGlow.name = 'hut-door-glow';
    doorGlow.position.set(-2.4, stiltH + 3.6, 6.05);
    hut.add(doorGlow);
    const windowM = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.6, 0.5), MAT.dark);
    windowM.position.set(4.0, stiltH + 5.4, 5.75);
    hut.add(windowM);
    const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), MAT.glow);
    winGlow.name = 'hut-window-glow';
    winGlow.position.set(4.0, stiltH + 5.4, 6.05);
    hut.add(winGlow);
    const steps = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.7, 5.5), MAT.woodDark);
    steps.position.set(-2.4, 1.2, 9.2);
    hut.add(steps);
    const lantern = new THREE.PointLight(0xffd07a, 0, 40, 1.9);
    lantern.name = 'hut-lantern';
    lantern.position.set(0, stiltH + 6, 7.5);
    hut.add(lantern);
    shadowify(hut);
    return hut;
}

function makeStorageCache() {
    const cache = new THREE.Group();
    cache.name = 'storage-cache';
    const base = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 9.2, 0.7, 14), MAT.woodDark);
    base.position.y = 0.35;
    cache.add(base);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(8.5, 3.4, 5.4), MAT.wood);
    crate.position.set(-2.4, 2.2, -2);
    cache.add(crate);
    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.6, 4.2), MAT.woodDark);
    crate2.position.set(3.8, 1.8, 1.6);
    crate2.rotation.y = 0.5;
    cache.add(crate2);
    const pileDefs = [
        ['food', MAT.berry, -5.6, 2.8, new THREE.SphereGeometry(0.7, 9, 7)],
        ['water', MAT.water, -2.2, 4.4, new THREE.CylinderGeometry(0.7, 0.85, 1.2, 10)],
        ['wood', MAT.trunk, 0.8, -5.6, new THREE.CylinderGeometry(0.36, 0.42, 3.4, 7)],
        ['fibre', MAT.reed, 5.4, -2.4, new THREE.CylinderGeometry(0.18, 0.22, 3.0, 6)],
        ['shells', MAT.shell, 6.4, 3.2, new THREE.SphereGeometry(0.6, 9, 6)],
        ['herbs', MAT.herb, 1.6, 5.6, new THREE.ConeGeometry(0.6, 1.8, 6)],
        ['rawFish', MAT.fish, -6.6, -1.4, new THREE.SphereGeometry(0.65, 9, 6)],
        ['cookedFish', MAT.ember, -3.8, -4.4, new THREE.SphereGeometry(0.65, 9, 6)],
        ['seeds', MAT.woodDark, 4.4, 5.8, new THREE.SphereGeometry(0.45, 8, 6)],
        ['stone', MAT.stone, 7.4, -0.2, new THREE.DodecahedronGeometry(0.7, 0)],
        ['metal', MAT.metal, -7.4, 1.2, new THREE.IcosahedronGeometry(0.6, 0)],
        ['cloth', MAT.cloth, 0.2, 6.8, new THREE.BoxGeometry(1.4, 0.5, 1.0)],
        ['research', MAT.research, -0.6, -6.8, new THREE.BoxGeometry(1.1, 0.3, 1.5)]
    ];
    cache.userData.piles = {};
    pileDefs.forEach(([key, mat, x, z, geometry]) => {
        const pile = new THREE.Group();
        pile.position.set(x, 0.8, z);
        for (let i = 0; i < 5; i++) {
            const item = new THREE.Mesh(geometry, mat);
            item.position.set((i % 3 - 1) * 0.85, Math.floor(i / 3) * 0.5, (Math.floor(i / 3) - 0.5) * 0.8);
            item.rotation.set(i * 0.4, i * 0.7, i * 0.21);
            if (key === 'wood' || key === 'fibre') item.rotation.z = Math.PI / 2 + i * 0.2;
            if (key === 'rawFish' || key === 'cookedFish') item.scale.set(1.5, 0.5, 0.6);
            pile.add(item);
        }
        cache.userData.piles[key] = pile;
        cache.add(pile);
    });
    shadowify(cache);
    return cache;
}

function makeWaterBarrel() {
    const barrel = new THREE.Group();
    barrel.name = 'rain-barrel';
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 5.4, 14), MAT.wood);
    body.position.y = 2.7;
    barrel.add(body);
    [1.4, 4.0].forEach((y) => {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.16, 6, 18), MAT.metal);
        hoop.rotation.x = Math.PI / 2;
        hoop.position.y = y;
        barrel.add(hoop);
    });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 14), MAT.water);
    top.position.y = 5.5;
    barrel.add(top);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.95, 9), MAT.cloth);
    cup.position.set(3.0, 4.6, 0.7);
    cup.rotation.z = 0.2;
    barrel.add(cup);
    shadowify(barrel);
    return barrel;
}

function makeKite() {
    const kite = new THREE.Group();
    kite.name = 'play-kite';
    const face = new THREE.Mesh(new THREE.PlaneGeometry(6, 7.5), new THREE.MeshBasicMaterial({ color: 0xffdc7c, side: THREE.DoubleSide }));
    face.rotation.z = Math.PI * 0.25;
    kite.add(face);
    const tail = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -4, 0), new THREE.Vector3(-2, -8, 0), new THREE.Vector3(1.4, -12, 0)
        ]),
        new THREE.LineBasicMaterial({ color: 0xf4ead0, transparent: true, opacity: 0.8 })
    );
    kite.add(tail);
    return kite;
}

function makeSleepMats() {
    const mats = new THREE.Group();
    mats.name = 'sleep-mats';
    for (let i = 0; i < 2; i++) {
        const base = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0xe6d39b, roughness: 0.92 }));
        base.position.set(i * 11, 0.3, i * 1.6);
        base.rotation.y = i * 0.3 - 0.15;
        mats.add(base);
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 4.0), MAT.cloth);
        pillow.position.set(i * 11 - 2.8, 0.95, i * 1.6);
        pillow.rotation.y = i * 0.3 - 0.15;
        mats.add(pillow);
    }
    shadowify(mats);
    return mats;
}

/* ---- buildable structures ---- */
function frameWith(fn) {
    const group = new THREE.Group();
    fn(group);
    return shadowify(group);
}

const buildFactories = {
    garden: () => frameWith((g) => {
        const bed = new THREE.Mesh(new THREE.BoxGeometry(11, 1.1, 7), MAT.soil);
        bed.position.y = 0.6; g.add(bed);
        const rim = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.6, 7.8), MAT.woodDark);
        rim.position.y = 0.95; g.add(rim);
        for (let i = 0; i < 6; i++) {
            const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.4, 6), MAT.crop);
            sprout.name = 'crop';
            sprout.position.set(-3.8 + (i % 3) * 3.8, 2.0, i < 3 ? -1.7 : 1.7);
            g.add(sprout);
        }
    }),
    farmPlot: () => frameWith((g) => {
        const plot = new THREE.Mesh(new THREE.BoxGeometry(20, 0.9, 13), MAT.soil);
        plot.position.y = 0.5; g.add(plot);
        for (let row = 0; row < 3; row++) {
            const ridge = new THREE.Mesh(new THREE.BoxGeometry(19, 0.5, 1.4), MAT.woodDark);
            ridge.position.set(0, 1.0, -4 + row * 4);
            g.add(ridge);
            for (let c = 0; c < 6; c++) {
                const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 6), MAT.crop);
                sprout.name = 'crop';
                sprout.position.set(-7.5 + c * 3, 1.9, -4 + row * 4);
                g.add(sprout);
            }
        }
        const scarecrow = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 6, 6), MAT.trunk);
        pole.position.y = 3; scarecrow.add(pole);
        const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 6), MAT.trunk);
        arms.rotation.z = Math.PI / 2; arms.position.y = 4.6; scarecrow.add(arms);
        const headS = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 7), MAT.thatch);
        headS.position.y = 6.2; scarecrow.add(headS);
        scarecrow.position.set(8.4, 0, 5.4);
        g.add(scarecrow);
    }),
    waterJar: () => frameWith((g) => {
        for (let i = 0; i < 3; i++) {
            const jar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 4.2, 12), new THREE.MeshStandardMaterial({ color: 0x63b7d7, roughness: 0.5 }));
            jar.position.set((i - 1) * 3.4, 2.1, Math.sin(i * 2) * 1.1);
            g.add(jar);
            const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 12), MAT.woodDark);
            lid.position.set((i - 1) * 3.4, 4.4, Math.sin(i * 2) * 1.1);
            g.add(lid);
        }
    }),
    well: () => frameWith((g) => {
        const ringW = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 2.6, 12), MAT.stone);
        ringW.position.y = 1.3; g.add(ringW);
        const waterTop = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.3, 12), MAT.water);
        waterTop.position.y = 2.3; g.add(waterTop);
        [[-2.6, 0], [2.6, 0]].forEach(([x]) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 6.4, 6), MAT.trunk);
            post.position.set(x, 4.2, 0); g.add(post);
        });
        const roofW = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.6, 4), MAT.thatch);
        roofW.position.y = 8.2; roofW.rotation.y = Math.PI / 4; g.add(roofW);
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 5.6, 6), MAT.trunk);
        axle.rotation.z = Math.PI / 2; axle.position.y = 6.2; g.add(axle);
        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 1.1, 8), MAT.woodDark);
        bucket.position.y = 3.6; g.add(bucket);
    }),
    shelter: () => frameWith((g) => {
        const base = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.2, 8), MAT.wood);
        base.position.y = 0.7; g.add(base);
        [[-4.4, -3.2], [4.4, -3.2], [-4.4, 3.2], [4.4, 3.2]].forEach(([x, z]) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 5.4, 6), MAT.trunk);
            post.position.set(x, 3.2, z); g.add(post);
        });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(8.4, 4.4, 4), MAT.thatch);
        roof.position.y = 7.6; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.8; g.add(roof);
        const mat = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.5, 4.2), new THREE.MeshStandardMaterial({ color: 0xe6d39b, roughness: 0.92 }));
        mat.position.y = 1.55; g.add(mat);
    }),
    guestCabin: () => frameWith((g) => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(13, 7.5, 10), MAT.wood);
        body.position.y = 4.2; g.add(body);
        for (let i = 0; i < 2; i++) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(13.3, 0.3, 10.3), MAT.woodDark);
            stripe.position.y = 2.6 + i * 2.6; g.add(stripe);
        }
        const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 5, 4), MAT.thatchDark);
        roof.position.y = 10.4; roof.rotation.y = Math.PI / 4; g.add(roof);
        const door = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.4), MAT.dark);
        door.position.set(0, 3, 5.2); g.add(door);
        const winA = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 0.4), MAT.dark);
        winA.position.set(-4, 5, 5.2); g.add(winA);
        const lantern = new THREE.PointLight(0xffd07a, 0, 30, 2);
        lantern.name = 'cabin-lantern';
        lantern.position.set(0, 6.5, 6); g.add(lantern);
    }),
    socialBench: () => frameWith((g) => {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(10, 0.9, 2.8), MAT.wood);
        seat.position.y = 2.6; g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(10, 2.6, 0.6), MAT.wood);
        back.position.set(0, 4.2, -1.2); back.rotation.x = -0.16; g.add(back);
        [-3.8, 3.8].forEach((x) => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 2.6), MAT.woodDark);
            leg.position.set(x, 1.3, 0); g.add(leg);
        });
    }),
    firePit: () => {
        const pit = makeBonfire();
        pit.scale.setScalar(0.85);
        return pit;
    },
    workshop: () => frameWith((g) => {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 11), MAT.stone);
        slab.position.y = 0.5; g.add(slab);
        const bench = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 5), MAT.wood);
        bench.position.set(0, 2.6, -1.6); g.add(bench);
        [[-7, -4.6], [7, -4.6]].forEach(([x, z]) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 7.2, 6), MAT.trunk);
            post.position.set(x, 4.1, z); g.add(post);
        });
        const awning = new THREE.Mesh(new THREE.BoxGeometry(17, 0.4, 7), MAT.cloth);
        awning.position.set(0, 7.6, -2.4); awning.rotation.x = 0.18; g.add(awning);
        for (let i = 0; i < 4; i++) {
            const tool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.4, 6), MAT.metal);
            tool.position.set(-4.5 + i * 3, 4.1, -1.4);
            tool.rotation.z = Math.PI / 2 + i * 0.2;
            g.add(tool);
        }
        const anvil = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 1.4), MAT.metal);
        anvil.position.set(4.5, 1.8, 2.8); g.add(anvil);
    }),
    researchDesk: () => frameWith((g) => {
        const desk = new THREE.Mesh(new THREE.BoxGeometry(12, 1.0, 7), MAT.wood);
        desk.position.y = 2.8; g.add(desk);
        [[-5, -2.6], [5, -2.6], [-5, 2.6], [5, 2.6]].forEach(([x, z]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 2.8, 6), MAT.woodDark);
            leg.position.set(x, 1.4, z); g.add(leg);
        });
        const map = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.8), MAT.research);
        map.name = 'research-map';
        map.rotation.x = -Math.PI / 2; map.position.y = 3.42; g.add(map);
        const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 8), MAT.cloth);
        scroll.rotation.z = Math.PI / 2; scroll.position.set(3.8, 3.6, 2.2); g.add(scroll);
    }),
    dock: () => frameWith((g) => {
        for (let i = 0; i < 8; i++) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.6, 4.4), MAT.wood);
            plank.position.set(0, 0.4 - i * 0.05, -i * 4.6);
            g.add(plank);
        }
        [-2.8, 2.8].forEach((x) => {
            for (let i = 0; i < 5; i++) {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 7, 6), MAT.trunk);
                post.position.set(x, -2.6, -i * 8);
                g.add(post);
            }
        });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 7), MAT.glow);
        lamp.position.set(2.6, 3.4, -33);
        g.add(lamp);
        const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 3.4, 6), MAT.trunk);
        lampPost.position.set(2.6, 1.6, -33);
        g.add(lampPost);
    }),
    windmill: () => frameWith((g) => {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.8, 17, 9), MAT.wood);
        tower.position.y = 8.5; g.add(tower);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 9), MAT.thatchDark);
        cap.position.y = 18.2; g.add(cap);
        const hub = new THREE.Group();
        hub.name = 'windmill-hub';
        hub.position.set(0, 17, 2.6);
        for (let i = 0; i < 4; i++) {
            const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 10.5), MAT.cloth);
            blade.position.set(Math.cos(i * Math.PI / 2) * 5.5, Math.sin(i * Math.PI / 2) * 5.5, 0);
            blade.rotation.z = i * Math.PI / 2;
            hub.add(blade);
        }
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 7), MAT.metal);
        hub.add(nose);
        g.add(hub);
    }),
    watchtower: () => frameWith((g) => {
        [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]].forEach(([x, z]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 13, 6), MAT.trunk);
            leg.position.set(x * 1.15, 6.5, z * 1.15);
            leg.rotation.x = z > 0 ? -0.06 : 0.06;
            leg.rotation.z = x > 0 ? 0.06 : -0.06;
            g.add(leg);
        });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.8, 8.4), MAT.wood);
        deck.position.y = 13.2; g.add(deck);
        for (let s = 0; s < 4; s++) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(s % 2 ? 0.4 : 8.4, 1.8, s % 2 ? 8.4 : 0.4), MAT.woodDark);
            rail.position.set(s === 1 ? 4 : s === 3 ? -4 : 0, 14.6, s === 0 ? 4 : s === 2 ? -4 : 0);
            g.add(rail);
        }
        const roofT = new THREE.Mesh(new THREE.ConeGeometry(6.8, 3.4, 4), MAT.thatch);
        roofT.position.y = 18; roofT.rotation.y = Math.PI / 4; g.add(roofT);
        const ladder = new THREE.Group();
        for (let r = 0; r < 6; r++) {
            const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 5), MAT.trunk);
            rung.rotation.z = Math.PI / 2;
            rung.position.set(0, 1.5 + r * 2.1, 0);
            ladder.add(rung);
        }
        ladder.position.set(0, 0, 4.9);
        g.add(ladder);
    }),
    flowerGarden: () => frameWith((g) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.5, 6, 20), MAT.stone);
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.4; g.add(ring);
        const petals = [0xff8fb3, 0xffd166, 0xc792ff, 0xff7f7f];
        for (let i = 0; i < 12; i++) {
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.8, 5), MAT.herb);
            const a = (i / 12) * Math.PI * 2;
            const r = 1.2 + (i % 3) * 1.3;
            stem.position.set(Math.cos(a) * r, 1.1, Math.sin(a) * r);
            g.add(stem);
            const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshStandardMaterial({ color: petals[i % petals.length], roughness: 0.6 }));
            bloom.position.set(Math.cos(a) * r, 2.2, Math.sin(a) * r);
            g.add(bloom);
        }
    })
};

/* ============================================================
   6. Characters
   ============================================================ */
function makeCharacter(profile) {
    const person = new THREE.Group();
    person.name = `resident-${profile.id}`;
    const bodyMat = new THREE.MeshStandardMaterial({ color: profile.color, roughness: 0.8 });
    const accentMat = new THREE.MeshStandardMaterial({ color: profile.accent, roughness: 0.74 });
    const skinMat = new THREE.MeshStandardMaterial({ color: profile.skin || 0xc08457, roughness: 0.8 });

    // legs (pivot at hip)
    const limbs = { legs: [], arms: [] };
    [[-0.62], [0.62]].forEach(([x]) => {
        const hip = new THREE.Group();
        hip.position.set(x, 2.5, 0);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 2.5, 7), skinMat);
        leg.position.y = -1.25;
        hip.add(leg);
        person.add(hip);
        limbs.legs.push(hip);
    });
    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 2.2, 4, 10), bodyMat);
    torso.position.y = 4.5;
    person.add(torso);
    // sash
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.36, 0.55, 10), accentMat);
    sash.position.y = 3.7;
    person.add(sash);
    // arms (pivot at shoulder)
    [[-1.55, 0.18], [1.55, -0.18]].forEach(([x, rz]) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(x, 5.5, 0);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 2.6, 7), skinMat);
        arm.position.y = -1.3;
        shoulder.add(arm);
        shoulder.rotation.z = rz;
        person.add(shoulder);
        limbs.arms.push(shoulder);
    });
    // head + face
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 12), skinMat);
    head.position.y = 7.6;
    person.add(head);
    [[-0.5], [0.5]].forEach(([x]) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), MAT.dark);
        eye.position.set(x, 7.78, 1.18);
        person.add(eye);
    });
    // hat
    const hat = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.35, 14), accentMat);
    hat.position.y = 8.85;
    person.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.22, 16), accentMat);
    brim.position.y = 8.35;
    person.add(brim);
    // carried bundle (visible while hauling)
    const bundle = new THREE.Mesh(new THREE.SphereGeometry(0.85, 9, 7), accentMat);
    bundle.name = 'carried-bundle';
    bundle.scale.set(1.25, 0.85, 1.0);
    bundle.position.set(1.9, 4.2, 0.6);
    bundle.visible = false;
    person.add(bundle);
    // soft fake shadow blob (helps on mobile where shadows are off)
    if (!quality.shadows) {
        const blob = new THREE.Mesh(
            new THREE.CircleGeometry(2.1, 18),
            new THREE.MeshBasicMaterial({ color: 0x1f241e, transparent: true, opacity: 0.22, depthWrite: false })
        );
        blob.rotation.x = -Math.PI / 2;
        blob.position.y = 0.09;
        person.add(blob);
    }
    const bubble = makeBubbleSprite(26, 11.5);
    bubble.position.set(0, 13.2, 0);
    person.add(bubble);
    person.userData.bubble = bubble;
    person.userData.limbs = limbs;
    person.userData.bundle = bundle;
    shadowify(person);
    return person;
}

/* ============================================================
   7. World layout — village, props, resource nodes
   ============================================================ */
bootStep('building the village…');
const props = {};
function placeProp(maker, x, z, rotY = 0, lift = 0) {
    const obj = maker();
    placeOnGround(obj, x, z, lift);
    obj.rotation.y = rotY;
    world.add(obj);
    reserve(x, z, 9);
    return obj;
}

props.hut = placeProp(makeHut, 16, 4, -0.3);
props.bonfire = placeProp(makeBonfire, -4, 26, 0);
props.cache = placeProp(makeStorageCache, 9, 18, 0.2);
props.barrel = placeProp(makeWaterBarrel, 25, 22, 0);
props.sleepMats = placeProp(makeSleepMats, 27, -8, -0.3);
props.kite = placeProp(makeKite, -34, -16, 0, 16);

const flagPole = new THREE.Group();
{
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 16, 7), MAT.trunk);
    pole.position.y = 8;
    flagPole.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.2), new THREE.MeshStandardMaterial({ color: 0xfff4b8, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.name = 'colony-flag';
    flag.position.set(2.8, 14, 0);
    flagPole.add(flag);
    shadowify(flagPole);
    placeOnGround(flagPole, -12, 8);
    world.add(flagPole);
}

/* ---- resource nodes ---- */
const resourceNodes = [];
function addResourceNode(key, label, x, z, builder) {
    const group = new THREE.Group();
    group.name = `node-${key}`;
    builder(group);
    placeOnGround(group, x, z);
    world.add(group);
    shadowify(group);
    reserve(x, z, 7);
    resourceNodes.push({ key, label, x, z, mesh: group });
    return group;
}

bootStep('scattering wild resources…');
// berry bushes (food)
[[-52, -16], [-44, -28], [-60, -2]].forEach(([x, z], i) => addResourceNode('food', 'berry thicket', x, z, (g) => {
    for (let b = 0; b < 2 + (i % 2); b++) {
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 + (b % 2), 1), MAT.leaf);
        leaves.position.set(b * 3.2 - 2, 1.9, (b % 2) * 2.4 - 1);
        leaves.scale.y = 0.75;
        g.add(leaves);
        for (let k = 0; k < 5; k++) {
            const berry = new THREE.Mesh(new THREE.SphereGeometry(0.34, 7, 6), MAT.berry);
            berry.position.set(b * 3.2 - 2 + Math.cos(k * 1.7) * 2.0, 1.8 + (k % 2) * 0.9, (b % 2) * 2.4 - 1 + Math.sin(k * 1.7) * 1.6);
            g.add(berry);
        }
    }
}));
// freshwater spring (water) — mossy pool below the peak
[[-34, -44]].forEach(([x, z]) => addResourceNode('water', 'freshwater spring', x, z, (g) => {
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 0.6, 14), MAT.water);
    pool.position.y = 0.25;
    g.add(pool);
    for (let k = 0; k < 5; k++) {
        const stoneS = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), MAT.rock);
        stoneS.position.set(Math.cos(k * 1.26) * 4.2, 0.5, Math.sin(k * 1.26) * 4.0);
        stoneS.scale.set(1.3, 0.8, 1.1);
        g.add(stoneS);
    }
    const mist = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.3, depthWrite: false }));
    mist.position.y = 1.2;
    g.add(mist);
}));
// driftwood (wood) — south beach
[[18, 134], [44, 126], [-12, 138]].forEach(([x, z], i) => addResourceNode('wood', 'driftwood beach', x, z, (g) => {
    for (let l = 0; l < 3; l++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.85, 8 + l, 7), MAT.trunkLight);
        log.position.set(l * 2.4 - 2, 0.7, l * 1.8 - 1.5);
        log.rotation.set(Math.PI / 2, i + l * 0.5, l * 0.6);
        g.add(log);
    }
}));
// reeds (fibre) — east shore
[[171, 25], [163, 46]].forEach(([x, z]) => addResourceNode('fibre', 'reed beds', x, z, (g) => {
    for (let i = 0; i < 11; i++) {
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 5 + (i % 3) * 1.4, 5), MAT.reed);
        reed.position.set((i % 4 - 1.5) * 1.5, 2.8, Math.floor(i / 4) * 1.7 - 1.5);
        reed.rotation.z = (i - 5) * 0.03;
        g.add(reed);
    }
}));
// tide pools (shells) — west shore
[[-164, 44], [-156, 68]].forEach(([x, z], i) => addResourceNode('shells', 'tide pools', x, z, (g) => {
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 0.5, 12), MAT.water);
    pool.position.y = 0.2;
    g.add(pool);
    for (let k = 0; k < 5; k++) {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 9, 6), MAT.shell);
        shell.position.set(Math.cos(k * 1.3 + i) * 3.6, 0.5, Math.sin(k * 1.3 + i) * 3.4);
        shell.scale.set(1.2, 0.34, 0.85);
        shell.rotation.y = k;
        g.add(shell);
    }
}));
// herbs + seeds — inland meadow
[[36, -52], [52, -42]].forEach(([x, z]) => addResourceNode('herbs', 'herb meadow', x, z, (g) => {
    for (let i = 0; i < 6; i++) {
        const herb = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.6, 6), MAT.herb);
        herb.position.set(Math.cos(i * 1.05) * 2.8, 1.3, Math.sin(i * 1.05) * 2.6);
        herb.rotation.z = (i - 3) * 0.1;
        g.add(herb);
    }
}));
[[-20, -95]].forEach(([x, z]) => addResourceNode('seeds', 'seed terrace', x, z, (g) => {
    for (let i = 0; i < 4; i++) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 3.4, 5), MAT.crop);
        stalk.position.set(i * 1.6 - 2.4, 1.7, (i % 2) * 1.8 - 0.9);
        g.add(stalk);
        const headSeed = new THREE.Mesh(new THREE.SphereGeometry(0.55, 7, 6), MAT.thatch);
        headSeed.position.set(i * 1.6 - 2.4, 3.6, (i % 2) * 1.8 - 0.9);
        g.add(headSeed);
    }
}));
// stone + metal — NE quarry
[[96, -88], [112, -70]].forEach(([x, z], i) => addResourceNode('stone', 'stone quarry', x, z, (g) => {
    for (let k = 0; k < 3; k++) {
        const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7 + k * 0.5, 0), MAT.stone);
        boulder.position.set(k * 2.6 - 2.4, 1.1 + k * 0.3, (k % 2) * 2 - 1);
        boulder.rotation.set(k * 0.6 + i, k, 0.3);
        g.add(boulder);
    }
}));
[[124, -52]].forEach(([x, z]) => addResourceNode('metal', 'metal scrap', x, z, (g) => {
    for (let k = 0; k < 3; k++) {
        const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), MAT.metal);
        ore.position.set(k * 2.2 - 2, 0.8, (k % 2) * 1.8 - 0.9);
        ore.rotation.y = k * 1.2;
        g.add(ore);
    }
}));
// cloth drying green — west meadow
[[-118, 28]].forEach(([x, z]) => addResourceNode('cloth', 'cloth drying green', x, z, (g) => {
    [[-4, 0], [4, 0]].forEach(([px]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 5.4, 6), MAT.trunk);
        post.position.set(px, 2.7, 0);
        g.add(post);
    });
    const lineC = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 8, 4), MAT.dark);
    lineC.rotation.z = Math.PI / 2;
    lineC.position.y = 4.9;
    g.add(lineC);
    for (let i = 0; i < 3; i++) {
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), MAT.cloth);
        sheet.name = 'drying-sheet';
        sheet.position.set(i * 2.6 - 2.6, 3.6, 0);
        g.add(sheet);
    }
}));
// fishing rocks — north + south shore
[[-26, -136], [54, 132]].forEach(([x, z], i) => addResourceNode('rawFish', i ? 'south fishing rocks' : 'north fishing rocks', x, z, (g) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), MAT.rock);
    rock.scale.set(1.6, 0.8, 1.3);
    rock.position.y = 0.7;
    g.add(rock);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9, 6), MAT.trunk);
    rod.position.set(1.8, 3.4, 0);
    rod.rotation.z = -0.6;
    g.add(rod);
}));

/* ---- ambient creatures ---- */
const gulls = [];
{
    const gullMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < (isMobile ? 2 : 4); i++) {
        const gull = new THREE.Group();
        const bodyG = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), gullMat);
        bodyG.scale.set(1.5, 0.6, 0.7);
        gull.add(bodyG);
        [[-1, 1], [1, -1]].forEach(([sx]) => {
            const wing = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.2), new THREE.MeshBasicMaterial({ color: 0xf0f4f8, side: THREE.DoubleSide }));
            wing.position.x = sx * 1.9;
            wing.name = sx > 0 ? 'wing-r' : 'wing-l';
            gull.add(wing);
        });
        gull.userData = { angle: worldRng() * Math.PI * 2, radius: 120 + worldRng() * 120, height: 50 + worldRng() * 36, speed: 0.1 + worldRng() * 0.08 };
        scene.add(gull);
        gulls.push(gull);
    }
}
const butterflies = [];
{
    const colors = [0xffb3d9, 0xfff066, 0xa3d9ff];
    for (let i = 0; i < (isMobile ? 3 : 7); i++) {
        const fly = new THREE.Group();
        [[-1], [1]].forEach(([sx]) => {
            const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
            wing.position.x = sx * 0.5;
            wing.name = sx > 0 ? 'wing-r' : 'wing-l';
            fly.add(wing);
        });
        const cx = (worldRng() - 0.5) * 160, cz = (worldRng() - 0.5) * 130;
        fly.userData = { cx, cz, phase: worldRng() * 9, speed: 0.5 + worldRng() * 0.5 };
        scene.add(fly);
        butterflies.push(fly);
    }
}

// rain particles (hidden until a rain event)
const rain = (() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(quality.rainCount * 3);
    for (let i = 0; i < quality.rainCount; i++) {
        positions[i * 3] = (worldRng() - 0.5) * 560;
        positions[i * 3 + 1] = worldRng() * 200 + 20;
        positions[i * 3 + 2] = (worldRng() - 0.5) * 470;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xbcd8ee, size: 1.6, transparent: true, opacity: 0.55, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    scene.add(points);
    return points;
})();

/* ============================================================
   8. Simulation — profiles, needs, traits, storage
   ============================================================ */
const needDefs = [
    { key: 'hunger', label: 'Hungry', ratePerHour: 6.2 },
    { key: 'thirst', label: 'Thirsty', ratePerHour: 7.6 },
    { key: 'tiredness', label: 'Tired', ratePerHour: 4.6 },
    { key: 'boredom', label: 'Bored', ratePerHour: 5.4 },
    { key: 'social', label: 'Lonely', ratePerHour: 4.2 },
    { key: 'comfort', label: 'Uncomfy', ratePerHour: 2.6 },
    { key: 'curiosity', label: 'Curious', ratePerHour: 3.8 }
];
const needLabels = Object.fromEntries(needDefs.map((n) => [n.key, n.label]));
const traitDefs = [
    { key: 'ambition', label: 'Ambitious' }, { key: 'irritability', label: 'Irritable' },
    { key: 'wanderlust', label: 'Explorer' }, { key: 'insecurity', label: 'Insecure' },
    { key: 'curiosity', label: 'Curious' }, { key: 'patience', label: 'Patient' },
    { key: 'sociability', label: 'Sociable' }, { key: 'confidence', label: 'Confident' },
    { key: 'caution', label: 'Cautious' }, { key: 'diligence', label: 'Diligent' },
    { key: 'playfulness', label: 'Playful' }, { key: 'kindness', label: 'Kind' },
    { key: 'resilience', label: 'Resilient' }, { key: 'imagination', label: 'Imaginative' }
];
const storageKeys = ['food', 'water', 'wood', 'fibre', 'shells', 'herbs', 'rawFish', 'cookedFish', 'seeds', 'stone', 'metal', 'cloth', 'research'];
const storageLabels = { food: 'Food', water: 'Water', wood: 'Wood', fibre: 'Fibre', shells: 'Shells', herbs: 'Herbs', rawFish: 'Fish', cookedFish: 'Cooked', seeds: 'Seeds', stone: 'Stone', metal: 'Metal', cloth: 'Cloth', research: 'Research' };
const storageGoals = { food: 18, water: 18, wood: 18, fibre: 14, shells: 8, herbs: 8, rawFish: 8, cookedFish: 8, seeds: 10, stone: 12, metal: 6, cloth: 6, research: 10 };
const communityStorage = { food: 7, water: 7, wood: 10, fibre: 7, shells: 4, herbs: 2, rawFish: 2, cookedFish: 2, seeds: 7, stone: 6, metal: 3, cloth: 3, research: 1 };

const PROFILES = [
    {
        id: 'laj', name: 'Little Laj', archetype: 'curious mapper', color: 0xe6f0d1, accent: 0xffdc7c, skin: 0xc08457,
        ocean: { openness: 90, conscientiousness: 67, extraversion: 50, agreeableness: 78, emotionalSensitivity: 38 },
        traits: { curiosity: 91, wanderlust: 86, imagination: 83, kindness: 78, diligence: 70, sociability: 54, ambition: 66, patience: 60, confidence: 58, caution: 40, playfulness: 62, resilience: 64, irritability: 22, insecurity: 30 },
        voice: 'wonder-filled, asks little questions, loves maps and edges of things',
        thought: 'I want to learn the shape of this island and keep everyone fed.'
    },
    {
        id: 'mina', name: 'Mina Reed', archetype: 'patient camp keeper', color: 0x9ed7c2, accent: 0x6c8f52, skin: 0xa9764e,
        ocean: { openness: 62, conscientiousness: 91, extraversion: 38, agreeableness: 86, emotionalSensitivity: 30 },
        traits: { diligence: 93, patience: 88, caution: 74, kindness: 86, resilience: 78, curiosity: 54, wanderlust: 42, ambition: 52, sociability: 44, confidence: 60, playfulness: 36, imagination: 48, irritability: 18, insecurity: 26 },
        voice: 'calm, practical, speaks in short tidy sentences about stores and order',
        thought: 'A tidy cache gives the whole camp room to breathe.'
    },
    {
        id: 'tao', name: 'Tao Shell', archetype: 'social beachcomber', color: 0xf1c08f, accent: 0x70b7ff, skin: 0xb87952,
        ocean: { openness: 76, conscientiousness: 52, extraversion: 88, agreeableness: 82, emotionalSensitivity: 46 },
        traits: { sociability: 92, playfulness: 84, kindness: 81, confidence: 72, curiosity: 74, diligence: 45, caution: 38, wanderlust: 66, ambition: 44, patience: 50, imagination: 70, resilience: 60, irritability: 28, insecurity: 34 },
        voice: 'warm and chatty, always inviting someone along, jokes gently',
        thought: 'People work better after a story, a laugh, and a useful shell.'
    },
    {
        id: 'niko', name: 'Niko Vale', archetype: 'inventive workshop builder', color: 0xc9d8ff, accent: 0xff9f6e, skin: 0x9c6a44,
        ocean: { openness: 84, conscientiousness: 83, extraversion: 44, agreeableness: 70, emotionalSensitivity: 36 },
        traits: { diligence: 88, imagination: 91, ambition: 82, curiosity: 86, patience: 64, confidence: 61, sociability: 40, wanderlust: 48, caution: 52, kindness: 62, playfulness: 44, resilience: 70, irritability: 30, insecurity: 28 },
        voice: 'thinks out loud about mechanisms and improvements, slightly impatient to build',
        thought: 'If we make a proper workshop, the island becomes a machine for comfort.'
    },
    {
        id: 'sora', name: 'Sora Fern', archetype: 'kind farmer and herbalist', color: 0xb8efac, accent: 0xf8d36a, skin: 0xc89066,
        ocean: { openness: 74, conscientiousness: 78, extraversion: 58, agreeableness: 93, emotionalSensitivity: 48 },
        traits: { kindness: 95, patience: 84, diligence: 77, curiosity: 71, resilience: 82, sociability: 63, wanderlust: 40, ambition: 38, caution: 56, confidence: 52, playfulness: 50, imagination: 60, irritability: 14, insecurity: 32 },
        voice: 'gentle and nurturing, notices how others are feeling, talks to plants',
        thought: 'A garden is just care made visible.'
    },
    {
        id: 'pip', name: 'Pip Current', archetype: 'playful fisher and runner', color: 0xffd8c2, accent: 0x73d7ff, skin: 0xd09a6a,
        ocean: { openness: 80, conscientiousness: 46, extraversion: 86, agreeableness: 74, emotionalSensitivity: 40 },
        traits: { playfulness: 94, wanderlust: 88, confidence: 78, sociability: 76, curiosity: 80, resilience: 67, diligence: 40, kindness: 66, patience: 34, ambition: 42, caution: 26, imagination: 64, irritability: 26, insecurity: 24 },
        voice: 'fast, breathless, makes everything a race or a game',
        thought: 'The island feels bigger if you run to the far beaches before breakfast.'
    },
    {
        id: 'maru', name: 'Maru Ash', archetype: 'gentle elder storyteller', color: 0xd9c8f0, accent: 0xe88a6a, skin: 0x8a5a3c,
        ocean: { openness: 88, conscientiousness: 60, extraversion: 55, agreeableness: 84, emotionalSensitivity: 52 },
        traits: { imagination: 92, patience: 90, kindness: 84, sociability: 70, curiosity: 76, wanderlust: 30, diligence: 50, ambition: 24, caution: 60, confidence: 66, playfulness: 56, resilience: 74, irritability: 16, insecurity: 20 },
        voice: 'slow, story-shaped sentences, remembers how things used to be, warm humour',
        thought: 'Every fire deserves at least one story before it sleeps.'
    }
];
const ARRIVAL_POOL = [
    {
        id: 'iris', name: 'Iris Gale', archetype: 'sharp-eyed botanist', color: 0xa6e6e0, accent: 0xff9fc7, skin: 0xb37b50,
        ocean: { openness: 92, conscientiousness: 74, extraversion: 42, agreeableness: 68, emotionalSensitivity: 44 },
        traits: { curiosity: 94, imagination: 80, diligence: 72, patience: 70, kindness: 64, caution: 58, wanderlust: 62, sociability: 38, ambition: 56, confidence: 54, playfulness: 40, resilience: 66, irritability: 32, insecurity: 30 },
        voice: 'precise, latin plant names, secretly delighted by everything green',
        thought: 'Every leaf on this island is a letter I have not read yet.'
    },
    {
        id: 'bo', name: 'Bo Ember', archetype: 'big-hearted cook', color: 0xffc9a3, accent: 0xc4534a, skin: 0x9c6a44,
        ocean: { openness: 64, conscientiousness: 70, extraversion: 78, agreeableness: 88, emotionalSensitivity: 42 },
        traits: { kindness: 90, sociability: 82, playfulness: 70, diligence: 68, patience: 62, resilience: 76, curiosity: 58, imagination: 66, ambition: 36, caution: 44, confidence: 64, wanderlust: 34, irritability: 22, insecurity: 26 },
        voice: 'loud, generous, measures affection in second helpings',
        thought: 'Nobody is sad after a properly cooked fish. That is science.'
    }
];

function settleNeeds(needs) {
    let topKey = needDefs[0].key, topVal = -1;
    for (const def of needDefs) {
        if (needs[def.key] > topVal) { topVal = needs[def.key]; topKey = def.key; }
    }
    needs.topNeed = topKey;
    needs.topNeedValue = topVal;
    needs.mood = topVal >= 82 ? 'needs help now' : topVal >= 62 ? 'uncomfortable' : topVal >= 38 ? 'grumbling' : 'content';
    return needs;
}
function makeNeeds(seed = 0) {
    const n = {};
    needDefs.forEach((def, i) => { n[def.key] = 8 + ((seed * 7 + i * 5) % 17); });
    return settleNeeds(n);
}
function advanceNeeds(needs, gameHours) {
    for (const def of needDefs) {
        needs[def.key] = clamp(needs[def.key] + def.ratePerHour * gameHours, 0, 100);
    }
    return settleNeeds(needs);
}
function easeNeed(needs, key, amount) {
    if (needs[key] === undefined) return needs;
    needs[key] = clamp(needs[key] - amount, 0, 100);
    return settleNeeds(needs);
}
function traitOf(profile, key) {
    if (profile.ocean && profile.ocean[key] !== undefined) return profile.ocean[key];
    return profile.traits[key] ?? 50;
}
function topTraits(profile, count = 4) {
    return traitDefs
        .map((t) => ({ ...t, value: profile.traits[t.key] ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, count);
}

/* ============================================================
   9. Residents — spawn, destinations, jobs, social life
   ============================================================ */
const villageCenter = { x: 2, z: 18 };
const residents = [];
const sleepSpots = [
    { x: 16, z: 12, label: 'the big hut' },
    { x: 27, z: -8, label: 'the sleep mats' },
    { x: 31, z: -10, label: 'the sleep mats' }
];
const socialSpots = [
    { x: -4, z: 26, label: 'the bonfire' }
];
const waterSpots = [{ x: 25, z: 22, label: 'the rain barrel' }];
const playSpots = [{ x: -34, z: -16, label: 'the kite meadow' }];
const researchSpots = [];
const craftSpots = [];

function spawnResident(profile, x, z) {
    const mesh = makeCharacter(profile);
    const h = heightAt(x, z);
    mesh.position.set(x, h, z);
    world.add(mesh);
    const resident = {
        profile,
        mesh,
        needs: makeNeeds(residents.length),
        inventory: { carry: null, amount: 0 },
        relationships: {},
        memories: [],
        currentThought: profile.thought,
        lastSay: '',
        ai: {
            state: 'thinking',           // thinking | walking | acting | sleeping
            timer: 0.5 + residents.length * 0.4,
            plan: null,
            speed: 11 + worldRng() * 2.5,
            bias: null,                  // {goal, expiresAt} set by LLM brain
            walkPhase: worldRng() * 6
        }
    };
    residents.forEach((other) => {
        resident.relationships[other.profile.name] = 50;
        other.relationships[profile.name] = 50;
    });
    residents.push(resident);
    return resident;
}

/* dynamic destination helpers */
function nearestNode(resourceKey, fromX, fromZ) {
    let best = null, bestD = Infinity;
    for (const node of resourceNodes) {
        if (node.key !== resourceKey) continue;
        const d = Math.hypot(node.x - fromX, node.z - fromZ);
        if (d < bestD) { bestD = d; best = node; }
    }
    return best;
}
function nearestSpot(list, fromX, fromZ) {
    let best = list[0], bestD = Infinity;
    for (const spot of list) {
        const d = Math.hypot(spot.x - fromX, spot.z - fromZ);
        if (d < bestD) { bestD = d; best = spot; }
    }
    return best;
}

const resourceFlavor = {
    food: { action: 'gathering berries', thought: 'A full food store makes the whole camp calmer.', trait: 'diligence' },
    water: { action: 'collecting fresh water', thought: 'Clean water first, adventures second.', trait: 'caution' },
    wood: { action: 'hauling driftwood', thought: 'Useful wood turns ideas into shelter.', trait: 'diligence' },
    fibre: { action: 'cutting reeds for fibre', thought: 'Fibre becomes rope, mats, repairs, possibility.', trait: 'diligence' },
    shells: { action: 'combing the tide pools for shells', thought: 'Some things are useful because they make people smile.', trait: 'curiosity' },
    herbs: { action: 'picking calming herbs', thought: 'The island has gentle remedies if I pay attention.', trait: 'kindness' },
    seeds: { action: 'saving seeds from the wild stalks', thought: 'Seeds are tiny plans.', trait: 'ambition' },
    rawFish: { action: 'fishing from the rocks', thought: 'The sea can feed us if we are patient.', trait: 'patience' },
    stone: { action: 'collecting building stone', thought: 'Stone makes the island feel permanent.', trait: 'diligence' },
    metal: { action: 'sorting washed-up metal', thought: 'Little metal pieces become clever tools.', trait: 'curiosity' },
    cloth: { action: 'bringing in dried cloth', thought: 'Dry cloth means beds, shade, better mornings.', trait: 'kindness' },
    research: { action: 'sketching colony ideas', thought: 'A good idea is a tool nobody has to carry.', trait: 'imagination' }
};

const personalityActivities = [
    { id: 'explore-shore', trait: 'wanderlust', action: 'exploring a far beach', thought: 'I want to know what the far side of the island sounds like.', duration: 6, boredom: 14, curiosity: 12, where: () => randomShorePoint() },
    { id: 'climb-lookout', trait: 'confidence', action: 'climbing to the lookout', thought: 'From up there the whole colony looks like a story being written.', duration: 6, boredom: 9, curiosity: 10, where: () => ({ x: -70, z: -62 }) },
    { id: 'watch-fish', trait: 'curiosity', action: 'watching the fish patterns', thought: 'The fish move like there is a secret map in the water.', duration: 5, boredom: 9, curiosity: 14, where: () => ({ x: -30, z: -150 }) },
    { id: 'fly-kite', trait: 'playfulness', action: 'flying the kite', thought: 'If I get the angle right, it dances properly.', duration: 4, boredom: 18, where: () => nearestSpot(playSpots, 0, 0) },
    { id: 'tell-story', trait: 'imagination', action: 'telling a story by the fire', thought: 'Every fire deserves at least one story.', duration: 5, boredom: 12, social: 10, where: () => nearestSpot(socialSpots, 0, 0) },
    { id: 'tend-flowers', trait: 'kindness', action: 'tending the wildflowers', thought: 'Small bright things matter on big quiet islands.', duration: 4, boredom: 8, comfort: 8, where: () => ({ x: 36, z: -52 }) },
    { id: 'tidy-camp', trait: 'diligence', action: 'tidying the camp', thought: 'Good order makes tomorrow easier.', duration: 4, boredom: 6, comfort: 8, where: () => ({ x: 9, z: 18 }) },
    { id: 'quiet-breathing', trait: 'patience', action: 'breathing quietly by the shore', thought: 'The sea is loud, but I can be quiet inside it.', duration: 5, boredom: 6, tiredness: 6, where: () => ({ x: 60, z: 146 }) },
    { id: 'tinker', trait: 'ambition', action: 'tinkering with a little invention', thought: 'One useful thing at a time, and the island becomes home.', duration: 5, boredom: 10, curiosity: 8, where: () => craftSpots.length ? nearestSpot(craftSpots, 0, 0) : { x: 9, z: 18 } }
];

function randomShorePoint() {
    const a = worldRng() * Math.PI * 2;
    return { x: Math.cos(a) * ISLAND.rx * 0.74, z: Math.sin(a) * ISLAND.rz * 0.74 };
}

const chatLines = {
    playful: ['Race you to the dock!', 'Bet the fish gossip about us.', 'Did you see the size of that wave?'],
    kind: ['Have you eaten today?', 'I saved you the softest sleeping mat.', 'You did good work today.'],
    curious: ['What do you think is past the horizon?', 'I found a shell that hums.', 'The stars moved again last night.'],
    diligent: ['The wood pile is looking healthy.', 'We should dry more cloth before the rain.', 'Storage is nearly at goal.'],
    imaginative: ['I dreamt the island was a sleeping turtle.', 'Old story says the palms whisper names.', 'This fire remembers every story told to it.'],
    social: ['Come sit, the fire is perfect.', 'Tell me about your day.', 'We should all eat together tonight.']
};
function pickChatLine(profile) {
    const t = profile.traits;
    const pool = [];
    if (t.playfulness > 65) pool.push(...chatLines.playful);
    if (t.kindness > 70) pool.push(...chatLines.kind);
    if (t.curiosity > 70) pool.push(...chatLines.curious);
    if (t.diligence > 70) pool.push(...chatLines.diligent);
    if (t.imagination > 75) pool.push(...chatLines.imaginative);
    if (pool.length === 0) pool.push(...chatLines.social);
    return pool[Math.floor(Math.random() * pool.length)];
}

function isNight() {
    return gameClock.hour >= 21.5 || gameClock.hour < 5.8;
}

function storageDeficit(key) {
    return Math.max(0, (storageGoals[key] || 0) - (communityStorage[key] || 0));
}

/* ---- the local utility brain ---- */
function chooseAction(resident) {
    const { needs, profile, ai } = resident;
    const px = resident.mesh.position.x, pz = resident.mesh.position.z;

    if (resident.inventory.carry) {
        return { type: 'deposit', x: 9, z: 18, action: `hauling ${resident.inventory.carry} to storage`, duration: 2 };
    }

    const options = [];
    const bias = ai.bias && ai.bias.expiresAt > performance.now() / 1000 ? ai.bias.goal : null;
    const biasBoost = (goal) => (bias === goal ? 160 : 0);

    // sleep at night
    if (isNight() && needs.tiredness > 14) {
        const spot = nearestSpot(sleepSpots, px, pz);
        options.push({ type: 'sleep', x: spot.x, z: spot.z, action: `heading to ${spot.label} to sleep`, duration: 0, score: 420 + needs.tiredness + biasBoost('rest') });
    }
    // hard needs
    if (needs.hunger > 42) {
        if ((communityStorage.cookedFish || 0) > 0 || (communityStorage.food || 0) > 0) {
            options.push({ type: 'eat', x: 9, z: 18, action: 'eating from the shared store', duration: 2.5, score: 330 + needs.hunger + biasBoost('food') });
        } else {
            options.push({ type: 'collect', resource: 'food', action: 'going to find food', duration: 4, score: 322 + needs.hunger + biasBoost('food') });
        }
    }
    if (needs.thirst > 40) {
        if ((communityStorage.water || 0) > 0) {
            const spot = nearestSpot(waterSpots, px, pz);
            options.push({ type: 'drink', x: spot.x, z: spot.z, action: 'drinking fresh water', duration: 1.6, score: 332 + needs.thirst + biasBoost('water') });
        } else {
            options.push({ type: 'collect', resource: 'water', action: 'going to collect water', duration: 4, score: 322 + needs.thirst + biasBoost('water') });
        }
    }
    if (needs.tiredness > 64) {
        const spot = nearestSpot(sleepSpots, px, pz);
        options.push({ type: 'sleep', x: spot.x, z: spot.z, action: `going to nap at ${spot.label}`, duration: 0, score: 290 + needs.tiredness + biasBoost('rest') });
    }
    // social
    if (needs.social > 45) {
        const others = residents.filter((r) => r !== resident && r.ai.state !== 'sleeping');
        if (others.length) {
            const target = others.sort((a, b) => (resident.relationships[a.profile.name] || 50) - (resident.relationships[b.profile.name] || 50))[0];
            const spot = nearestSpot(socialSpots, px, pz);
            options.push({
                type: 'social', targetName: target.profile.name, x: spot.x, z: spot.z,
                action: `finding ${target.profile.name.split(' ')[0]} for a chat`, duration: 4,
                score: 140 + needs.social + traitOf(profile, 'sociability') * 0.7 + traitOf(profile, 'extraversion') * 0.3 + biasBoost('social')
            });
        }
    }
    // cooking: raw fish → cooked
    if ((communityStorage.rawFish || 0) > 0 && (communityStorage.cookedFish || 0) < storageGoals.cookedFish) {
        options.push({
            type: 'cook', x: -4, z: 26, action: 'cooking fish on the bonfire', duration: 4,
            score: 96 + storageDeficit('cookedFish') * 9 + traitOf(profile, 'kindness') * 0.25 + traitOf(profile, 'diligence') * 0.2 + biasBoost('food')
        });
    }
    // research at desks
    if (researchSpots.length && storageDeficit('research') > 0) {
        const spot = nearestSpot(researchSpots, px, pz);
        options.push({
            type: 'research', x: spot.x, z: spot.z, action: 'researching at the desk', duration: 5,
            score: 80 + storageDeficit('research') * 8 + traitOf(profile, 'imagination') * 0.4 + traitOf(profile, 'openness') * 0.3 + needs.curiosity * 0.5 + biasBoost('research')
        });
    }
    // crafting at workshops: wood+fibre → cloth/metal trickle
    if (craftSpots.length && (communityStorage.wood || 0) > 4 && (storageDeficit('cloth') > 0 || storageDeficit('metal') > 0)) {
        const spot = nearestSpot(craftSpots, px, pz);
        options.push({
            type: 'craft', x: spot.x, z: spot.z, action: 'crafting at the workshop', duration: 5,
            score: 74 + (storageDeficit('cloth') + storageDeficit('metal')) * 7 + traitOf(profile, 'ambition') * 0.35 + traitOf(profile, 'diligence') * 0.3 + biasBoost('craft')
        });
    }
    // gathering for the colony
    for (const key of storageKeys) {
        const deficit = storageDeficit(key);
        if (deficit <= 0 || !resourceFlavor[key]) continue;
        if (!nearestNode(key, px, pz)) continue;
        const flavor = resourceFlavor[key];
        const affinity = traitOf(profile, flavor.trait) * 0.5;
        const diligent = traitOf(profile, 'diligence') * 0.3 + traitOf(profile, 'conscientiousness') * 0.22;
        const curious = ['shells', 'herbs', 'seeds'].includes(key) ? traitOf(profile, 'curiosity') * 0.35 : 0;
        const crowd = residents.filter((other) => other !== resident && (other.ai.plan?.resource === key || other.inventory.carry === key)).length;
        const goalKey = key === 'rawFish' ? 'fish' : ['food', 'water'].includes(key) ? key : 'gather';
        options.push({
            type: 'collect', resource: key, action: flavor.action,
            duration: 3.5 + Math.min(2, deficit * 0.1),
            score: 72 + deficit * 9 + affinity + diligent + curious - crowd * 56 + biasBoost(goalKey) + biasBoost('gather')
        });
    }
    // personality time
    if (needs.boredom > 26 || needs.curiosity > 34 || options.length === 0) {
        const turn = (resident.memories.length + residents.indexOf(resident)) % personalityActivities.length;
        const scored = personalityActivities.map((a, i) => ({
            a,
            s: traitOf(profile, a.trait) * 1.25 + needs.boredom * 0.6 + needs.curiosity * 0.5 + ((i + turn) % 5) * 6 +
               biasBoost('explore') * (a.trait === 'wanderlust' || a.trait === 'confidence' ? 1 : 0) +
               biasBoost('play') * (a.trait === 'playfulness' ? 1 : 0)
        })).sort((x, y) => y.s - x.s);
        const pick = scored[0];
        const where = pick.a.where();
        options.push({ type: 'personality', activity: pick.a.id, x: where.x, z: where.z, action: pick.a.action, duration: pick.a.duration, score: 58 + pick.s * 0.55 });
    }

    options.sort((a, b) => b.score - a.score);
    const plan = options[0];
    if (plan.type === 'collect' && plan.x === undefined) {
        const node = nearestNode(plan.resource, px, pz);
        plan.x = node.x; plan.z = node.z;
    }
    return plan;
}

function startPlan(resident, plan) {
    resident.ai.plan = plan;
    resident.ai.state = 'walking';
    if (plan.type === 'collect') resident.currentThought = resourceFlavor[plan.resource]?.thought || resident.currentThought;
    if (plan.type === 'personality') {
        const act = personalityActivities.find((a) => a.id === plan.activity);
        if (act) resident.currentThought = act.thought;
    }
    if (plan.type === 'social') resident.currentThought = `I should check in with ${plan.targetName}.`;
}

function walkResident(resident, simHours, realDelta) {
    const mesh = resident.mesh;
    const plan = resident.ai.plan;
    const dx = plan.x - mesh.position.x;
    const dz = plan.z - mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.2) {
        const targetRot = Math.atan2(dx, dz);
        let dr = targetRot - mesh.rotation.y;
        while (dr > Math.PI) dr -= Math.PI * 2;
        while (dr < -Math.PI) dr += Math.PI * 2;
        mesh.rotation.y += dr * Math.min(1, realDelta * 8);
    }
    const speed = resident.ai.speed * (gameClock.speed || 0);
    const step = Math.min(dist, speed * realDelta);
    if (dist > 0.01) {
        mesh.position.x += (dx / dist) * step;
        mesh.position.z += (dz / dist) * step;
    }
    mesh.position.y = heightAt(mesh.position.x, mesh.position.z);
    // limb swing
    if (step > 0.001) {
        resident.ai.walkPhase += realDelta * speed * 0.85;
        const swing = Math.sin(resident.ai.walkPhase) * 0.55;
        const limbs = mesh.userData.limbs;
        limbs.legs[0].rotation.x = swing;
        limbs.legs[1].rotation.x = -swing;
        limbs.arms[0].rotation.x = -swing * 0.7;
        limbs.arms[1].rotation.x = swing * 0.7;
    }
    return dist < 2.2;
}

function settleLimbs(resident, realDelta) {
    const limbs = resident.mesh.userData.limbs;
    [...limbs.legs, ...limbs.arms].forEach((limb) => {
        limb.rotation.x *= Math.max(0, 1 - realDelta * 10);
    });
}

function remember(resident, text) {
    resident.memories.unshift(text);
    if (resident.memories.length > 8) resident.memories.pop();
}

function completePlan(resident) {
    const plan = resident.ai.plan;
    const needs = resident.needs;
    switch (plan.type) {
        case 'collect': {
            const amount = plan.resource === 'rawFish' ? 1 + Math.round(Math.random()) : 2 + Math.round(traitOf(resident.profile, 'diligence') / 45);
            resident.inventory.carry = plan.resource;
            resident.inventory.amount = amount;
            resident.mesh.userData.bundle.visible = true;
            easeNeed(needs, 'boredom', 8);
            easeNeed(needs, 'curiosity', 8);
            remember(resident, `gathered ${amount} ${plan.resource}`);
            startPlan(resident, { type: 'deposit', x: 9, z: 18, action: `hauling ${plan.resource} to storage`, duration: 2 });
            return;
        }
        case 'deposit':
            if (resident.inventory.carry) {
                communityStorage[resident.inventory.carry] = (communityStorage[resident.inventory.carry] || 0) + resident.inventory.amount;
                resident.currentThought = `The camp has more ${storageLabels[resident.inventory.carry].toLowerCase()} now.`;
            }
            resident.inventory.carry = null;
            resident.inventory.amount = 0;
            resident.mesh.userData.bundle.visible = false;
            break;
        case 'eat': {
            const key = (communityStorage.cookedFish || 0) > 0 ? 'cookedFish' : 'food';
            if ((communityStorage[key] || 0) > 0) {
                communityStorage[key] -= 1;
                easeNeed(needs, 'hunger', key === 'cookedFish' ? 62 : 48);
                resident.currentThought = 'Food tastes better when everyone knows where it is stored.';
            }
            break;
        }
        case 'drink':
            if ((communityStorage.water || 0) > 0) communityStorage.water -= 1;
            easeNeed(needs, 'thirst', 52);
            break;
        case 'cook':
            if ((communityStorage.rawFish || 0) > 0) {
                communityStorage.rawFish -= 1;
                communityStorage.cookedFish = (communityStorage.cookedFish || 0) + 1;
                easeNeed(needs, 'boredom', 6);
                remember(resident, 'cooked fish at the bonfire');
            }
            break;
        case 'research':
            communityStorage.research = (communityStorage.research || 0) + 1;
            easeNeed(needs, 'curiosity', 24);
            easeNeed(needs, 'boredom', 10);
            remember(resident, 'sketched a new colony idea');
            break;
        case 'craft':
            if ((communityStorage.wood || 0) > 1) {
                communityStorage.wood -= 1;
                if (storageDeficit('cloth') >= storageDeficit('metal') && (communityStorage.fibre || 0) > 0) {
                    communityStorage.fibre -= 1;
                    communityStorage.cloth = (communityStorage.cloth || 0) + 1;
                } else {
                    communityStorage.metal = (communityStorage.metal || 0) + 1;
                }
                easeNeed(needs, 'boredom', 10);
                remember(resident, 'crafted supplies at the workshop');
            }
            break;
        case 'social': {
            const target = residents.find((r) => r.profile.name === plan.targetName);
            if (target) {
                const line = brain.lastSayFor(resident) || pickChatLine(resident.profile);
                showBubble(resident.mesh.userData.bubble, line, 'say', 5);
                setTimeout(() => {
                    if (target.ai.state !== 'sleeping') showBubble(target.mesh.userData.bubble, pickChatLine(target.profile), 'say', 5);
                }, 1700);
                resident.relationships[target.profile.name] = clamp((resident.relationships[target.profile.name] || 50) + 5 + Math.round(traitOf(resident.profile, 'agreeableness') / 25), 0, 100);
                target.relationships[resident.profile.name] = clamp((target.relationships[resident.profile.name] || 50) + 4, 0, 100);
                easeNeed(target.needs, 'social', 18);
                remember(resident, `had a good chat with ${target.profile.name}`);
                remember(target, `chatted with ${resident.profile.name}`);
            }
            easeNeed(needs, 'social', 30);
            easeNeed(needs, 'boredom', 12);
            resident.currentThought = 'A good conversation changes the whole weather of a day.';
            break;
        }
        case 'sleep':
            resident.ai.state = 'sleeping';
            resident.mesh.rotation.x = -Math.PI / 2;
            resident.mesh.position.y = heightAt(resident.mesh.position.x, resident.mesh.position.z) + 1.4;
            showBubble(resident.mesh.userData.bubble, '💤', 'thought', 4);
            resident.currentThought = 'Sleep knits the day back together.';
            return;
        case 'personality': {
            const act = personalityActivities.find((a) => a.id === plan.activity) || personalityActivities[0];
            if (act.boredom) easeNeed(needs, 'boredom', act.boredom);
            if (act.curiosity) easeNeed(needs, 'curiosity', act.curiosity);
            if (act.social) easeNeed(needs, 'social', act.social);
            if (act.comfort) easeNeed(needs, 'comfort', act.comfort);
            if (act.tiredness) easeNeed(needs, 'tiredness', act.tiredness);
            remember(resident, `${act.action} (${act.trait})`);
            resident.currentThought = act.thought;
            break;
        }
    }
    resident.ai.state = 'thinking';
    resident.ai.timer = 0.6 + Math.random() * 0.8;
    resident.ai.plan = null;
}

function updateResident(resident, simHours, realDelta) {
    advanceNeeds(resident.needs, simHours);
    const ai = resident.ai;

    if (ai.state === 'sleeping') {
        easeNeed(resident.needs, 'tiredness', simHours * 26);
        easeNeed(resident.needs, 'comfort', simHours * 8);
        const slept = resident.needs.tiredness < 6;
        const morning = !isNight() && gameClock.hour >= 5.8;
        if ((slept && !isNight()) || (morning && resident.needs.tiredness < 40)) {
            ai.state = 'thinking';
            ai.timer = 0.5;
            resident.mesh.rotation.x = 0;
            resident.mesh.position.y = heightAt(resident.mesh.position.x, resident.mesh.position.z);
            resident.currentThought = 'Morning. The island smells new again.';
        }
        return;
    }
    if (gameClock.speed === 0) return;

    if (ai.state === 'thinking') {
        ai.timer -= realDelta * gameClock.speed;
        if (ai.timer <= 0) startPlan(resident, chooseAction(resident));
        return;
    }
    if (ai.state === 'walking') {
        if (walkResident(resident, simHours, realDelta)) {
            ai.state = 'acting';
            ai.timer = ai.plan.duration || 2;
            if (ai.plan.type === 'sleep') completePlan(resident);
        }
        return;
    }
    if (ai.state === 'acting') {
        settleLimbs(resident, realDelta);
        // small working bob
        resident.mesh.position.y = heightAt(resident.mesh.position.x, resident.mesh.position.z) + Math.abs(Math.sin(performance.now() / 240)) * 0.25;
        ai.timer -= realDelta * gameClock.speed;
        if (ai.timer <= 0) completePlan(resident);
    }
}

/* ============================================================
   10. Build catalog (simulation side) + placement effects
   ============================================================ */
const buildCatalog = {
    garden: { label: 'Garden bed', icon: '🌱', cost: { wood: 1, seeds: 2 }, effect: 'Adds a berry node + food goal' },
    farmPlot: { label: 'Farm plot', icon: '🌾', cost: { wood: 2, seeds: 4 }, effect: 'Big food node, raises food goal' },
    waterJar: { label: 'Water jars', icon: '🏺', cost: { wood: 1, shells: 2 }, effect: 'New water point + water goal' },
    well: { label: 'Stone well', icon: '⛲', cost: { stone: 6, wood: 2 }, effect: 'Strong water point, eases thirst' },
    shelter: { label: 'Tiny shelter', icon: '⛺', cost: { wood: 3, fibre: 2 }, effect: 'A sleep spot, comfort eased' },
    guestCabin: { label: 'Guest cabin', icon: '🏠', cost: { wood: 6, fibre: 3, cloth: 2 }, effect: 'Two sleep spots, big comfort' },
    socialBench: { label: 'Social bench', icon: '🪑', cost: { wood: 2, shells: 1 }, effect: 'A meeting spot for chats' },
    firePit: { label: 'Fire pit', icon: '🔥', cost: { stone: 4, wood: 2 }, effect: 'Cooking + cosy night light' },
    workshop: { label: 'Workshop', icon: '🛠️', cost: { wood: 4, stone: 2 }, effect: 'Crafting: wood→cloth/metal' },
    researchDesk: { label: 'Research desk', icon: '📜', cost: { wood: 3, shells: 2 }, effect: 'Research point, eases curiosity' },
    dock: { label: 'Fishing dock', icon: '🎣', cost: { wood: 5, fibre: 3 }, effect: 'Shore only · strong fish node', shore: true },
    windmill: { label: 'Windmill', icon: '🌬️', cost: { wood: 4, fibre: 3, metal: 2 }, effect: 'Everyone works a little faster' },
    watchtower: { label: 'Watchtower', icon: '🗼', cost: { wood: 6, stone: 3 }, effect: 'Lookout spot, eases curiosity' },
    flowerGarden: { label: 'Flower garden', icon: '🌸', cost: { seeds: 3, shells: 2 }, effect: 'Beauty: comfort + boredom eased' }
};
const builtItems = [];

function canAfford(key) {
    const def = buildCatalog[key];
    return def && Object.entries(def.cost).every(([res, amt]) => (communityStorage[res] || 0) >= amt);
}
function costText(cost) {
    return Object.entries(cost).map(([res, amt]) => `${amt} ${storageLabels[res].toLowerCase()}`).join(' + ');
}

function applyBuildEffects(key, x, z) {
    switch (key) {
        case 'garden':
            resourceNodes.push({ key: 'food', label: 'garden bed', x, z, mesh: null });
            storageGoals.food += 4;
            break;
        case 'farmPlot':
            resourceNodes.push({ key: 'food', label: 'farm plot', x, z, mesh: null });
            resourceNodes.push({ key: 'seeds', label: 'farm plot', x, z, mesh: null });
            storageGoals.food += 8;
            break;
        case 'waterJar':
            waterSpots.push({ x, z, label: 'the water jars' });
            resourceNodes.push({ key: 'water', label: 'water jars', x, z, mesh: null });
            storageGoals.water += 4;
            break;
        case 'well':
            waterSpots.push({ x, z, label: 'the well' });
            resourceNodes.push({ key: 'water', label: 'the well', x, z, mesh: null });
            communityStorage.water = (communityStorage.water || 0) + 4;
            residents.forEach((r) => easeNeed(r.needs, 'thirst', 14));
            break;
        case 'shelter':
            sleepSpots.push({ x, z, label: 'the shelter' });
            residents.forEach((r) => easeNeed(r.needs, 'comfort', 16));
            break;
        case 'guestCabin':
            sleepSpots.push({ x, z, label: 'the cabin' }, { x: x + 3, z: z + 2, label: 'the cabin' });
            residents.forEach((r) => { easeNeed(r.needs, 'comfort', 26); easeNeed(r.needs, 'social', 10); });
            break;
        case 'socialBench':
            socialSpots.push({ x, z, label: 'the bench' });
            residents.forEach((r) => easeNeed(r.needs, 'social', 12));
            break;
        case 'firePit':
            socialSpots.push({ x, z, label: 'the fire pit' });
            residents.forEach((r) => easeNeed(r.needs, 'comfort', 12));
            break;
        case 'workshop':
            craftSpots.push({ x, z, label: 'the workshop' });
            storageGoals.wood += 4;
            break;
        case 'researchDesk':
            researchSpots.push({ x, z, label: 'the research desk' });
            communityStorage.research = (communityStorage.research || 0) + 2;
            residents.forEach((r) => easeNeed(r.needs, 'curiosity', 18));
            break;
        case 'dock':
            resourceNodes.push({ key: 'rawFish', label: 'the dock', x, z, mesh: null });
            communityStorage.rawFish = (communityStorage.rawFish || 0) + 2;
            storageGoals.rawFish += 4;
            break;
        case 'windmill':
            residents.forEach((r) => { r.ai.speed += 1.2; });
            communityStorage.research = (communityStorage.research || 0) + 1;
            break;
        case 'watchtower':
            playSpots.push({ x, z, label: 'the watchtower' });
            residents.forEach((r) => easeNeed(r.needs, 'curiosity', 14));
            break;
        case 'flowerGarden':
            playSpots.push({ x, z, label: 'the flower garden' });
            residents.forEach((r) => { easeNeed(r.needs, 'comfort', 14); easeNeed(r.needs, 'boredom', 10); });
            break;
    }
}

const buildPops = [];
function constructBuilding(key, x, z, rotY, { silent = false, charge = true } = {}) {
    const def = buildCatalog[key];
    if (!def) return { ok: false, message: 'Unknown build item' };
    if (charge && !canAfford(key)) return { ok: false, message: `Need ${costText(def.cost)}` };
    if (charge) Object.entries(def.cost).forEach(([res, amt]) => { communityStorage[res] = Math.max(0, (communityStorage[res] || 0) - amt); });
    const mesh = buildFactories[key]();
    const lift = key === 'dock' ? Math.max(0.4, heightAt(x, z)) - heightAt(x, z) : 0;
    placeOnGround(mesh, x, z, lift);
    if (key === 'dock') mesh.position.y = Math.max(mesh.position.y, 1.4);
    mesh.rotation.y = rotY;
    world.add(mesh);
    reserve(x, z, 8);
    builtItems.push({ key, x, z, rotY, mesh });
    applyBuildEffects(key, x, z);
    if (!silent) {
        mesh.scale.setScalar(0.05);
        buildPops.push({ mesh, t: 0 });
        toast(`${def.icon} ${def.label} built! ${def.effect}.`);
    }
    return { ok: true, built: def.label };
}

/* ============================================================
   11. Weather + daily events
   ============================================================ */
const weather = { state: 'clear', untilHour: 0, rainDayChecked: -1 };
let arrivalsDone = 0;

function updateWeather(simHours) {
    if (weather.state === 'clear') {
        if (Math.random() < simHours * 0.05 && gameClock.hour > 7 && gameClock.hour < 19) {
            weather.state = 'rain';
            weather.untilHour = gameClock.hour + 1.2 + Math.random() * 1.8;
            toast('🌧 Rain is rolling in across the bay…');
        }
    } else if (weather.state === 'rain') {
        communityStorage.water = Math.min(communityStorage.water + simHours * 1.6, storageGoals.water + 10);
        if (gameClock.hour > weather.untilHour || gameClock.hour < 0.2) {
            weather.state = 'clear';
            toast('🌤 The rain has passed. The barrels are fuller.');
        }
    }
    rain.visible = weather.state === 'rain';
}

function maybeRaftArrival() {
    if (arrivalsDone >= ARRIVAL_POOL.length) return;
    const due = (gameClock.day >= 2 + arrivalsDone * 2) && gameClock.hour > 9 && gameClock.hour < 17;
    if (!due) return;
    const profile = ARRIVAL_POOL[arrivalsDone];
    arrivalsDone++;
    const r = spawnResident(profile, -168, 48);
    startPlan(r, { type: 'personality', activity: 'tidy-camp', x: villageCenter.x, z: villageCenter.z, action: 'walking up to the village to say hello', duration: 3 });
    r.ai.state = 'walking';
    toast(`⛵ A raft has landed — ${profile.name}, ${profile.archetype}, joins the island!`);
}

/* ============================================================
   12. Little GPT brains — optional per-resident LLM personas
   ============================================================ */
const BRAIN_STORE_KEY = 'unknown-brain-config-v1';
const GOALS = ['food', 'water', 'rest', 'social', 'explore', 'gather', 'fish', 'build', 'research', 'craft', 'play', 'tidy'];

const brain = {
    config: { enabled: false, provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', key: '' },
    nextIndex: 0,
    cooldownUntil: 0,
    inFlight: false,
    lastError: '',
    callCount: 0,
    says: new Map(),

    load() {
        try {
            const raw = localStorage.getItem(BRAIN_STORE_KEY);
            if (raw) Object.assign(this.config, JSON.parse(raw));
        } catch { /* fresh start */ }
    },
    save() {
        try { localStorage.setItem(BRAIN_STORE_KEY, JSON.stringify(this.config)); } catch { /* ignore */ }
    },
    lastSayFor(resident) {
        const text = this.says.get(resident.profile.id);
        this.says.delete(resident.profile.id);
        return text || null;
    },
    personaPrompt(resident) {
        const p = resident.profile;
        return [
            `You are ${p.name}, a resident of a small peaceful island colony. You are ${p.archetype}.`,
            `Your voice: ${p.voice}.`,
            `OCEAN personality (0-100): ${Object.entries(p.ocean).map(([k, v]) => `${k}=${v}`).join(', ')}.`,
            `Strongest traits: ${topTraits(p, 5).map((t) => `${t.label}=${t.value}`).join(', ')}.`,
            'You think and speak ONLY as this character. Keep everything peaceful, cosy and island-appropriate.',
            'Respond ONLY with minified JSON, no markdown: {"thought":"one short inner thought (max 14 words)","say":"one short spoken line you might say to a neighbour (max 14 words)","goal":"one of ' + GOALS.join('|') + '"}'
        ].join('\n');
    },
    statePrompt(resident) {
        const n = resident.needs;
        const needsTxt = needDefs.map((d) => `${d.key}=${Math.round(n[d.key])}`).join(', ');
        const storeTxt = storageKeys.map((k) => `${k}=${Math.floor(communityStorage[k] || 0)}/${storageGoals[k]}`).join(', ');
        const relTxt = Object.entries(resident.relationships).map(([name, v]) => `${name.split(' ')[0]}=${Math.round(v)}`).join(', ') || 'none yet';
        return [
            `Day ${gameClock.day}, ${String(Math.floor(gameClock.hour)).padStart(2, '0')}:00 (${phaseOfDay()}), weather ${weather.state}.`,
            `Your needs (0 fine → 100 urgent): ${needsTxt}.`,
            `Colony storage vs goals: ${storeTxt}.`,
            `Friendships (0-100): ${relTxt}.`,
            `Recent memories: ${resident.memories.slice(0, 4).join(' | ') || 'a fresh start'}.`,
            `You are currently: ${resident.ai.plan ? resident.ai.plan.action : resident.ai.state}.`,
            `Buildings on the island: ${builtItems.map((b) => buildCatalog[b.key].label).join(', ') || 'just the starting camp'}.`,
            'What is on your mind?'
        ].join('\n');
    },
    async think(resident) {
        const cfg = this.config;
        this.inFlight = true;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 22000);
            const response = await fetch(cfg.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
                body: JSON.stringify({
                    model: cfg.model,
                    max_tokens: 110,
                    temperature: 0.9,
                    messages: [
                        { role: 'system', content: this.personaPrompt(resident) },
                        { role: 'user', content: this.statePrompt(resident) }
                    ]
                }),
                signal: controller.signal
            });
            clearTimeout(timer);
            if (response.status === 401 || response.status === 403) {
                cfg.enabled = false;
                this.lastError = 'API key rejected — brains disabled.';
                updateBrainUI();
                return;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            let text = data.choices?.[0]?.message?.content || '';
            text = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(text);
            const thought = String(parsed.thought || '').slice(0, 120);
            const say = String(parsed.say || '').slice(0, 120);
            const goal = GOALS.includes(parsed.goal) ? parsed.goal : null;
            if (thought) {
                resident.currentThought = thought;
                if (resident.ai.state !== 'sleeping') showBubble(resident.mesh.userData.bubble, thought, 'thought', 6);
            }
            if (say) {
                this.says.set(resident.profile.id, say);
                resident.lastSay = say;
            }
            if (goal) resident.ai.bias = { goal, expiresAt: performance.now() / 1000 + 150 };
            this.callCount++;
            this.lastError = '';
            updateBrainUI();
        } catch (error) {
            this.lastError = String(error.message || error);
            this.cooldownUntil = performance.now() / 1000 + 30;
        } finally {
            this.inFlight = false;
        }
    },
    update() {
        const now = performance.now() / 1000;
        if (!this.config.enabled || !this.config.key || this.inFlight) return;
        if (now < this.cooldownUntil || document.visibilityState === 'hidden' || gameClock.speed === 0) return;
        this.cooldownUntil = now + 16;     // one resident thinks every ~16s
        const awake = residents.filter((r) => r.ai.state !== 'sleeping');
        if (!awake.length) return;
        this.nextIndex = (this.nextIndex + 1) % awake.length;
        this.think(awake[this.nextIndex]);
    }
};
brain.load();

/* ============================================================
   13. UI — toast, clock, panels, build menu, brains modal
   ============================================================ */
let toastTimer = null;
function toast(text, seconds = 5) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), seconds * 1000);
}

const storageGridEl = $('storage-grid');
storageGridEl.innerHTML = storageKeys.map((key) =>
    `<span class="storage-chip">${storageLabels[key]} <strong data-store="${key}">0</strong></span>`).join('');

const residentListEl = $('resident-list');
residentListEl.addEventListener('click', (e) => {
    const card = e.target.closest('.resident-card');
    if (card) selectResident(residents[Number(card.dataset.i)]);
});
let selectedResident = null;
let followResident = null;

function colorHex(c) { return '#' + new THREE.Color(c).getHexString(); }

function refreshHUD() {
    // storage
    storageKeys.forEach((key) => {
        const el = storageGridEl.querySelector(`[data-store="${key}"]`);
        if (el) el.textContent = Math.floor(communityStorage[key] || 0);
    });
    // storage piles visual
    const piles = props.cache.userData.piles || {};
    storageKeys.forEach((key) => {
        const pile = piles[key];
        if (!pile) return;
        const amount = communityStorage[key] || 0;
        pile.visible = amount > 0.5;
        pile.scale.setScalar(clamp(0.45 + amount / Math.max(4, storageGoals[key]), 0.4, 1.3));
    });
    // colony mood
    const urgent = residents.filter((r) => r.needs.topNeedValue > 62).length;
    $('colony-mood').textContent = urgent === 0 ? 'thriving' : urgent === 1 ? 'one colonist struggling' : `${urgent} colonists struggling`;
    $('resident-count').textContent = `${residents.length}`;
    // resident cards (updated in place so clicks stay stable)
    if (Number(residentListEl.dataset.count || 0) !== residents.length) {
        residentListEl.dataset.count = residents.length;
        residentListEl.innerHTML = residents.map((r, i) =>
            `<div class="resident-card" data-i="${i}">
                <div class="rc-head"><span class="rc-dot" style="background:${colorHex(r.profile.accent)}"></span><strong>${r.profile.name}</strong></div>
                <span class="rc-action"></span>
                <span class="rc-need"><i></i></span>
            </div>`).join('');
    }
    residentListEl.querySelectorAll('.resident-card').forEach((card, i) => {
        const r = residents[i];
        if (!r) return;
        const need = needLabels[r.needs.topNeed];
        const pct = Math.round(r.needs.topNeedValue);
        const action = r.ai.state === 'sleeping' ? 'sleeping 💤' : (r.ai.plan ? r.ai.plan.action : 'thinking…');
        card.classList.toggle('selected', selectedResident === r);
        const actionEl = card.querySelector('.rc-action');
        if (actionEl.textContent !== action) actionEl.textContent = action;
        card.querySelector('.rc-need').title = `${need} ${pct}%`;
        card.querySelector('.rc-need i').style.width = `${pct}%`;
    });
    // selected panel
    if (selectedResident) refreshResidentPanel();
    // build menu affordability
    buildMenuEl.querySelectorAll('.build-choice').forEach((btn) => {
        btn.disabled = !canAfford(btn.dataset.build);
    });
    // weather + debug surface
    $('weather-chip').textContent = weather.state === 'rain' ? '🌧 rainfall' : isNight() ? '🌙 clear night' : '☀ clear skies';
    publishDebugState();
}

function refreshResidentPanel() {
    const r = selectedResident;
    $('rp-name').textContent = `${r.profile.name} — ${r.profile.archetype}`;
    $('rp-thought').textContent = `“${r.currentThought}”`;
    $('rp-say').textContent = r.lastSay ? `🗣 “${r.lastSay}”` : '';
    $('rp-needs').innerHTML = needDefs.map((d) => {
        const v = Math.round(r.needs[d.key]);
        return `<div class="need-row"><span class="need-label">${d.label}</span><span class="need-track"><span class="need-fill" style="width:${v}%"></span></span><span class="need-value">${v}%</span></div>`;
    }).join('');
    $('rp-traits').innerHTML = topTraits(r.profile, 6).map((t) => `<span class="trait-chip">${t.label} ${t.value}</span>`).join('');
    const rels = Object.entries(r.relationships).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([name, v]) => `<strong>${name.split(' ')[0]}</strong> ${Math.round(v)}`).join(' · ');
    $('rp-rel').innerHTML = rels ? `Friends: ${rels}` : '';
}

function selectResident(resident) {
    selectedResident = resident;
    $('resident-panel').classList.toggle('show', !!resident);
    if (!resident) followResident = null;
    refreshHUD();
}
$('rp-close').addEventListener('click', () => selectResident(null));
$('rp-follow').addEventListener('click', () => {
    followResident = followResident === selectedResident ? null : selectedResident;
    $('rp-follow').textContent = followResident ? '🎥 Following ✓' : '🎥 Follow';
});

function updateClockUI() {
    const h = Math.floor(gameClock.hour);
    const m = Math.floor((gameClock.hour - h) * 60);
    $('clock').innerHTML = `Day ${gameClock.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} <small>${phaseOfDay()}</small>`;
}
document.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        gameClock.speed = Number(btn.dataset.speed);
        document.querySelectorAll('.speed-btn').forEach((b) => b.classList.toggle('active', b === btn));
    });
});

/* ---- build menu ---- */
const buildPanelEl = $('build-panel');
const buildMenuEl = $('build-menu');
buildMenuEl.innerHTML = '<p class="build-hint">Pick something, then click anywhere on the island to place it. Residents will actually use it.</p>' +
    Object.entries(buildCatalog).map(([key, def]) =>
        `<button class="build-choice" data-build="${key}" type="button">${def.icon} ${def.label}<small>${costText(def.cost)} · ${def.effect}</small></button>`
    ).join('');
$('build-toggle').addEventListener('click', () => buildPanelEl.classList.toggle('open'));

/* ---- brains modal ---- */
const brainsModal = $('brains-modal');
$('brains-btn').addEventListener('click', () => {
    brainsModal.classList.add('show');
    $('brains-model').value = brain.config.model;
    $('brains-key').value = brain.config.key;
    $('brains-provider').value = brain.config.provider;
    $('brains-endpoint').value = brain.config.provider === 'custom' ? brain.config.endpoint : '';
    $('brains-endpoint-row').style.display = brain.config.provider === 'custom' ? 'block' : 'none';
});
$('brains-provider').addEventListener('change', (e) => {
    $('brains-endpoint-row').style.display = e.target.value === 'custom' ? 'block' : 'none';
});
$('brains-close').addEventListener('click', () => brainsModal.classList.remove('show'));
brainsModal.addEventListener('click', (e) => { if (e.target === brainsModal) brainsModal.classList.remove('show'); });
$('brains-save').addEventListener('click', () => {
    brain.config.provider = $('brains-provider').value;
    brain.config.model = $('brains-model').value.trim() || 'gpt-4o-mini';
    brain.config.key = $('brains-key').value.trim();
    brain.config.endpoint = brain.config.provider === 'custom'
        ? ($('brains-endpoint').value.trim() || brain.config.endpoint)
        : 'https://api.openai.com/v1/chat/completions';
    brain.config.enabled = Boolean(brain.config.key);
    brain.save();
    updateBrainUI();
    if (brain.config.enabled) toast('🧠 Little GPT brains online — residents will start thinking for themselves.');
});
$('brains-disable').addEventListener('click', () => {
    brain.config.enabled = false;
    brain.save();
    updateBrainUI();
});
function updateBrainUI() {
    const on = brain.config.enabled && brain.config.key;
    $('brain-dot').classList.toggle('on', Boolean(on));
    $('brains-status').textContent = on
        ? `Brains: LLM personas active (${brain.config.model}) · ${brain.callCount} thoughts so far${brain.lastError ? ' · last error: ' + brain.lastError : ''}`
        : `Brains: local personality AI${brain.lastError ? ' · ' + brain.lastError : ' (no LLM connected).'}`;
}
$('reset-colony').addEventListener('click', () => {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
});

/* ============================================================
   14. Player input — orbit, selection, building placement, walk
   ============================================================ */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true;
controls.panSpeed = 0.6;
controls.minDistance = 40;
controls.maxDistance = 620;
controls.minPolarAngle = Math.PI * 0.08;
controls.maxPolarAngle = Math.PI * 0.46;
controls.target.set(villageCenter.x, 10, villageCenter.z);

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
function setPointer(event) {
    pointerNDC.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNDC.y = -(event.clientY / innerHeight) * 2 + 1;
}

/* ---- placement mode ---- */
const placing = { key: null, ghost: null, rotY: 0, valid: false, x: 0, z: 0 };
const ghostOK = new THREE.Color(0x7ee0a4);
const ghostBad = new THREE.Color(0xff7f7f);

function enterPlacement(key) {
    exitPlacement();
    placing.key = key;
    placing.rotY = 0;
    const ghost = buildFactories[key]();
    ghost.traverse((node) => {
        if (node.isMesh) {
            node.material = node.material.clone();
            node.material.transparent = true;
            node.material.opacity = 0.55;
            node.castShadow = false;
        }
    });
    placing.ghost = ghost;
    world.add(ghost);
    document.body.classList.add('placing');
    $('place-bar').classList.add('show');
    $('place-label').textContent = `${buildCatalog[key].icon} ${buildCatalog[key].label}`;
    buildMenuEl.querySelectorAll('.build-choice').forEach((b) => b.classList.toggle('selected', b.dataset.build === key));
    moveGhostTo(villageCenter.x + 18, villageCenter.z + 18);
}
function exitPlacement() {
    if (placing.ghost) world.remove(placing.ghost);
    placing.ghost = null;
    placing.key = null;
    document.body.classList.remove('placing');
    $('place-bar').classList.remove('show');
    buildMenuEl.querySelectorAll('.build-choice').forEach((b) => b.classList.remove('selected'));
}
function placementValidAt(x, z) {
    const def = buildCatalog[placing.key];
    const h = heightAt(x, z);
    if (def.shore) {
        if (h < 0.3 || h > 2.6) return false;
    } else {
        if (h < 1.6 || slopeAt(x, z) > 0.55) return false;
        if (!insideIsland(x, z)) return false;
    }
    for (const item of builtItems) {
        if (Math.hypot(item.x - x, item.z - z) < 11) return false;
    }
    const campProps = [[16, 4], [-4, 26], [9, 18], [25, 22]];
    for (const [cx, cz] of campProps) {
        if (Math.hypot(cx - x, cz - z) < 11) return false;
    }
    return true;
}
function moveGhostTo(x, z) {
    placing.x = x; placing.z = z;
    const lift = placing.key === 'dock' ? Math.max(0, 1.4 - heightAt(x, z)) : 0;
    placing.ghost.position.set(x, heightAt(x, z) + lift, z);
    if (placing.key === 'dock') {
        // auto-face the open sea (down the slope)
        const e = 4;
        const gx = heightAt(x + e, z) - heightAt(x - e, z);
        const gz = heightAt(x, z + e) - heightAt(x, z - e);
        placing.rotY = Math.atan2(-gx, -gz) + Math.PI;
    }
    placing.ghost.rotation.y = placing.rotY;
    placing.valid = placementValidAt(x, z) && canAfford(placing.key);
    const tint = placing.valid ? ghostOK : ghostBad;
    placing.ghost.traverse((node) => {
        if (node.isMesh && node.material.emissive) {
            node.material.emissive.copy(tint);
            node.material.emissiveIntensity = 0.45;
        }
    });
}
function confirmPlacement() {
    if (!placing.key || !placing.valid) {
        if (placing.key) toast('❌ Cannot place there — flat dry ground (or shoreline for docks) with some space needed.');
        return;
    }
    const result = constructBuilding(placing.key, placing.x, placing.z, placing.rotY);
    if (result.ok) {
        saveColony('build');
        exitPlacement();
        refreshHUD();
    } else {
        toast(`❌ ${result.message}`);
    }
}
buildMenuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.build-choice');
    if (!btn || btn.disabled) return;
    enterPlacement(btn.dataset.build);
    if (isMobile) buildPanelEl.classList.remove('open');
});
$('place-rotate').addEventListener('click', () => {
    placing.rotY += Math.PI / 4;
    if (placing.ghost) moveGhostTo(placing.x, placing.z);
});
$('place-confirm').addEventListener('click', confirmPlacement);
$('place-cancel').addEventListener('click', exitPlacement);

/* ---- pointer: ghost tracking, click-select, click-place ---- */
let pointerDownAt = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDownAt = { x: event.clientX, y: event.clientY, t: performance.now() };
});
renderer.domElement.addEventListener('pointermove', (event) => {
    if (!placing.ghost || walkState.enabled) return;
    setPointer(event);
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObject(terrain, false)[0];
    if (hit) moveGhostTo(hit.point.x, hit.point.z);
});
renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerDownAt || walkState.enabled) return;
    const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
    pointerDownAt = null;
    if (moved > 10) return;     // it was a drag
    setPointer(event);
    raycaster.setFromCamera(pointerNDC, camera);
    if (placing.ghost) {
        const hit = raycaster.intersectObject(terrain, false)[0];
        if (hit) {
            moveGhostTo(hit.point.x, hit.point.z);
            if (!isMobile) confirmPlacement();
        }
        return;
    }
    // resident selection
    const meshes = residents.map((r) => r.mesh);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length) {
        let node = hits[0].object;
        while (node && !node.name.startsWith('resident-')) node = node.parent;
        if (node) {
            const found = residents.find((r) => r.mesh === node);
            if (found) { selectResident(found); return; }
        }
    }
});
document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
        if (placing.key) exitPlacement();
        else if (walkState.enabled) exitWalkMode();
        else selectResident(null);
    }
    if (event.code === 'KeyR' && placing.ghost) {
        placing.rotY += Math.PI / 4;
        moveGhostTo(placing.x, placing.z);
    }
    if (event.code === 'KeyB' && !walkState.enabled) buildPanelEl.classList.toggle('open');
});

/* ---- walk mode ---- */
const walkKeys = new Set();
const walkState = { enabled: false, yaw: 0, pitch: -0.04, speed: 30, eyeHeight: 7 };
const walkBtn = $('walk-btn');
const touchPad = $('touch-pad');

function enterWalkMode(requestLock = true) {
    walkState.enabled = true;
    controls.enabled = false;
    followResident = null;
    exitPlacement();
    camera.position.set(villageCenter.x + 6, 0, villageCenter.z + 34);
    walkState.yaw = 0;
    walkState.pitch = -0.02;
    clampWalk();
    updateWalkLook();
    document.body.classList.add('walking');
    walkBtn.textContent = isMobile ? '🚶 Walking — tap to orbit' : '🚶 Walking — Esc to orbit';
    if (!isMobile && requestLock && stage.requestPointerLock) stage.requestPointerLock();
}
function exitWalkMode() {
    walkState.enabled = false;
    walkKeys.clear();
    controls.enabled = true;
    document.body.classList.remove('walking');
    camera.position.set(180, 128, 245);
    controls.target.set(villageCenter.x, 10, villageCenter.z);
    controls.update();
    walkBtn.textContent = '🚶 Walk the island';
    if (document.pointerLockElement === stage && document.exitPointerLock) document.exitPointerLock();
}
function clampWalk() {
    const d = Math.hypot(camera.position.x / (ISLAND.rx * 0.99), camera.position.z / (ISLAND.rz * 0.99));
    if (d > 1) {
        camera.position.x /= d;
        camera.position.z /= d;
    }
    camera.position.y = Math.max(heightAt(camera.position.x, camera.position.z), 0.4) + walkState.eyeHeight;
}
function updateWalkLook() {
    const dir = new THREE.Vector3(
        Math.sin(walkState.yaw) * Math.cos(walkState.pitch),
        Math.sin(walkState.pitch),
        -Math.cos(walkState.yaw) * Math.cos(walkState.pitch)
    );
    camera.lookAt(camera.position.clone().add(dir));
}
walkBtn.addEventListener('click', () => (walkState.enabled && isMobile ? exitWalkMode() : enterWalkMode(true)));
stage.addEventListener('click', () => { if (!isMobile && walkState.enabled && stage.requestPointerLock) stage.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
    if (!isMobile && walkState.enabled && document.pointerLockElement !== stage) exitWalkMode();
});
document.addEventListener('keydown', (event) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        walkKeys.add(event.code);
        if (walkState.enabled) event.preventDefault();
    }
});
document.addEventListener('keyup', (event) => walkKeys.delete(event.code));
document.addEventListener('mousemove', (event) => {
    if (!walkState.enabled || document.pointerLockElement !== stage) return;
    walkState.yaw -= event.movementX * 0.0021;
    walkState.pitch = clamp(walkState.pitch - event.movementY * 0.0017, -0.55, 0.5);
    updateWalkLook();
});
let touchLook = null;
stage.addEventListener('touchstart', (event) => {
    if (!walkState.enabled || event.target.closest('.touch-pad')) return;
    const touch = event.changedTouches[0];
    touchLook = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
}, { passive: true });
stage.addEventListener('touchmove', (event) => {
    if (!walkState.enabled || !touchLook) return;
    const touch = [...event.changedTouches].find((t) => t.identifier === touchLook.id);
    if (!touch) return;
    walkState.yaw -= (touch.clientX - touchLook.x) * 0.004;
    walkState.pitch = clamp(walkState.pitch - (touch.clientY - touchLook.y) * 0.003, -0.55, 0.5);
    touchLook.x = touch.clientX; touchLook.y = touch.clientY;
    updateWalkLook();
    event.preventDefault();
}, { passive: false });
stage.addEventListener('touchend', () => { touchLook = null; }, { passive: true });
touchPad.querySelectorAll('.touch-btn').forEach((btn) => {
    const key = btn.dataset.key;
    const press = (e) => { walkKeys.add(key); e.preventDefault(); };
    const release = (e) => { walkKeys.delete(key); e.preventDefault(); };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
});

/* ============================================================
   15. Save / load + offline catch-up
   ============================================================ */
const SAVE_KEY = 'unknown-island-colony-v19';
let saveTimer = 0;

function saveColony(reason = 'auto') {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
            version: 19,
            reason,
            savedAt: Date.now(),
            day: gameClock.day,
            hour: gameClock.hour,
            storage: { ...communityStorage },
            goals: { ...storageGoals },
            arrivalsDone,
            built: builtItems.map(({ key, x, z, rotY }) => ({ key, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, rotY: Math.round(rotY * 100) / 100 })),
            residents: residents.map((r) => ({
                id: r.profile.id,
                x: Math.round(r.mesh.position.x * 10) / 10,
                z: Math.round(r.mesh.position.z * 10) / 10,
                needs: Object.fromEntries(needDefs.map((d) => [d.key, Math.round(r.needs[d.key])])),
                relationships: r.relationships,
                memories: r.memories.slice(0, 6),
                thought: r.currentThought
            }))
        }));
    } catch { /* storage full or blocked — keep playing */ }
}

function loadColony() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { saved = null; }
    if (!saved || saved.version !== 19) return null;
    gameClock.day = Math.max(1, Number(saved.day) || 1);
    gameClock.hour = clamp(Number(saved.hour) || 9, 0, 24);
    arrivalsDone = clamp(Number(saved.arrivalsDone) || 0, 0, ARRIVAL_POOL.length);
    storageKeys.forEach((key) => {
        if (saved.storage && saved.storage[key] !== undefined) communityStorage[key] = Math.max(0, Number(saved.storage[key]) || 0);
        if (saved.goals && saved.goals[key] !== undefined) storageGoals[key] = Math.max(storageGoals[key], Number(saved.goals[key]) || storageGoals[key]);
    });
    (saved.built || []).forEach((item) => {
        if (buildCatalog[item.key]) constructBuilding(item.key, item.x, item.z, item.rotY || 0, { silent: true, charge: false });
    });
    return saved;
}

function applySavedResidents(saved) {
    if (!saved?.residents) return;
    for (const data of saved.residents) {
        const r = residents.find((res) => res.profile.id === data.id);
        if (!r) continue;
        if (Number.isFinite(data.x) && Number.isFinite(data.z) && insideIsland(data.x, data.z, 1.02)) {
            r.mesh.position.set(data.x, heightAt(data.x, data.z), data.z);
        }
        needDefs.forEach((d) => { if (data.needs?.[d.key] !== undefined) r.needs[d.key] = clamp(Number(data.needs[d.key]), 0, 100); });
        settleNeeds(r.needs);
        if (data.relationships) Object.assign(r.relationships, data.relationships);
        if (Array.isArray(data.memories)) r.memories = data.memories.slice(0, 8);
        if (data.thought) r.currentThought = String(data.thought).slice(0, 160);
    }
}

function offlineCatchup(saved) {
    if (!saved?.savedAt) return;
    const awaySeconds = Math.max(0, (Date.now() - saved.savedAt) / 1000);
    if (awaySeconds < 30) return;
    // While away the island lives at 1/6 speed, capped at 48 game hours
    let hours = clamp((awaySeconds / 60) * (gameClock.minutesPerRealSecond / 60) * 10, 0, 48);
    const wholeDays = Math.floor((gameClock.hour + hours) / 24);
    gameClock.day += wholeDays;
    gameClock.hour = (gameClock.hour + hours) % 24;
    let gathered = 0;
    while (hours > 0) {
        const step = Math.min(2, hours);
        hours -= step;
        for (const r of residents) {
            advanceNeeds(r.needs, step * 0.6);
            // they look after themselves from storage
            if (r.needs.hunger > 50 && ((communityStorage.cookedFish || 0) > 0 || (communityStorage.food || 0) > 0)) {
                const key = (communityStorage.cookedFish || 0) > 0 ? 'cookedFish' : 'food';
                communityStorage[key] -= 1;
                easeNeed(r.needs, 'hunger', 55);
            }
            if (r.needs.thirst > 50 && (communityStorage.water || 0) > 0) {
                communityStorage.water -= 1;
                easeNeed(r.needs, 'thirst', 55);
            }
            if (r.needs.tiredness > 60) easeNeed(r.needs, 'tiredness', 50);
            easeNeed(r.needs, 'boredom', 10);
            easeNeed(r.needs, 'social', 8);
        }
        // and they keep gathering a little
        const deficits = storageKeys.filter((k) => storageDeficit(k) > 0 && resourceFlavor[k]);
        if (deficits.length) {
            const key = deficits[Math.floor(Math.random() * deficits.length)];
            communityStorage[key] = (communityStorage[key] || 0) + 1;
            gathered++;
        }
    }
    const away = awaySeconds < 3600 ? `${Math.floor(awaySeconds / 60)}m` : awaySeconds < 86400 ? `${Math.floor(awaySeconds / 3600)}h` : `${Math.floor(awaySeconds / 86400)}d`;
    toast(`🏝 While you were away (${away}), the colony looked after itself${gathered ? ` and gathered ${gathered} supplies` : ''}.`);
}

/* ============================================================
   16. Debug / test surface
   ============================================================ */
function publishDebugState() {
    const o = window.__unknownOcean;
    o.day = gameClock.day;
    o.hour = Math.round(gameClock.hour * 10) / 10;
    o.weather = weather.state;
    o.storage = { ...communityStorage };
    o.build = { items: builtItems.map(({ key }) => ({ key, label: buildCatalog[key].label })) };
    o.placing = placing.key ? { key: placing.key, x: Math.round(placing.x), z: Math.round(placing.z), valid: placing.valid } : null;
    o.residents = residents.map((r) => ({
        id: r.profile.id,
        name: r.profile.name,
        state: r.ai.state,
        action: r.ai.plan?.action || r.ai.state,
        thought: r.currentThought,
        needs: Object.fromEntries(needDefs.map((d) => [d.key, Math.round(r.needs[d.key])])),
        topTraits: topTraits(r.profile, 4)
    }));
    o.community = { storage: o.storage, residents: o.residents };
}
window.__unknownOcean.brainSystem = 'utility-traits-ocean-memory-social + optional per-resident LLM personas';
window.__unknownOcean.communitySimulation = 'island-colony-v19-needs-jobs-social-buildings-daynight-weather';
window.__unknownOcean.playerBuildMode = 'free-placement-raycast-ghost-14-buildables';
window.__unknownOcean.lajModelIntegration = 'connect an OpenAI-compatible key in the Brains panel: per-resident personas think/say/set goals';
window.__unknownOcean.buildItem = (key, x = villageCenter.x + 20, z = villageCenter.z + 20, rotY = 0) => constructBuilding(key, x, z, rotY);
window.__unknownOcean.forceStorage = (key, value) => {
    if (!storageKeys.includes(key)) return { ok: false };
    communityStorage[key] = Math.max(0, Number(value) || 0);
    refreshHUD();
    return { ok: true, storage: { ...communityStorage } };
};
window.__unknownOcean.forceCharacterNeed = (name, key, value) => {
    const r = residents.find((res) => res.profile.name.toLowerCase().includes(String(name).toLowerCase()));
    if (!r || r.needs[key] === undefined) return { ok: false };
    r.needs[key] = clamp(Number(value) || 0, 0, 100);
    settleNeeds(r.needs);
    r.ai.state = 'thinking';
    r.ai.timer = 0;
    r.ai.plan = null;
    return { ok: true, needs: { ...r.needs } };
};
window.__unknownOcean.forceCommunityTick = (seconds = 60) => {
    const hours = (seconds * gameClock.minutesPerRealSecond) / 3600;
    residents.forEach((r) => updateResident(r, hours, seconds * 0.016));
    refreshHUD();
    return window.__unknownOcean.community;
};
window.__unknownOcean.setTimeOfDay = (hour) => {
    gameClock.hour = clamp(Number(hour) || 12, 0, 24);
    updateDayNight(true);
    return gameClock.hour;
};
window.__unknownOcean.enterWalkMode = () => enterWalkMode(false);
window.__unknownOcean.exitWalkMode = exitWalkMode;
window.__unknownOcean.enterPlacement = enterPlacement;
window.__unknownOcean.confirmPlacement = confirmPlacement;
window.__unknownOcean.cancelPlacement = exitPlacement;
window.__unknownOcean.saveColony = () => { saveColony('manual'); return 'saved'; };
window.__unknownOcean.clearSave = () => { localStorage.removeItem(SAVE_KEY); return 'cleared'; };

/* ============================================================
   17. Main loop
   ============================================================ */
const clock = new THREE.Clock();
let hudTimer = 0;

function animateAmbience(elapsed, delta) {
    windUniform.value = elapsed;
    water.material.uniforms.time.value += delta * 0.7;
    foamRing.material.opacity = 0.22 + Math.sin(elapsed * 1.4) * 0.1;
    foamRing.scale.setScalar(1);
    foamRing.scale.set(ISLAND.rx * (0.838 + Math.sin(elapsed * 0.7) * 0.006), ISLAND.rz * (0.838 + Math.sin(elapsed * 0.7) * 0.006), 1);

    // trees sway
    for (const tree of trees) {
        const crown = tree.userData.crown;
        const phase = tree.userData.sway || 0;
        if (crown) crown.rotation.z = Math.sin(elapsed * 0.9 + phase) * 0.05;
        else tree.rotation.z = Math.sin(elapsed * 0.7 + phase) * 0.012;
    }
    // clouds drift
    for (const cloud of cloudGroup.children) {
        cloud.position.x += cloud.userData.speed * delta;
        if (cloud.position.x > 1500) cloud.position.x = -1500;
    }
    // bonfire & fire pits flicker
    const fires = [props.bonfire, ...builtItems.filter((b) => b.key === 'firePit').map((b) => b.mesh)];
    const night = 1 - smoothstep(-4, 10, sunElevation());
    for (const fire of fires) {
        const flames = fire.userData?.flames;
        if (flames) flames.forEach((flame, i) => {
            flame.scale.setScalar(1 + Math.sin(elapsed * 5.4 + i * 2.4) * 0.12);
            flame.material.opacity = 0.62 + Math.sin(elapsed * 4.7 + i) * 0.14;
        });
        const light = fire.userData?.light;
        if (light) light.intensity = (1.2 + night * 5.4) * (1 + Math.sin(elapsed * 7.3) * 0.14);
    }
    // hut + cabin lanterns at night
    world.traverse((node) => {
        if (node.isPointLight && (node.name === 'hut-lantern' || node.name === 'cabin-lantern')) {
            node.intensity = night * 3.6;
        }
    });
    // kite bob
    if (props.kite) {
        props.kite.position.y = heightAt(-34, -16) + 16 + Math.sin(elapsed * 1.2) * 1.6;
        props.kite.rotation.z = Math.sin(elapsed * 1.05) * 0.1;
    }
    // colony flag
    const flag = flagPole.getObjectByName('colony-flag');
    if (flag) flag.rotation.y = Math.sin(elapsed * 2.2) * 0.22;
    // windmill hubs
    for (const item of builtItems) {
        if (item.key !== 'windmill') continue;
        const hub = item.mesh.getObjectByName('windmill-hub');
        if (hub) hub.rotation.z += delta * (0.8 + night * 0.2);
    }
    // gulls
    for (const gull of gulls) {
        const u = gull.userData;
        u.angle += delta * u.speed;
        gull.position.set(Math.cos(u.angle) * u.radius, u.height + Math.sin(elapsed + u.radius) * 4, Math.sin(u.angle) * u.radius);
        gull.rotation.y = -u.angle;
        const flap = Math.sin(elapsed * 7 + u.radius) * 0.5;
        const wl = gull.getObjectByName('wing-l'), wr = gull.getObjectByName('wing-r');
        if (wl) wl.rotation.z = flap;
        if (wr) wr.rotation.z = -flap;
        gull.visible = night < 0.7;
    }
    // butterflies (daytime only)
    for (const fly of butterflies) {
        const u = fly.userData;
        const t = elapsed * u.speed + u.phase;
        const x = u.cx + Math.sin(t) * 9 + Math.sin(t * 2.3) * 3;
        const z = u.cz + Math.cos(t * 0.8) * 9;
        fly.position.set(x, heightAt(x, z) + 3.4 + Math.sin(t * 3) * 0.8, z);
        fly.rotation.y = t;
        const flap = Math.sin(elapsed * 16 + u.phase) * 0.8;
        const wl = fly.getObjectByName('wing-l'), wr = fly.getObjectByName('wing-r');
        if (wl) wl.rotation.y = flap;
        if (wr) wr.rotation.y = -flap;
        fly.visible = night < 0.4 && weather.state !== 'rain';
    }
    // rain falls
    if (rain.visible) {
        const positions = rain.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            let y = positions.getY(i) - delta * 110;
            if (y < 0) y = 200 + Math.random() * 20;
            positions.setY(i, y);
        }
        positions.needsUpdate = true;
    }
    // build pop animation
    for (let i = buildPops.length - 1; i >= 0; i--) {
        const pop = buildPops[i];
        pop.t += delta * 2.4;
        const s = pop.t >= 1 ? 1 : 1 - Math.pow(1 - pop.t, 3);
        pop.mesh.scale.setScalar(0.05 + s * 0.95);
        if (pop.t >= 1) { pop.mesh.scale.setScalar(1); buildPops.splice(i, 1); }
    }
    // bubbles: face camera handled by sprites; expire them
    const now = performance.now() / 1000;
    for (const r of residents) {
        const bubble = r.mesh.userData.bubble;
        if (bubble.visible && now > bubble.userData.hideAt) bubble.visible = false;
        // idle bob for sleeping Zzz
        if (r.ai.state === 'sleeping' && Math.random() < delta * 0.25) {
            showBubble(bubble, '💤', 'thought', 3);
        }
    }
    // glow strength on hut door/window
    const glowMat = MAT.glow;
    glowMat.color.setHSL(0.11, 0.9, 0.45 + night * 0.3);
}

function tick() {
    const delta = Math.min(clock.getDelta(), 0.06);
    const elapsed = clock.elapsedTime;

    // game time
    const simMinutes = delta * gameClock.speed * gameClock.minutesPerRealSecond;
    const simHours = simMinutes / 60;
    if (simHours > 0) {
        gameClock.hour += simHours;
        if (gameClock.hour >= 24) {
            gameClock.hour -= 24;
            gameClock.day += 1;
            toast(`🌅 Day ${gameClock.day} on the island.`);
        }
        updateWeather(simHours);
        maybeRaftArrival();
    }
    updateDayNight();

    // residents
    for (const r of residents) updateResident(r, simHours, delta);
    brain.update();

    // ambient world
    animateAmbience(elapsed, delta);

    // camera
    if (walkState.enabled) {
        const forward = Number(walkKeys.has('KeyW') || walkKeys.has('ArrowUp')) - Number(walkKeys.has('KeyS') || walkKeys.has('ArrowDown'));
        const strafe = Number(walkKeys.has('KeyD') || walkKeys.has('ArrowRight')) - Number(walkKeys.has('KeyA') || walkKeys.has('ArrowLeft'));
        const sprint = walkKeys.has('ShiftLeft') || walkKeys.has('ShiftRight') ? 1.8 : 1;
        const step = walkState.speed * sprint * delta;
        const sin = Math.sin(walkState.yaw), cos = Math.cos(walkState.yaw);
        camera.position.x += (sin * forward + cos * strafe) * step;
        camera.position.z += (-cos * forward + sin * strafe) * step;
        clampWalk();
        updateWalkLook();
    } else {
        if (followResident) {
            controls.target.lerp(new THREE.Vector3(
                followResident.mesh.position.x,
                followResident.mesh.position.y + 6,
                followResident.mesh.position.z
            ), Math.min(1, delta * 3));
        }
        controls.update();
    }

    // HUD refresh
    hudTimer += delta;
    if (hudTimer > 0.45) {
        hudTimer = 0;
        refreshHUD();
        updateClockUI();
    }
    saveTimer += delta;
    if (saveTimer > 7) {
        saveTimer = 0;
        saveColony('heartbeat');
    }

    if (composer) composer.render();
    else renderer.render(scene, camera);
    window.__unknownOcean.status = 'rendering';
    requestAnimationFrame(tick);
}

/* ---- post processing ---- */
const composer = quality.bloom ? new EffectComposer(renderer) : null;
if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.3, 0.82));
}

function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
addEventListener('beforeunload', () => saveColony('beforeunload'));
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveColony('hidden');
});
window.addEventListener('error', (event) => {
    window.__unknownOceanErrors.push(String(event.message || event.error));
    if (window.__unknownOcean.status !== 'rendering') {
        loaderEl.classList.add('hidden');
        errorBox.style.display = 'block';
        window.__unknownOcean.status = 'error';
    }
});

/* ============================================================
   18. Boot
   ============================================================ */
try {
    bootStep('waking the colonists…');
    const saved = loadColony();

    PROFILES.forEach((profile, i) => {
        const a = (i / PROFILES.length) * Math.PI * 2;
        spawnResident(profile, villageCenter.x + Math.cos(a) * 18, villageCenter.z + Math.sin(a) * 16);
    });
    for (let i = 0; i < arrivalsDone; i++) {
        spawnResident(ARRIVAL_POOL[i], villageCenter.x - 24 + i * 8, villageCenter.z + 24);
    }
    applySavedResidents(saved);
    offlineCatchup(saved);

    updateDayNight(true);
    updateBrainUI();
    refreshHUD();
    updateClockUI();
    if (!saved) toast('🏝 Welcome to Unknown. Seven colonists, one island. Click Build to help them — or just watch them live.', 8);

    window.__unknownOcean.island = 'procedural-heightmap-island-v19';
    window.__unknownOcean.residentCount = residents.length;

    requestAnimationFrame(() => {
        loaderEl.classList.add('hidden');
        tick();
    });
} catch (error) {
    console.error('Unknown island failed to start', error);
    window.__unknownOcean.status = 'error';
    window.__unknownOceanErrors.push(String((error && error.stack) || error));
    loaderEl.classList.add('hidden');
    errorBox.style.display = 'block';
}
