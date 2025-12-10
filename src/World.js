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

        // ===== OUTER WALLS (Arena boundary) =====
        this.createWall(50, 6, 2, 0, 3, -50, wallMat);   // North wall
        this.createWall(50, 6, 2, 0, 3, 50, wallMat);    // South wall
        this.createWall(2, 6, 50, -50, 3, 0, wallMat);   // West wall
        this.createWall(2, 6, 50, 50, 3, 0, wallMat);    // East wall

        // Corner pillars
        this.createPillar(3, 8, -48, 48, pillarMat);
        this.createPillar(3, 8, 48, 48, pillarMat);
        this.createPillar(3, 8, -48, -48, pillarMat);
        this.createPillar(3, 8, 48, -48, pillarMat);

        // ===== CENTRAL STRUCTURE =====
        // Central ruined building
        this.createWall(12, 5, 1, 0, 2.5, -8, wallMat2);
        this.createWall(12, 5, 1, 0, 2.5, 8, wallMat2);
        this.createWall(1, 5, 8, -6, 2.5, 0, wallMat2);
        this.createWall(1, 5, 8, 6, 2.5, 0, wallMat2);

        // Central pillars
        this.createPillar(2, 6, -4, -4, pillarMat);
        this.createPillar(2, 6, 4, -4, pillarMat);
        this.createPillar(2, 6, -4, 4, pillarMat);
        this.createPillar(2, 6, 4, 4, pillarMat);

        // ===== SCATTERED COVER =====
        // Crate clusters - Northeast
        this.createCrate(2, 2, 2, 25, 1, -20, crateMat);
        this.createCrate(2, 2, 2, 27, 1, -18, crateMat);
        this.createCrate(2, 1.5, 2, 26, 2.75, -19, crateMat);

        // Crate cluster - Southwest
        this.createCrate(3, 2, 3, -28, 1, 22, crateMat);
        this.createCrate(2, 2, 2, -25, 1, 24, crateMat);

        // Crate cluster - Southeast
        this.createCrate(2, 2.5, 2, 30, 1.25, 30, crateMat);
        this.createCrate(2, 2, 2, 33, 1, 28, crateMat);

        // ===== WALLS AND BARRIERS =====
        // L-shaped wall - Northwest
        this.createWall(10, 4, 1.5, -30, 2, -15, wallMat);
        this.createWall(1.5, 4, 8, -25, 2, -11, wallMat);

        // Barrier wall - East
        this.createWall(1.5, 3.5, 12, 35, 1.75, 0, wallMat2);

        // Broken walls - various positions
        this.createWall(6, 3, 1, 15, 1.5, 20, wallMat);
        this.createWall(4, 2.5, 1, 22, 1.25, 20, wallMat);
        
        this.createWall(8, 3.5, 1, -20, 1.75, 35, wallMat2);

        // ===== PILLARS AND COLUMNS =====
        // Scattered pillars
        this.createPillar(1.5, 5, 20, -35, pillarMat);
        this.createPillar(1.5, 5, -35, -30, pillarMat);
        this.createPillar(1.5, 5, -15, -35, pillarMat);
        this.createPillar(1.5, 5, 40, -20, pillarMat);
        this.createPillar(1.5, 5, 15, 40, pillarMat);
        this.createPillar(1.5, 5, -40, 10, pillarMat);

        // ===== METAL STRUCTURES =====
        // Industrial metal barriers
        this.createCrate(1, 3, 4, -10, 1.5, -30, metalMat);
        this.createCrate(1, 3, 4, 10, 1.5, -30, metalMat);
        
        // Metal platforms/low covers
        this.createCrate(5, 0.5, 5, 35, 0.25, -35, metalMat);
        this.createCrate(4, 0.5, 4, -38, 0.25, 35, metalMat);

        // ===== RUINED VEHICLES (represented as metal boxes) =====
        this.createCrate(4, 1.5, 2, -35, 0.75, -5, metalMat);
        this.createCrate(3.5, 2, 6, 25, 1, 10, metalMat);

        // ===== ADDITIONAL SMALL COVER =====
        // Small debris/cover spots
        this.createCrate(1, 1, 1, 0, 0.5, -20, crateMat);
        this.createCrate(1.5, 0.8, 1.5, 5, 0.4, 25, crateMat);
        this.createCrate(1, 1.2, 1, -12, 0.6, 15, crateMat);
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

        // Weapon representation (simple box for PSX style)
        const weaponGeo = new THREE.BoxGeometry(0.15, 0.15, 0.6);
        const weaponMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            flatShading: true
        });
        const weaponMesh = new THREE.Mesh(weaponGeo, weaponMat);
        weaponMesh.position.y = 0.5;
        weaponMesh.rotation.z = Math.PI / 12;
        group.add(weaponMesh);

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
