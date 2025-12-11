import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.objects = []; // For collision detection (walls, obstacles)
        this.collidables = []; // For bullet collision
        this.weaponPickups = []; // Weapon pickups on the map

        this.initLights();
        this.initEnvironment();
        this.initMap();
        this.initWeaponPickups();
    }

    initLights() {
        // Very dim ambient light for gloomy atmosphere
        const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.3);
        this.scene.add(ambientLight);

        // Dim, cold directional light (moonlight)
        const dirLight = new THREE.DirectionalLight(0x4a5568, 0.4);
        dirLight.position.set(-30, 40, -20);
        dirLight.castShadow = true;

        // Shadow properties
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.bias = -0.001;

        this.scene.add(dirLight);

        // Add some eerie point lights scattered around (like dim lamps or glowing things)
        this.addPointLight(0xff4400, 0.5, 8, new THREE.Vector3(15, 3, 15));
        this.addPointLight(0x00ff88, 0.4, 6, new THREE.Vector3(-20, 2, -10));
        this.addPointLight(0xff0066, 0.3, 5, new THREE.Vector3(0, 2, -25));
        this.addPointLight(0x8844ff, 0.4, 7, new THREE.Vector3(-15, 2, 20));
    }

    addPointLight(color, intensity, distance, position) {
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.copy(position);
        light.castShadow = true;
        light.shadow.mapSize.width = 256;
        light.shadow.mapSize.height = 256;
        this.scene.add(light);
    }

    initEnvironment() {
        // Dark, gritty floor with PSX-style low-res texture feel
        const floorGeometry = new THREE.PlaneGeometry(100, 100, 10, 10);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.95,
            metalness: 0.1,
            flatShading: true // PSX style flat shading
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.objects.push(floor);
    }

    initMap() {
        // PSX-style materials (flat shading, muted dark colors)
        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0x2d2d3a, 
            roughness: 0.9,
            flatShading: true 
        });
        const wallMat2 = new THREE.MeshStandardMaterial({ 
            color: 0x3a2d2d, 
            roughness: 0.9,
            flatShading: true 
        });
        const pillarMat = new THREE.MeshStandardMaterial({ 
            color: 0x252530, 
            roughness: 0.85,
            flatShading: true 
        });
        const crateMat = new THREE.MeshStandardMaterial({ 
            color: 0x4a3a2a, 
            roughness: 0.95,
            flatShading: true 
        });
        const metalMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a3a40, 
            roughness: 0.6,
            metalness: 0.4,
            flatShading: true 
        });
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a35,
            roughness: 0.8,
            metalness: 0.2,
            flatShading: true
        });
        const rampMat = new THREE.MeshStandardMaterial({
            color: 0x353540,
            roughness: 0.85,
            flatShading: true
        });
        const rustyMat = new THREE.MeshStandardMaterial({
            color: 0x5a3a2a,
            roughness: 0.95,
            flatShading: true
        });

        // ===== OUTER WALLS (Arena boundary) =====
        this.createWall(50, 8, 2, 0, 4, -50, wallMat);   // North wall
        this.createWall(50, 8, 2, 0, 4, 50, wallMat);    // South wall
        this.createWall(2, 8, 50, -50, 4, 0, wallMat);   // West wall
        this.createWall(2, 8, 50, 50, 4, 0, wallMat);    // East wall

        // Corner towers with platforms
        this.createCornerTower(-45, -45, pillarMat, platformMat);
        this.createCornerTower(45, -45, pillarMat, platformMat);
        this.createCornerTower(-45, 45, pillarMat, platformMat);
        this.createCornerTower(45, 45, pillarMat, platformMat);

        // ===== CENTRAL ELEVATED STRUCTURE =====
        // Main platform (elevated central area)
        this.createPlatform(16, 3, 16, 0, 1.5, 0, platformMat);
        
        // Ramps to central platform
        this.createRamp(4, 3, 8, 0, 1.5, -12, 0, rampMat); // North ramp
        this.createRamp(4, 3, 8, 0, 1.5, 12, Math.PI, rampMat); // South ramp
        this.createRamp(8, 3, 4, -12, 1.5, 0, -Math.PI/2, rampMat); // West ramp
        this.createRamp(8, 3, 4, 12, 1.5, 0, Math.PI/2, rampMat); // East ramp

        // Central ruins on the platform
        this.createWall(8, 4, 1, 0, 5, -5, wallMat2);
        this.createWall(8, 4, 1, 0, 5, 5, wallMat2);
        this.createWall(1, 4, 5, -4, 5, 0, wallMat2);
        this.createWall(1, 4, 5, 4, 5, 0, wallMat2);

        // Second level platform (smaller, on top)
        this.createPlatform(6, 0.5, 6, 0, 5.5, 0, metalMat);
        this.createCrate(1, 1, 1, 2, 6.5, 2, crateMat); // Small cover on top

        // Central pillars supporting upper level
        this.createPillar(1.5, 5.5, -2, -2, pillarMat);
        this.createPillar(1.5, 5.5, 2, -2, pillarMat);
        this.createPillar(1.5, 5.5, -2, 2, pillarMat);
        this.createPillar(1.5, 5.5, 2, 2, pillarMat);

        // ===== ELEVATED WALKWAYS =====
        // North walkway (connects to central)
        this.createPlatform(4, 0.5, 20, 0, 3.5, -28, platformMat);
        this.createRailing(4, 1, 0.1, -2, 4.5, -28, metalMat);
        this.createRailing(4, 1, 0.1, 2, 4.5, -28, metalMat);

        // Connection ramp from walkway to central
        this.createRamp(4, 2, 6, 0, 4.5, -16, 0, rampMat);

        // South walkway
        this.createPlatform(4, 0.5, 18, 0, 3.5, 28, platformMat);
        this.createRailing(4, 1, 0.1, -2, 4.5, 28, metalMat);
        this.createRailing(4, 1, 0.1, 2, 4.5, 28, metalMat);

        // ===== SNIPER TOWERS =====
        // Northwest sniper nest
        this.createSniperTower(-35, -25, pillarMat, platformMat, metalMat);
        
        // Southeast sniper nest
        this.createSniperTower(35, 25, pillarMat, platformMat, metalMat);

        // ===== MULTI-LEVEL BUILDING - WEST =====
        // Ground floor
        this.createWall(12, 4, 1, -35, 2, -5, wallMat);
        this.createWall(12, 4, 1, -35, 2, 5, wallMat);
        this.createWall(1, 4, 5, -41, 2, 0, wallMat);
        this.createWall(1, 4, 3.5, -29, 2, -3.25, wallMat); // Door frame
        this.createWall(1, 4, 3.5, -29, 2, 3.25, wallMat);  // Door frame
        
        // First floor platform
        this.createPlatform(12, 0.5, 10, -35, 4.25, 0, platformMat);
        
        // Stairs inside
        this.createStairs(-32, 2, 0, 4, 4.25, rampMat);
        
        // Second floor partial
        this.createPlatform(8, 0.5, 6, -37, 7, 0, platformMat);
        this.createWall(8, 3, 0.5, -37, 8.75, -3, wallMat2);
        this.createWall(0.5, 3, 6, -41, 8.75, 0, wallMat2);

        // ===== MULTI-LEVEL BUILDING - EAST =====
        // Ground floor
        this.createWall(10, 4, 1, 35, 2, -8, wallMat2);
        this.createWall(10, 4, 1, 35, 2, 8, wallMat2);
        this.createWall(1, 4, 8, 40, 2, 0, wallMat2);
        this.createWall(1, 4, 4, 30, 2, -6, wallMat2);
        this.createWall(1, 4, 4, 30, 2, 6, wallMat2);
        
        // Floor and roof
        this.createPlatform(10, 0.5, 16, 35, 4.25, 0, platformMat);
        
        // Internal cover
        this.createCrate(2, 2, 2, 36, 5.25, 0, crateMat);
        this.createCrate(1.5, 1.5, 1.5, 33, 5, -4, crateMat);

        // External ramp to roof
        this.createRamp(3, 4.25, 8, 32, 2.125, -14, 0, rampMat);

        // ===== UNDERGROUND PIT - CENTER SOUTH =====
        // Sunken area with ramps
        this.createPit(12, 2, 12, 20, -1, 35, platformMat, rampMat);

        // ===== SCATTERED COVER =====
        // Crate clusters - Northeast
        this.createCrate(2, 2, 2, 25, 1, -20, crateMat);
        this.createCrate(2, 2, 2, 27, 1, -18, crateMat);
        this.createCrate(2, 1.5, 2, 26, 2.75, -19, crateMat);
        this.createCrate(1.5, 3, 1.5, 24, 1.5, -22, crateMat);

        // Crate cluster - Southwest
        this.createCrate(3, 2, 3, -28, 1, 32, crateMat);
        this.createCrate(2, 2, 2, -25, 1, 34, crateMat);
        this.createCrate(2, 4, 2, -30, 2, 30, crateMat);

        // Crate cluster - Southeast
        this.createCrate(2, 2.5, 2, 15, 1.25, 15, crateMat);
        this.createCrate(2, 2, 2, 18, 1, 13, crateMat);

        // ===== BARRIERS AND LOW WALLS =====
        // Barrier wall - center west
        this.createWall(1.5, 3.5, 10, -20, 1.75, -20, wallMat2);
        this.createWall(8, 2, 1, -15, 1, -25, wallMat);

        // Low cover walls
        this.createWall(6, 1.5, 1, 15, 0.75, -30, wallMat);
        this.createWall(1, 1.5, 6, 18, 0.75, -33, wallMat);
        
        this.createWall(8, 2, 1, -10, 1, 20, wallMat2);
        this.createWall(1, 2, 6, -14, 1, 23, wallMat2);

        // ===== PILLARS AND COLUMNS =====
        this.createPillar(1.5, 6, 25, -38, pillarMat);
        this.createPillar(1.5, 6, -38, -35, pillarMat);
        this.createPillar(1.5, 6, -25, 38, pillarMat);
        this.createPillar(1.5, 6, 38, 15, pillarMat);
        this.createPillar(1.5, 6, 10, 38, pillarMat);
        this.createPillar(1.5, 6, -15, -10, pillarMat);

        // ===== METAL STRUCTURES =====
        // Industrial debris
        this.createCrate(1, 3, 4, -12, 1.5, -35, metalMat);
        this.createCrate(1, 3, 4, 8, 1.5, -38, metalMat);
        
        // Metal platforms
        this.createPlatform(6, 0.3, 6, 38, 0.15, -38, metalMat);
        this.createPlatform(5, 0.3, 5, -40, 0.15, 38, metalMat);

        // ===== RUINED VEHICLES =====
        this.createVehicle(-38, -15, 0.3, rustyMat, metalMat);
        this.createVehicle(20, 25, -0.5, rustyMat, metalMat);
        this.createVehicle(30, -35, 1.2, rustyMat, metalMat);

        // ===== BRIDGES =====
        // Bridge over pit
        this.createPlatform(3, 0.4, 14, 20, 0.5, 35, metalMat);
        this.createRailing(3, 1, 0.1, 18.5, 1, 35, metalMat);
        this.createRailing(3, 1, 0.1, 21.5, 1, 35, metalMat);
    }

    createCornerTower(x, z, pillarMat, platformMat) {
        // Main pillar
        this.createPillar(4, 10, x, z, pillarMat);
        // Platform on top
        this.createPlatform(6, 0.5, 6, x, 5.25, z, platformMat);
        // Ladder representation (just visual, not climbable)
        this.createCrate(0.3, 5, 0.1, x + 2.5, 2.5, z, new THREE.MeshStandardMaterial({ color: 0x444444, flatShading: true }));
    }

    createSniperTower(x, z, pillarMat, platformMat, metalMat) {
        // Four support pillars
        this.createPillar(1, 7, x - 2, z - 2, pillarMat);
        this.createPillar(1, 7, x + 2, z - 2, pillarMat);
        this.createPillar(1, 7, x - 2, z + 2, pillarMat);
        this.createPillar(1, 7, x + 2, z + 2, pillarMat);
        
        // Platform
        this.createPlatform(6, 0.4, 6, x, 7.2, z, platformMat);
        
        // Railings
        this.createRailing(6, 1.2, 0.15, x, 8, z - 3, metalMat);
        this.createRailing(6, 1.2, 0.15, x, 8, z + 3, metalMat);
        this.createRailing(0.15, 1.2, 6, x - 3, 8, z, metalMat);
        this.createRailing(0.15, 1.2, 6, x + 3, 8, z, metalMat);
        
        // Access ramp
        this.createRamp(3, 7.2, 12, x, 3.6, z - 9, 0, new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.7, flatShading: true }));
    }

    createStairs(x, y, z, width, height, material) {
        const steps = 8;
        const stepHeight = height / steps;
        const stepDepth = width / steps;
        
        for (let i = 0; i < steps; i++) {
            const stepGeo = new THREE.BoxGeometry(2, stepHeight, stepDepth);
            const step = new THREE.Mesh(stepGeo, material);
            step.position.set(x + i * stepDepth * 0.5, y + (i + 0.5) * stepHeight, z);
            step.castShadow = true;
            step.receiveShadow = true;
            step.userData.isCollidable = true;
            this.scene.add(step);
            this.objects.push(step);
            this.collidables.push(step);
        }
    }

    createPit(width, depth, length, x, y, z, wallMat, rampMat) {
        // Sunken floor
        const floorGeo = new THREE.BoxGeometry(width, 0.5, length);
        const floor = new THREE.Mesh(floorGeo, wallMat);
        floor.position.set(x, y - depth + 0.25, z);
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // Pit walls
        this.createWall(width, depth, 0.5, x, y - depth/2, z - length/2, wallMat);
        this.createWall(width, depth, 0.5, x, y - depth/2, z + length/2, wallMat);
        this.createWall(0.5, depth, length, x - width/2, y - depth/2, z, wallMat);
        this.createWall(0.5, depth, length, x + width/2, y - depth/2, z, wallMat);
        
        // Ramps into pit
        this.createRamp(3, depth, 5, x, y - depth/2, z - length/2 - 2.5, 0, rampMat);
        this.createRamp(3, depth, 5, x, y - depth/2, z + length/2 + 2.5, Math.PI, rampMat);
    }

    createVehicle(x, z, rotation, bodyMat, metalMat) {
        const group = new THREE.Group();
        
        // Main body
        const bodyGeo = new THREE.BoxGeometry(3, 1.5, 5);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.75;
        group.add(body);
        
        // Cab
        const cabGeo = new THREE.BoxGeometry(2.5, 1, 2);
        const cab = new THREE.Mesh(cabGeo, bodyMat);
        cab.position.set(0, 1.75, -1);
        group.add(cab);
        
        // Wheels (simplified boxes)
        const wheelGeo = new THREE.BoxGeometry(0.5, 0.8, 0.8);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true });
        
        [-1.5, 1.5].forEach(xOff => {
            [-1.5, 1.5].forEach(zOff => {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.position.set(xOff, 0.4, zOff);
                group.add(wheel);
            });
        });
        
        group.position.set(x, 0, z);
        group.rotation.y = rotation;
        
        // Add all parts to collidables
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.userData.isCollidable = true;
            }
        });
        
        this.scene.add(group);
        
        // Create collision box for the whole vehicle
        const collisionGeo = new THREE.BoxGeometry(3.5, 2.5, 5.5);
        const collisionMesh = new THREE.Mesh(collisionGeo, new THREE.MeshBasicMaterial({ visible: false }));
        collisionMesh.position.set(x, 1.25, z);
        collisionMesh.rotation.y = rotation;
        collisionMesh.userData.isCollidable = true;
        this.scene.add(collisionMesh);
        this.objects.push(collisionMesh);
        this.collidables.push(collisionMesh);
    }

    createRamp(width, height, depth, x, y, z, rotation, material) {
        // Create a ramp using a rotated box
        const geo = new THREE.BoxGeometry(width, 0.3, depth);
        const mesh = new THREE.Mesh(geo, material);
        
        // Calculate ramp angle
        const angle = Math.atan2(height, depth);
        mesh.rotation.x = -angle;
        mesh.rotation.y = rotation;
        
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isCollidable = true;
        mesh.userData.isRamp = true;
        
        this.scene.add(mesh);
        this.objects.push(mesh);
        this.collidables.push(mesh);
    }

    createPlatform(width, height, depth, x, y, z, material) {
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isCollidable = true;
        mesh.userData.isPlatform = true;
        this.scene.add(mesh);
        this.objects.push(mesh);
        this.collidables.push(mesh);
    }

    createRailing(width, height, depth, x, y, z, material) {
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isCollidable = true;
        this.scene.add(mesh);
        this.objects.push(mesh);
        this.collidables.push(mesh);
    }

    createWall(width, height, depth, x, y, z, material) {
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isCollidable = true;
        this.scene.add(mesh);
        this.objects.push(mesh);
        this.collidables.push(mesh);
    }

    createPillar(size, height, x, z, material) {
        const geo = new THREE.BoxGeometry(size, height, size);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, height / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isCollidable = true;
        this.scene.add(mesh);
        this.objects.push(mesh);
        this.collidables.push(mesh);
    }

    createCrate(width, height, depth, x, y, z, material) {
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isCollidable = true;
        this.scene.add(mesh);
        this.objects.push(mesh);
        this.collidables.push(mesh);
    }

    initWeaponPickups() {
        // Weapon pickup definitions
        const weaponTypes = [
            { type: 'shotgun', color: 0xff6600, position: new THREE.Vector3(25, 1, -20) },
            { type: 'smg', color: 0x00ff66, position: new THREE.Vector3(-30, 1, 20) },
            { type: 'sniper', color: 0x6600ff, position: new THREE.Vector3(-20, 1, -35) },
            // Extra pickups scattered around
            { type: 'shotgun', color: 0xff6600, position: new THREE.Vector3(35, 1, 35) },
            { type: 'smg', color: 0x00ff66, position: new THREE.Vector3(0, 1, 30) },
            { type: 'sniper', color: 0x6600ff, position: new THREE.Vector3(40, 1, -10) },
        ];

        weaponTypes.forEach(weapon => {
            this.createWeaponPickup(weapon.type, weapon.color, weapon.position);
        });
    }

    createWeaponPickup(type, color, position) {
        const group = new THREE.Group();
        
        // Glowing base platform
        const baseGeo = new THREE.CylinderGeometry(0.8, 1, 0.2, 8);
        const baseMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            flatShading: true
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        group.add(base);

        // Create full weapon model based on type
        const weaponGroup = new THREE.Group();
        const darkGrey = new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true });
        const black = new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true });
        const brown = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, flatShading: true });

        switch (type) {
            case 'shotgun':
                this.buildShotgunPickup(weaponGroup, brown, black);
                break;
            case 'smg':
                this.buildSMGPickup(weaponGroup, darkGrey, black);
                break;
            case 'sniper':
                this.buildSniperPickup(weaponGroup, darkGrey, black);
                break;
            default:
                this.buildPistolPickup(weaponGroup, darkGrey, black);
        }

        weaponGroup.position.y = 0.6;
        weaponGroup.rotation.x = -Math.PI / 12;
        group.add(weaponGroup);

        // Point light for glow effect
        const light = new THREE.PointLight(color, 0.8, 5);
        light.position.y = 0.5;
        group.add(light);

        group.position.copy(position);
        group.userData = {
            isWeaponPickup: true,
            weaponType: type,
            collected: false,
            respawnTime: 15000, // 15 seconds
            lastCollected: 0
        };

        this.scene.add(group);
        this.weaponPickups.push(group);
    }

    buildPistolPickup(group, bodyMat, accentMat) {
        // Receiver
        const receiverGeo = new THREE.BoxGeometry(0.08, 0.1, 0.4);
        const receiver = new THREE.Mesh(receiverGeo, bodyMat);
        group.add(receiver);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.06, 0.18, 0.1);
        const grip = new THREE.Mesh(gripGeo, accentMat);
        grip.rotation.x = Math.PI / 6;
        grip.position.set(0, -0.12, 0.12);
        group.add(grip);

        // Barrel
        const barrelGeo = new THREE.BoxGeometry(0.04, 0.04, 0.3);
        const barrel = new THREE.Mesh(barrelGeo, accentMat);
        barrel.position.set(0, 0.02, -0.25);
        group.add(barrel);
    }

    buildShotgunPickup(group, bodyMat, accentMat) {
        // Main body
        const bodyGeo = new THREE.BoxGeometry(0.1, 0.12, 0.7);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Double barrels
        const barrelGeo = new THREE.BoxGeometry(0.04, 0.05, 0.5);
        const barrel1 = new THREE.Mesh(barrelGeo, accentMat);
        barrel1.position.set(-0.025, 0.06, -0.4);
        group.add(barrel1);

        const barrel2 = new THREE.Mesh(barrelGeo, accentMat);
        barrel2.position.set(0.025, 0.06, -0.4);
        group.add(barrel2);

        // Stock
        const stockGeo = new THREE.BoxGeometry(0.08, 0.1, 0.3);
        const stock = new THREE.Mesh(stockGeo, bodyMat);
        stock.position.set(0, -0.02, 0.45);
        group.add(stock);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
        const grip = new THREE.Mesh(gripGeo, accentMat);
        grip.rotation.x = Math.PI / 5;
        grip.position.set(0, -0.12, 0.18);
        group.add(grip);

        // Pump
        const pumpGeo = new THREE.BoxGeometry(0.08, 0.06, 0.18);
        const pump = new THREE.Mesh(pumpGeo, bodyMat);
        pump.position.set(0, -0.06, -0.12);
        group.add(pump);
    }

    buildSMGPickup(group, bodyMat, accentMat) {
        // Receiver
        const receiverGeo = new THREE.BoxGeometry(0.09, 0.12, 0.45);
        const receiver = new THREE.Mesh(receiverGeo, bodyMat);
        group.add(receiver);

        // Barrel shroud
        const shroudGeo = new THREE.BoxGeometry(0.06, 0.08, 0.28);
        const shroud = new THREE.Mesh(shroudGeo, accentMat);
        shroud.position.set(0, 0.02, -0.32);
        group.add(shroud);

        // Barrel
        const barrelGeo = new THREE.BoxGeometry(0.03, 0.03, 0.22);
        const barrel = new THREE.Mesh(barrelGeo, accentMat);
        barrel.position.set(0, 0.02, -0.48);
        group.add(barrel);

        // Folding stock
        const stockGeo = new THREE.BoxGeometry(0.05, 0.08, 0.22);
        const stock = new THREE.Mesh(stockGeo, bodyMat);
        stock.position.set(0, 0, 0.32);
        group.add(stock);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.06, 0.16, 0.08);
        const grip = new THREE.Mesh(gripGeo, accentMat);
        grip.rotation.x = Math.PI / 6;
        grip.position.set(0, -0.14, 0.1);
        group.add(grip);

        // Extended magazine
        const magGeo = new THREE.BoxGeometry(0.05, 0.28, 0.06);
        const mag = new THREE.Mesh(magGeo, new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true }));
        mag.position.set(0, -0.2, -0.06);
        group.add(mag);
    }

    buildSniperPickup(group, bodyMat, accentMat) {
        // Long receiver
        const receiverGeo = new THREE.BoxGeometry(0.09, 0.12, 0.8);
        const receiver = new THREE.Mesh(receiverGeo, bodyMat);
        group.add(receiver);

        // Long barrel
        const barrelGeo = new THREE.BoxGeometry(0.04, 0.04, 0.55);
        const barrel = new THREE.Mesh(barrelGeo, accentMat);
        barrel.position.set(0, 0.03, -0.6);
        group.add(barrel);

        // Scope
        const scopeGeo = new THREE.BoxGeometry(0.05, 0.08, 0.25);
        const scopeMat = new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true });
        const scope = new THREE.Mesh(scopeGeo, scopeMat);
        scope.position.set(0, 0.12, -0.12);
        group.add(scope);

        // Scope lens (front)
        const lensGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0x4444ff, emissive: 0x222266, flatShading: true });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, 0.12, -0.25);
        group.add(lens);

        // Stock
        const stockGeo = new THREE.BoxGeometry(0.08, 0.12, 0.35);
        const stock = new THREE.Mesh(stockGeo, bodyMat);
        stock.position.set(0, -0.02, 0.52);
        group.add(stock);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.06, 0.18, 0.08);
        const grip = new THREE.Mesh(gripGeo, accentMat);
        grip.rotation.x = Math.PI / 6;
        grip.position.set(0, -0.14, 0.18);
        group.add(grip);

        // Bipod (collapsed)
        const bipodGeo = new THREE.BoxGeometry(0.08, 0.03, 0.05);
        const bipod = new THREE.Mesh(bipodGeo, accentMat);
        bipod.position.set(0, -0.08, -0.4);
        group.add(bipod);
    }

    update(delta) {
        // Rotate weapon pickups and handle respawning
        const now = performance.now();
        
        this.weaponPickups.forEach(pickup => {
            if (!pickup.userData.collected) {
                pickup.rotation.y += delta * 2;
                // Bobbing animation
                pickup.position.y = pickup.userData.baseY || 1;
                pickup.position.y += Math.sin(now / 300) * 0.1;
                if (!pickup.userData.baseY) pickup.userData.baseY = pickup.position.y;
            } else {
                // Check for respawn
                if (now - pickup.userData.lastCollected > pickup.userData.respawnTime) {
                    pickup.userData.collected = false;
                    pickup.visible = true;
                }
            }
        });
    }

    checkWeaponPickup(playerPosition, pickupCallback) {
        const pickupRadius = 1.5;
        
        this.weaponPickups.forEach(pickup => {
            if (pickup.userData.collected) return;
            
            const dist = playerPosition.distanceTo(pickup.position);
            if (dist < pickupRadius) {
                pickup.userData.collected = true;
                pickup.userData.lastCollected = performance.now();
                pickup.visible = false;
                
                if (pickupCallback) {
                    pickupCallback(pickup.userData.weaponType);
                }
            }
        });
    }
}
