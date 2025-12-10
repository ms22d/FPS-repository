import * as THREE from 'three';

// Weapon type configurations
const WEAPON_CONFIGS = {
    pistol: {
        name: 'Pistol',
        fireRate: 0.25,
        damage: 15,
        ammo: 12,
        maxAmmo: 12,
        spread: 0.02,
        bulletsPerShot: 1,
        reloadTime: 1500,
        recoilKick: 0.1,
        recoilClimb: 0.08,
        color: 0x444444
    },
    shotgun: {
        name: 'Shotgun',
        fireRate: 0.8,
        damage: 12,
        ammo: 6,
        maxAmmo: 6,
        spread: 0.15,
        bulletsPerShot: 8,
        reloadTime: 2500,
        recoilKick: 0.25,
        recoilClimb: 0.2,
        color: 0x8b4513
    },
    smg: {
        name: 'SMG',
        fireRate: 0.08,
        damage: 8,
        ammo: 30,
        maxAmmo: 30,
        spread: 0.06,
        bulletsPerShot: 1,
        reloadTime: 2000,
        recoilKick: 0.06,
        recoilClimb: 0.04,
        color: 0x2a2a2a
    },
    sniper: {
        name: 'Sniper',
        fireRate: 1.5,
        damage: 100,
        ammo: 5,
        maxAmmo: 5,
        spread: 0.005,
        bulletsPerShot: 1,
        reloadTime: 3000,
        recoilKick: 0.3,
        recoilClimb: 0.25,
        color: 0x1a1a1a
    }
};

export class Weapon {
    constructor(camera, soundManager) {
        this.camera = camera;
        this.soundManager = soundManager;
        this.projectiles = [];
        this.world = null; // Will be set by Player

        // Current weapon type
        this.currentWeapon = 'pistol';
        this.config = WEAPON_CONFIGS.pistol;

        // Weapon Stats (from config)
        this.fireRate = this.config.fireRate;
        this.lastFireTime = 0;
        this.ammo = this.config.ammo;
        this.maxAmmo = this.config.maxAmmo;
        this.isReloading = false;

        // ADS
        this.isAiming = false;
        this.adsLevel = 0; // 0 to 1 interpolation

        // Positions (Relative to Camera)
        // Hip fire position
        this.defaultPosition = new THREE.Vector3(0.25, -0.3, -0.5);
        this.defaultRotation = new THREE.Euler(0, 0, 0);

        // ADS Position (Centered and brought closer/higher)
        this.adsPosition = new THREE.Vector3(0, -0.165, -0.4);
        this.adsRotation = new THREE.Euler(0, 0, 0);

        this.initMesh();
        this.updateUI();
    }

    setWorld(world) {
        this.world = world;
    }

    switchWeapon(weaponType) {
        if (!WEAPON_CONFIGS[weaponType]) return;
        if (this.currentWeapon === weaponType) {
            // Just refill ammo if same weapon
            this.ammo = this.maxAmmo;
            this.updateUI();
            return;
        }

        this.currentWeapon = weaponType;
        this.config = WEAPON_CONFIGS[weaponType];
        
        // Update stats
        this.fireRate = this.config.fireRate;
        this.ammo = this.config.ammo;
        this.maxAmmo = this.config.maxAmmo;
        this.isReloading = false;

        // Rebuild mesh for new weapon
        this.rebuildMesh();
        this.updateUI();
    }

    rebuildMesh() {
        // Remove old mesh
        if (this.mesh) {
            this.camera.remove(this.mesh);
        }
        this.initMesh();
    }

