// QuarryPro - 3D Site Map using Three.js

class Map3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.terrain = null;
        this.vehicleMarkers = {};
        this.gridHelper = null;
        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d1117);
        this.scene.fog = new THREE.Fog(0x0d1117, 50, 200);

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.set(40, 30, 40);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lights — boosted for satellite texture visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(0, 80, 0);  // directly above for even lighting
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -60;
        directionalLight.shadow.camera.right = 60;
        directionalLight.shadow.camera.top = 60;
        directionalLight.shadow.camera.bottom = -60;
        this.scene.add(directionalLight);

        // Grid
        this.gridHelper = new THREE.GridHelper(100, 20, 0x30363d, 0x21262d);
        this.scene.add(this.gridHelper);

        // Create terrain
        this.createTerrain();

        // Orbit Controls (manual implementation)
        this.setupControls();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Start animation
        this.animate();
    }

    createTerrain() {
        // Main ground plane with terrain displacement
        const groundGeometry = new THREE.PlaneGeometry(100, 100, 80, 80);
        const vertices = groundGeometry.attributes.position.array;

        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const distanceFromCenter = Math.sqrt(x * x + y * y);
            let elevation = 0;
            if (distanceFromCenter < 20) {
                elevation = -10 + (distanceFromCenter / 20) * 10;
            } else if (distanceFromCenter < 35) {
                elevation = (distanceFromCenter - 20) * 0.3;
            } else {
                elevation = Math.sin(x * 0.08) * 1.2 + Math.cos(y * 0.08) * 1.2;
            }
            vertices[i + 2] = elevation;
        }
        groundGeometry.computeVertexNormals();

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x8a8070,  // fallback limestone colour while texture loads
            roughness: 0.95,
            metalness: 0.05
        });

        // Load satellite map texture asynchronously
        const loader = new THREE.TextureLoader();
        loader.load(
            'images/bankfield_satellite.jpg',
            (texture) => {
                groundMaterial.map = texture;
                groundMaterial.color.set(0xffffff); // let texture show true colours
                groundMaterial.needsUpdate = true;
            },
            undefined,
            (err) => console.warn('Map texture failed to load, using fallback colour', err)
        );

        this.terrain = new THREE.Mesh(groundGeometry, groundMaterial);
        this.terrain.rotation.x = -Math.PI / 2;
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        // Quarry face wall (southern bench)
        const faceGeometry = new THREE.BoxGeometry(35, 14, 3);
        const faceMaterial = new THREE.MeshStandardMaterial({
            color: 0xa8a89a,  // limestone grey-white
            roughness: 1
        });
        const quarryFace = new THREE.Mesh(faceGeometry, faceMaterial);
        quarryFace.position.set(0, -3, -18);
        quarryFace.receiveShadow = true;
        quarryFace.castShadow = true;
        this.scene.add(quarryFace);

        // Processing plant building
        const plantGeo = new THREE.BoxGeometry(8, 6, 6);
        const plantMat = new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: 0.8 });
        const plant = new THREE.Mesh(plantGeo, plantMat);
        plant.position.set(30, 3, -25);
        plant.castShadow = true;
        this.scene.add(plant);

        // Stockpile cone
        const stockGeo = new THREE.ConeGeometry(6, 4, 8);
        const stockMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 1 });
        const stockpile = new THREE.Mesh(stockGeo, stockMat);
        stockpile.position.set(22, 2, -20);
        stockpile.castShadow = true;
        this.scene.add(stockpile);

        // Site label
        this.addSiteLabel();
    }

    addSiteLabel() {
        // Compass rose - north indicator
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('N', 64, 45);
        ctx.beginPath();
        ctx.moveTo(64, 55); ctx.lineTo(64, 100);
        ctx.moveTo(64, 55); ctx.lineTo(54, 70); ctx.lineTo(74, 70);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        const compassGeo = new THREE.PlaneGeometry(8, 8);
        const compassMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        const compass = new THREE.Mesh(compassGeo, compassMat);
        compass.rotation.x = -Math.PI / 2;
        compass.position.set(42, 0.1, 42);
        this.scene.add(compass);
    }

    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let rotation = { x: -0.3, y: 0.8 };
        let distance = 60;

        this.container.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.container.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;
                
                rotation.y += deltaX * 0.005;
                rotation.x += deltaY * 0.005;
                
                // Limit vertical rotation
                rotation.x = Math.max(-Math.PI / 2, Math.min(0, rotation.x));
                
                previousMousePosition = { x: e.clientX, y: e.clientY };
                this.updateCameraPosition(rotation, distance);
            }
        });

        this.container.addEventListener('mouseup', () => {
            isDragging = false;
        });

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            distance += e.deltaY * 0.05;
            distance = Math.max(10, Math.min(150, distance));
            this.updateCameraPosition(rotation, distance);
        });

        // Store for reset
        this.defaultRotation = { ...rotation };
        this.defaultDistance = distance;
    }

    updateCameraPosition(rotation, distance) {
        this.camera.position.x = Math.sin(rotation.y) * Math.cos(rotation.x) * distance;
        this.camera.position.y = Math.sin(rotation.x) * distance * -1;
        this.camera.position.z = Math.cos(rotation.y) * Math.cos(rotation.x) * distance;
        this.camera.lookAt(0, 0, 0);
    }

    resetView() {
        this.updateCameraPosition(this.defaultRotation, this.defaultDistance);
    }

    toggleGrid() {
        this.gridHelper.visible = !this.gridHelper.visible;
    }

    addVehicleMarker(id, name, type, position = null) {
        if (this.vehicleMarkers[id]) {
            this.scene.remove(this.vehicleMarkers[id]);
        }

        // Fixed positions for each machine type
        const fixedPositions = {
            dump_truck: [
                { x: -8, z: -5 },
                { x: 5, z: 8 },
                { x: -15, z: 10 },
            ],
            excavator: [
                { x: -12, z: -12 },
                { x: 10, z: -14 },
            ],
            crusher: [
                { x: 28, z: -22 },
                { x: 32, z: -18 },
            ],
            screener: [
                { x: 25, z: -28 },
                { x: 30, z: -28 },
            ],
        };

        if (!position) {
            const key = type.replace('dump_truck','dump_truck').toLowerCase();
            const pool = fixedPositions[key] || [];
            const used = Object.values(this.vehicleMarkers).filter(m => m.userData.type === type).length;
            position = pool[used] || {
                x: (Math.random() - 0.5) * 60,
                z: (Math.random() - 0.5) * 60
            };
        }

        // Different geometry + colour per type
        let geometry, color;
        switch(type) {
            case 'dump_truck':
                geometry = new THREE.BoxGeometry(3, 1.5, 4.5);
                color = 0xf5a623; // orange — Komatsu yellow
                break;
            case 'excavator':
                geometry = new THREE.BoxGeometry(2.5, 2, 3);
                color = 0xf5a623; // yellow
                break;
            case 'crusher':
                geometry = new THREE.BoxGeometry(5, 4, 5);
                color = 0x6b7280; // industrial grey
                break;
            case 'screener':
                geometry = new THREE.BoxGeometry(4, 3, 6);
                color = 0x4b5563;
                break;
            default:
                geometry = new THREE.ConeGeometry(1, 3, 4);
                color = 0x3fb950;
        }

        const material = new THREE.MeshStandardMaterial({ color });
        const marker = new THREE.Mesh(geometry, material);
        marker.userData = { type, name };

        const yOffset = type === 'crusher' || type === 'screener' ? 2 : 1.5;
        marker.position.set(position.x, yOffset, position.z);
        marker.castShadow = true;

        // Label above machine
        this.vehicleMarkers[id] = marker;
        this.scene.add(marker);
    }

    updateVehicleMarker(id, status) {
        if (this.vehicleMarkers[id]) {
            const colors = {
                working: 0x3fb950,
                idle: 0xd29922,
                maintenance: 0xf85149,
                breakdown: 0xf85149
            };
            this.vehicleMarkers[id].material.color.setHex(colors[status] || 0x3fb950);
        }
    }

    removeVehicleMarker(id) {
        if (this.vehicleMarkers[id]) {
            this.scene.remove(this.vehicleMarkers[id]);
            delete this.vehicleMarkers[id];
        }
    }

    onResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize map lazily — only when container is visible
// (DOMContentLoaded fires while map-container is hidden, giving 0x0 dimensions)
let map3d;
let map3dInitialised = false;

function initMap3DIfNeeded() {
    if (map3dInitialised) {
        // Already init — just trigger a resize to fix any stale dimensions
        if (map3d) map3d.onResize();
        return;
    }
    const container = document.getElementById('map3d');
    if (!container || container.clientWidth === 0) return; // Still hidden
    map3dInitialised = true;
    map3d = new Map3D('map3d');
}

document.addEventListener('DOMContentLoaded', () => {
    // Map controls (always register if present — older UI builds may not render these buttons)
    const reset = document.getElementById('resetView');
    const grid = document.getElementById('toggleGrid');
    if (reset) reset.addEventListener('click', () => { if (map3d) map3d.resetView(); });
    if (grid) grid.addEventListener('click', () => { if (map3d) map3d.toggleGrid(); });
});