    initMesh() {
        this.mesh = new THREE.Group();

        // PSX-style materials (flat shading, low poly)
        const darkGrey = new THREE.MeshStandardMaterial({ 
            color: this.config.color, 
            roughness: 0.8,
            flatShading: true 
        });
        const black = new THREE.MeshStandardMaterial({ 
            color: 0x111111, 
            roughness: 0.9,
            flatShading: true 
        });

        // --- Gun Body Group ---
        this.gunBody = new THREE.Group();
        this.mesh.add(this.gunBody);

        // Build weapon based on type
        switch (this.currentWeapon) {
            case 'pistol':
                this.buildPistol(darkGrey, black);
                break;
            case 'shotgun':
                this.buildShotgun(darkGrey, black);
                break;
            case 'smg':
                this.buildSMG(darkGrey, black);
                break;
            case 'sniper':
                this.buildSniper(darkGrey, black);
                break;
        }

        // --- Muzzle Flash ---
        this.muzzleFlash = new THREE.Group();
        this.muzzleFlash.position.set(0, 0.05, this.getMuzzlePosition());
        this.muzzleFlash.visible = false;
        this.gunBody.add(this.muzzleFlash);

        // Flash Light
        this.flashLight = new THREE.PointLight(0xffaa00, 2, 5);
        this.muzzleFlash.add(this.flashLight);

        // Flash Mesh (Crossed Planes) - PSX style
        const flashGeo = new THREE.PlaneGeometry(0.3, 0.3);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffffaa,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const flash1 = new THREE.Mesh(flashGeo, flashMat);
        const flash2 = new THREE.Mesh(flashGeo, flashMat);
        flash2.rotation.z = Math.PI / 2;

        this.muzzleFlash.add(flash1);
        this.muzzleFlash.add(flash2);

        // Init Transforms
        this.mesh.position.copy(this.defaultPosition);

        // Tag mesh for raycast ignoring
        this.mesh.traverse((child) => {
            child.userData.isWeapon = true;
        });

        // Add to camera
        this.camera.add(this.mesh);
    }

    getMuzzlePosition() {
        switch (this.currentWeapon) {
            case 'shotgun': return -0.7;
            case 'smg': return -0.5;
            case 'sniper': return -0.9;
            default: return -0.55;
        }
    }

    buildPistol(bodyMat, accentMat) {
        // Receiver
        const receiverGeo = new THREE.BoxGeometry(0.06, 0.08, 0.35);
        const receiver = new THREE.Mesh(receiverGeo, bodyMat);
        this.gunBody.add(receiver);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.05, 0.15, 0.08);
        const grip = new THREE.Mesh(gripGeo, accentMat);
        grip.rotation.x = Math.PI / 6;
        grip.position.set(0, -0.1, 0.1);
        this.gunBody.add(grip);

        // Barrel
        const barrelGeo = new THREE.BoxGeometry(0.03, 0.03, 0.35);
        const barrel = new THREE.Mesh(barrelGeo, accentMat);
        barrel.position.set(0, 0.05, -0.25);
        this.gunBody.add(barrel);

        // Magazine
        const magGeo = new THREE.BoxGeometry(0.04, 0.18, 0.06);
        this.magazine = new THREE.Mesh(magGeo, new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true }));
        this.magazine.position.set(0, -0.12, -0.05);
        this.gunBody.add(this.magazine);

        // Front Sight
        const frontSightGeo = new THREE.BoxGeometry(0.01, 0.02, 0.01);
        const frontSight = new THREE.Mesh(frontSightGeo, new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x440000 }));
        frontSight.position.set(0, 0.07, -0.42);
        this.gunBody.add(frontSight);
    }

    buildShotgun(bodyMat, accentMat) {
        // Main body
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.1, 0.6);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.gunBody.add(body);

        // Barrel (double barrel style)
        const barrelGeo1 = new THREE.BoxGeometry(0.03, 0.04, 0.5);
        const barrel1 = new THREE.Mesh(barrelGeo1, accentMat);
        barrel1.position.set(-0.02, 0.05, -0.35);
        this.gunBody.add(barrel1);

        const barrel2 = new THREE.Mesh(barrelGeo1, accentMat);
        barrel2.position.set(0.02, 0.05, -0.35);
        this.gunBody.add(barrel2);

        // Stock
        const stockGeo = new THREE.BoxGeometry(0.06, 0.08, 0.25);
        const stock = new THREE.Mesh(stockGeo, bodyMat);
        stock.position.set(0, -0.02, 0.4);
        this.gunBody.add(stock);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.05, 0.12, 0.06);
        const grip = new THREE.Mesh(gripGeo, accentMat);
        grip.rotation.x = Math.PI / 5;
        grip.position.set(0, -0.1, 0.15);
        this.gunBody.add(grip);

        // Pump
        const pumpGeo = new THREE.BoxGeometry(0.06, 0.05, 0.15);
        this.magazine = new THREE.Mesh(pumpGeo, new THREE.MeshStandardMaterial({ color: 0x5a3a1a, flatShading: true }));
        this.magazine.position.set(0, -0.05, -0.1);
        this.gunBody.add(this.magazine);
    }

    buildSMG(bodyMat, accentMat) {
        // Receiver
        const receiverGeo = new THREE.BoxGeometry(0.07, 0.1, 0.4);
        const receiver = new THREE.Mesh(receiverGeo, bodyMat);
        this.gunBody.add(receiver);

        // Barrel shroud
        const shroudGeo = new THREE.BoxGeometry(0.05, 0.06, 0.25);
        const shroud = new THREE.Mesh(shroudGeo, accentMat);
        shroud.position.set(0, 0.02, -0.3);
        this.gunBody.add(shroud);

        // Barrel
        const barrelGeo = new THREE.BoxGeometry(0.02, 0.02, 0.2);
        const barrel = new THREE.Mesh(barrelGeo, accentMat);
        barrel.position.set(0, 0.02, -0.45);
        this.gunBody.add(barrel);

        // Folding stock
        const stockGeo = new THREE.BoxGeometry(0.04, 0.06, 0.2);
        const stock = new THREE.Mesh(stockGeo, bodyMat);
        stock.position.set(0, 0, 0.3);
        this.gunBody.add(stock);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.05, 0.14, 0.06);
        const grip = new THREE.Mesh(gripGeo, accentMat);
        grip.rotation.x = Math.PI / 6;
        grip.position.set(0, -0.12, 0.08);
        this.gunBody.add(grip);

        // Extended magazine
        const magGeo = new THREE.BoxGeometry(0.04, 0.25, 0.05);
        this.magazine = new THREE.Mesh(magGeo, new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true }));
        this.magazine.position.set(0, -0.18, -0.05);
        this.gunBody.add(this.magazine);
    }

    buildSniper(bodyMat, accentMat) {
        // Long receiver
        const receiverGeo = new THREE.BoxGeometry(0.07, 0.1, 0.7);
        const receiver = new THREE.Mesh(receiverGeo, bodyMat);
        this.gunBody.add(receiver);

        // Long barrel
        const barrelGeo = new THREE.BoxGeometry(0.03, 0.03, 0.5);
        const barrel = new THREE.Mesh(barrelGeo, accentMat);
        barrel.position.set(0, 0.03, -0.55);
        this.gunBody.add(barrel);

        // Scope
        const scopeGeo = new THREE.BoxGeometry(0.04, 0.06, 0.2);
        const scopeMat = new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true });
        const scope = new THREE.Mesh(scopeGeo, scopeMat);
        scope.position.set(0, 0.1, -0.1);
        this.gunBody.add(scope);

        // Scope lens (front)
        const lensGeo = new THREE.BoxGeometry(0.03, 0.03, 0.01);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0x4444ff, emissive: 0x222266, flatShading: true });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, 0.1, -0.2);
        this.gunBody.add(lens);

        // Stock
        const stockGeo = new THREE.BoxGeometry(0.06, 0.1, 0.3);
        const stock = new THREE.Mesh(stockGeo, bodyMat);
        stock.position.set(0, -0.02, 0.45);
        this.gunBody.add(stock);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.05, 0.15, 0.06);
        const grip = new THREE.Mesh(gripGeo, accentMat);
        grip.rotation.x = Math.PI / 6;
        grip.position.set(0, -0.12, 0.15);
        this.gunBody.add(grip);

        // Magazine
        const magGeo = new THREE.BoxGeometry(0.04, 0.12, 0.06);
        this.magazine = new THREE.Mesh(magGeo, new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true }));
        this.magazine.position.set(0, -0.1, 0);
        this.gunBody.add(this.magazine);

        // Bipod (collapsed)
        const bipodGeo = new THREE.BoxGeometry(0.06, 0.02, 0.04);
        const bipod = new THREE.Mesh(bipodGeo, accentMat);
        bipod.position.set(0, -0.06, -0.35);
        this.gunBody.add(bipod);
    }

    shoot(scene) {
        if (this.isReloading || this.ammo <= 0) return;

        const now = performance.now() / 1000;
        if (now - this.lastFireTime < this.fireRate) return;

        this.lastFireTime = now;
        this.ammo--;

        this.updateUI();

        // Audio
        if (this.soundManager) this.soundManager.playShoot();

        // Recoil Visualization (Kick back)
        this.mesh.position.z += this.config.recoilKick;
        this.mesh.rotation.x += this.config.recoilClimb;

        // Muzzle Flash
        this.muzzleFlash.visible = true;
        this.muzzleFlash.rotation.z = Math.random() * Math.PI;
        if (this.flashTimeout) clearTimeout(this.flashTimeout);
        this.flashTimeout = setTimeout(() => {
            this.muzzleFlash.visible = false;
        }, 50);

        // Trigger Network callback
        if (this.onShoot) {
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            this.onShoot(dir);
        }

        // Perform raycast(s) based on weapon type
        const bulletsToFire = this.config.bulletsPerShot;
        
        for (let i = 0; i < bulletsToFire; i++) {
            this.fireRaycast(scene);
        }
    }

    fireRaycast(scene) {
        const raycaster = new THREE.Raycaster();
        
        // Apply spread
        const spread = this.config.spread;
        const spreadX = (Math.random() - 0.5) * spread;
        const spreadY = (Math.random() - 0.5) * spread;
        
        raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), this.camera);

        // Get all collidable objects including world objects
        const allObjects = [];
        scene.traverse((obj) => {
            if (obj.isMesh && !obj.userData.isWeapon && !obj.userData.isWeaponPickup) {
                allObjects.push(obj);
            }
        });

        const intersects = raycaster.intersectObjects(allObjects, false);

        if (intersects.length > 0) {
            let hitObject = null;
            let hitPoint = null;

            for (const hit of intersects) {
                // Filter Helpers
                if (hit.object.type === 'GridHelper' || hit.object.type === 'LineSegments') continue;

                // Filter Self (Weapon)
                let isWeapon = false;
                let obj = hit.object;
                while (obj) {
                    if (obj.userData && obj.userData.isWeapon) {
                        isWeapon = true;
                        break;
                    }
                    obj = obj.parent;
                }
                if (isWeapon) continue;

                // If we passed filters, this is our hit
                hitObject = hit.object;
                hitPoint = hit.point;
                break;
            }

            if (hitObject && hitPoint) {
                // Create bullet impact effect
                this.createImpactEffect(scene, hitPoint);

                // Visual feedback: Flash color
                if (hitObject.material && hitObject.material.color) {
                    // Check Enemy
                    if (hitObject.userData && hitObject.userData.isEnemy) {
                        hitObject.userData.entity.takeDamage(this.config.damage);
                    }

                    const originalHex = hitObject.material.color.getHex();
                    hitObject.material.color.setHex(0xffffff);
                    setTimeout(() => {
                        if (hitObject && hitObject.material) {
                            hitObject.material.color.setHex(originalHex);
                        }
                    }, 50);
                }
            }
        }
    }

    createImpactEffect(scene, position) {
        // PSX-style impact particles
        const particleCount = 5;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0xffaa00,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(position);
            
            // Random velocity
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                Math.random() * 3,
                (Math.random() - 0.5) * 3
            );
            particle.userData.life = 0.3;
            
            scene.add(particle);
            particles.push(particle);
        }

        // Animate particles
        const animateParticles = () => {
            particles.forEach((p, idx) => {
                if (p.userData.life > 0) {
                    p.userData.life -= 0.016;
                    p.position.addScaledVector(p.userData.velocity, 0.016);
                    p.userData.velocity.y -= 10 * 0.016;
                    p.material.opacity = p.userData.life / 0.3;
                } else {
                    scene.remove(p);
                    particles.splice(idx, 1);
                }
            });
            
            if (particles.length > 0) {
                requestAnimationFrame(animateParticles);
            }
        };
        animateParticles();
    }

    reload() {
        if (this.isReloading || this.ammo === this.maxAmmo) return;

        this.isReloading = true;

        if (this.soundManager) this.soundManager.playReload();

        // Finish Reload based on weapon type
        setTimeout(() => {
            this.ammo = this.maxAmmo;
            this.isReloading = false;
            this.updateUI();
            if (this.magazine) {
                this.magazine.position.y = this.getMagazineDefaultY();
            }
        }, this.config.reloadTime);
    }

    getMagazineDefaultY() {
        switch (this.currentWeapon) {
            case 'shotgun': return -0.05;
            case 'smg': return -0.18;
            case 'sniper': return -0.1;
            default: return -0.12;
        }
    }

    setAim(aiming) {
        this.isAiming = aiming;
    }

    update(delta, playerMoving) {
        // --- ADS Interpolation ---
        const targetAds = this.isAiming ? 1 : 0;
        this.adsLevel += (targetAds - this.adsLevel) * 15 * delta;

        // Sniper gets extra zoom
        const sniperZoom = this.currentWeapon === 'sniper' ? 1.2 : 1;

        // Position & Rotation lerp
        const targetPos = new THREE.Vector3().copy(this.defaultPosition).lerp(this.adsPosition, this.adsLevel * sniperZoom);
        const targetRot = new THREE.Euler().copy(this.defaultRotation);

        // --- Recoil Recovery ---
        this.mesh.position.lerp(targetPos, 10 * delta);

        let targetRotX = 0;
        let targetRotZ = 0;

        // --- Reload Animation State ---
        if (this.isReloading) {
            targetRotX = Math.PI / 4;
            targetRotZ = -Math.PI / 4;

            if (this.magazine) {
                this.magazine.position.y = this.getMagazineDefaultY() - Math.sin(performance.now() / 100) * 0.05;
            }
        } else {
            if (this.magazine) {
                this.magazine.position.y = this.getMagazineDefaultY();
                this.magazine.visible = true;
            }
        }

        // Apply Rotation
        this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetRotX, 10 * delta);
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRotZ, 10 * delta);
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, 0, 10 * delta);

        // --- Weapon Sway (Walking) ---
        if (!this.isAiming && playerMoving && !this.isReloading) {
            const time = performance.now() / 150;
            this.mesh.position.x += Math.sin(time) * 0.005;
            this.mesh.position.y += Math.abs(Math.sin(time * 2)) * 0.005;
        }

        // --- Camera FOV (ADS Zoom) ---
        const baseFov = 75;
        let adsFov = 50;
        if (this.currentWeapon === 'sniper') adsFov = 25; // More zoom for sniper
        
        const targetFov = this.isAiming ? adsFov : baseFov;
        if (Math.abs(this.camera.fov - targetFov) > 0.1) {
            this.camera.fov += (targetFov - this.camera.fov) * 15 * delta;
            this.camera.updateProjectionMatrix();
        }
    }

    updateUI() {
        const ammoDisplay = document.getElementById('ammo-display');
        if (ammoDisplay) {
            ammoDisplay.innerText = `${this.config.name}: ${this.ammo} / ${this.maxAmmo}`;
        }

        // Update weapon indicator
        const weaponIndicator = document.getElementById('weapon-indicator');
        if (weaponIndicator) {
            weaponIndicator.innerText = this.config.name.toUpperCase();
        }
    }
}
