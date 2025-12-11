import * as THREE from 'three';

// Weapon type configurations
const WEAPON_CONFIGS = {
    pistol: {
        name: 'Pistol',
        fireRate: 0.25,
        damage: 18,
        ammo: 12,
        maxAmmo: 12,
        spread: 0.02,
        bulletsPerShot: 1,
        reloadTime: 1500,
        recoilKick: 0.1,
        recoilClimb: 0.08,
        color: 0x444444,
        projectileSpeed: 60
    },
    shotgun: {
        name: 'Shotgun',
        fireRate: 0.9,
        damage: 18, // Per pellet - 8 pellets = 144 max damage
        ammo: 6,
        maxAmmo: 6,
        spread: 0.12,
        bulletsPerShot: 8, // Multi-pellet spread
        reloadTime: 2500,
        recoilKick: 0.3,
        recoilClimb: 0.25,
        color: 0x8b4513,
        projectileSpeed: 50
    },
    smg: {
        name: 'SMG',
        fireRate: 0.08,
        damage: 4, // Significantly nerfed
        ammo: 35,
        maxAmmo: 35,
        spread: 0.08,
        bulletsPerShot: 1,
        reloadTime: 1800,
        recoilKick: 0.05,
        recoilClimb: 0.03,
        color: 0x2a2a2a,
        automatic: true,
        projectileSpeed: 70
    },
    sniper: {
        name: 'Sniper',
        fireRate: 1.8,
        damage: 150, // One-shot kill potential
        ammo: 5,
        maxAmmo: 5,
        spread: 0.003,
        bulletsPerShot: 1,
        reloadTime: 3500,
        recoilKick: 0.35,
        recoilClimb: 0.3,
        color: 0x1a1a1a,
        projectileSpeed: 120 // Very fast
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
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8, flatShading: true });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9, flatShading: true });

        // Slide (top part)
        const slideGeo = new THREE.BoxGeometry(0.055, 0.065, 0.32);
        const slide = new THREE.Mesh(slideGeo, bodyMat);
        slide.position.set(0, 0.025, -0.05);
        this.gunBody.add(slide);

        // Slide serrations (rear)
        for (let i = 0; i < 5; i++) {
            const serGeo = new THREE.BoxGeometry(0.058, 0.008, 0.01);
            const ser = new THREE.Mesh(serGeo, accentMat);
            ser.position.set(0, 0.025 + (i - 2) * 0.012, 0.1);
            this.gunBody.add(ser);
        }

        // Frame/lower receiver
        const frameGeo = new THREE.BoxGeometry(0.05, 0.045, 0.22);
        const frame = new THREE.Mesh(frameGeo, chromeMat);
        frame.position.set(0, -0.02, 0.03);
        this.gunBody.add(frame);

        // Trigger guard
        const guardGeo = new THREE.BoxGeometry(0.045, 0.04, 0.06);
        const guard = new THREE.Mesh(guardGeo, bodyMat);
        guard.position.set(0, -0.05, 0.02);
        this.gunBody.add(guard);

        // Trigger
        const triggerGeo = new THREE.BoxGeometry(0.008, 0.03, 0.015);
        const trigger = new THREE.Mesh(triggerGeo, chromeMat);
        trigger.position.set(0, -0.035, 0.01);
        trigger.rotation.x = 0.3;
        this.gunBody.add(trigger);

        // Grip (ergonomic with texture)
        const gripGeo = new THREE.BoxGeometry(0.045, 0.13, 0.065);
        const grip = new THREE.Mesh(gripGeo, woodMat);
        grip.rotation.x = Math.PI / 7;
        grip.position.set(0, -0.1, 0.08);
        this.gunBody.add(grip);

        // Grip panels (texture detail)
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x553322, roughness: 1.0, flatShading: true });
        const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.1, 0.05), panelMat);
        leftPanel.position.set(-0.026, -0.1, 0.08);
        leftPanel.rotation.x = Math.PI / 7;
        this.gunBody.add(leftPanel);
        
        const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.1, 0.05), panelMat);
        rightPanel.position.set(0.026, -0.1, 0.08);
        rightPanel.rotation.x = Math.PI / 7;
        this.gunBody.add(rightPanel);

        // Barrel
        const barrelGeo = new THREE.BoxGeometry(0.025, 0.025, 0.28);
        const barrel = new THREE.Mesh(barrelGeo, accentMat);
        barrel.position.set(0, 0.035, -0.22);
        this.gunBody.add(barrel);

        // Barrel opening
        const muzzleGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
        const muzzle = new THREE.Mesh(muzzleGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
        muzzle.position.set(0, 0.035, -0.37);
        this.gunBody.add(muzzle);

        // Magazine
        const magGeo = new THREE.BoxGeometry(0.035, 0.16, 0.055);
        this.magazine = new THREE.Mesh(magGeo, new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true }));
        this.magazine.position.set(0, -0.12, 0.01);
        this.gunBody.add(this.magazine);

        // Magazine base plate
        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.06), chromeMat);
        basePlate.position.set(0, -0.2, 0.01);
        this.gunBody.add(basePlate);

        // Front Sight
        const frontSightGeo = new THREE.BoxGeometry(0.015, 0.025, 0.015);
        const frontSight = new THREE.Mesh(frontSightGeo, new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0x661100, flatShading: true }));
        frontSight.position.set(0, 0.07, -0.35);
        this.gunBody.add(frontSight);

        // Rear sight
        const rearSightL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.015), accentMat);
        rearSightL.position.set(-0.015, 0.065, 0.1);
        this.gunBody.add(rearSightL);
        
        const rearSightR = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.015), accentMat);
        rearSightR.position.set(0.015, 0.065, 0.1);
        this.gunBody.add(rearSightR);

        // Hammer
        const hammerGeo = new THREE.BoxGeometry(0.015, 0.03, 0.02);
        const hammer = new THREE.Mesh(hammerGeo, chromeMat);
        hammer.position.set(0, 0.04, 0.14);
        hammer.rotation.x = -0.5;
        this.gunBody.add(hammer);

        // Safety
        const safetyGeo = new THREE.BoxGeometry(0.02, 0.015, 0.02);
        const safety = new THREE.Mesh(safetyGeo, chromeMat);
        safety.position.set(0.03, 0.01, 0.1);
        this.gunBody.add(safety);
    }

    buildShotgun(bodyMat, accentMat) {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85, flatShading: true });
        const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9, flatShading: true });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.7, flatShading: true });

        // Main receiver
        const bodyGeo = new THREE.BoxGeometry(0.075, 0.09, 0.35);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, 0.05);
        this.gunBody.add(body);

        // Receiver details - ejection port
        const ejectGeo = new THREE.BoxGeometry(0.04, 0.03, 0.06);
        const eject = new THREE.Mesh(ejectGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
        eject.position.set(0.04, 0.02, 0.05);
        this.gunBody.add(eject);

        // Loading port (bottom)
        const loadPortGeo = new THREE.BoxGeometry(0.035, 0.015, 0.08);
        const loadPort = new THREE.Mesh(loadPortGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
        loadPort.position.set(0, -0.05, 0);
        this.gunBody.add(loadPort);

        // Double barrel
        const barrelGeo1 = new THREE.BoxGeometry(0.035, 0.04, 0.55);
        const barrel1 = new THREE.Mesh(barrelGeo1, metalMat);
        barrel1.position.set(-0.018, 0.045, -0.35);
        this.gunBody.add(barrel1);

        const barrel2 = new THREE.Mesh(barrelGeo1.clone(), metalMat);
        barrel2.position.set(0.018, 0.045, -0.35);
        this.gunBody.add(barrel2);

        // Barrel rib (top)
        const ribGeo = new THREE.BoxGeometry(0.08, 0.015, 0.5);
        const rib = new THREE.Mesh(ribGeo, accentMat);
        rib.position.set(0, 0.072, -0.35);
        this.gunBody.add(rib);

        // Barrel band
        const bandGeo = new THREE.BoxGeometry(0.09, 0.06, 0.02);
        const band1 = new THREE.Mesh(bandGeo, metalMat);
        band1.position.set(0, 0.045, -0.15);
        this.gunBody.add(band1);

        const band2 = new THREE.Mesh(bandGeo.clone(), metalMat);
        band2.position.set(0, 0.045, -0.45);
        this.gunBody.add(band2);

        // Muzzle openings
        const muzzle1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        muzzle1.position.set(-0.018, 0.045, -0.63);
        this.gunBody.add(muzzle1);

        const muzzle2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        muzzle2.position.set(0.018, 0.045, -0.63);
        this.gunBody.add(muzzle2);

        // Forearm/pump
        const pumpGeo = new THREE.BoxGeometry(0.07, 0.06, 0.18);
        this.magazine = new THREE.Mesh(pumpGeo, woodMat);
        this.magazine.position.set(0, -0.01, -0.15);
        this.gunBody.add(this.magazine);

        // Pump grooves
        for (let i = 0; i < 6; i++) {
            const grooveGeo = new THREE.BoxGeometry(0.075, 0.005, 0.015);
            const groove = new THREE.Mesh(grooveGeo, darkWoodMat);
            groove.position.set(0, -0.01, -0.22 + i * 0.025);
            this.gunBody.add(groove);
        }

        // Stock
        const stockGeo = new THREE.BoxGeometry(0.065, 0.1, 0.28);
        const stock = new THREE.Mesh(stockGeo, woodMat);
        stock.position.set(0, -0.01, 0.35);
        this.gunBody.add(stock);

        // Stock butt plate
        const buttGeo = new THREE.BoxGeometry(0.07, 0.11, 0.02);
        const butt = new THREE.Mesh(buttGeo, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, flatShading: true }));
        butt.position.set(0, -0.01, 0.5);
        this.gunBody.add(butt);

        // Trigger guard
        const guardGeo = new THREE.BoxGeometry(0.055, 0.04, 0.07);
        const guard = new THREE.Mesh(guardGeo, metalMat);
        guard.position.set(0, -0.06, 0.12);
        this.gunBody.add(guard);

        // Trigger
        const triggerGeo = new THREE.BoxGeometry(0.01, 0.025, 0.015);
        const trigger = new THREE.Mesh(triggerGeo, metalMat);
        trigger.position.set(0, -0.045, 0.12);
        this.gunBody.add(trigger);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.05, 0.11, 0.055);
        const grip = new THREE.Mesh(gripGeo, woodMat);
        grip.rotation.x = Math.PI / 5.5;
        grip.position.set(0, -0.08, 0.18);
        this.gunBody.add(grip);

        // Front bead sight
        const beadGeo = new THREE.BoxGeometry(0.015, 0.02, 0.015);
        const bead = new THREE.Mesh(beadGeo, new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x662200, flatShading: true }));
        bead.position.set(0, 0.085, -0.58);
        this.gunBody.add(bead);

        // Safety button
        const safetyGeo = new THREE.BoxGeometry(0.025, 0.015, 0.02);
        const safety = new THREE.Mesh(safetyGeo, new THREE.MeshStandardMaterial({ color: 0xaa0000, flatShading: true }));
        safety.position.set(0, 0.05, 0.15);
        this.gunBody.add(safety);
    }

    buildSMG(bodyMat, accentMat) {
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6, flatShading: true });
        const polymerMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, flatShading: true });

        // Upper receiver
        const upperGeo = new THREE.BoxGeometry(0.065, 0.07, 0.32);
        const upper = new THREE.Mesh(upperGeo, bodyMat);
        upper.position.set(0, 0.02, 0);
        this.gunBody.add(upper);

        // Lower receiver
        const lowerGeo = new THREE.BoxGeometry(0.06, 0.05, 0.2);
        const lower = new THREE.Mesh(lowerGeo, polymerMat);
        lower.position.set(0, -0.03, 0.04);
        this.gunBody.add(lower);

        // Ejection port
        const ejectGeo = new THREE.BoxGeometry(0.035, 0.025, 0.04);
        const eject = new THREE.Mesh(ejectGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
        eject.position.set(0.035, 0.035, 0.02);
        this.gunBody.add(eject);

        // Charging handle
        const chargeGeo = new THREE.BoxGeometry(0.03, 0.02, 0.04);
        const charge = new THREE.Mesh(chargeGeo, metalMat);
        charge.position.set(0, 0.065, 0.1);
        this.gunBody.add(charge);

        // Barrel shroud with vents
        const shroudGeo = new THREE.BoxGeometry(0.055, 0.055, 0.2);
        const shroud = new THREE.Mesh(shroudGeo, bodyMat);
        shroud.position.set(0, 0.02, -0.25);
        this.gunBody.add(shroud);

        // Shroud vents
        for (let i = 0; i < 4; i++) {
            const ventGeo = new THREE.BoxGeometry(0.06, 0.015, 0.025);
            const vent = new THREE.Mesh(ventGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
            vent.position.set(0, 0.02, -0.15 - i * 0.04);
            this.gunBody.add(vent);
        }

        // Barrel
        const barrelGeo = new THREE.BoxGeometry(0.022, 0.022, 0.18);
        const barrel = new THREE.Mesh(barrelGeo, metalMat);
        barrel.position.set(0, 0.02, -0.42);
        this.gunBody.add(barrel);

        // Flash hider
        const flashGeo = new THREE.BoxGeometry(0.03, 0.03, 0.04);
        const flash = new THREE.Mesh(flashGeo, accentMat);
        flash.position.set(0, 0.02, -0.52);
        this.gunBody.add(flash);

        // Folding stock (extended)
        const stockTubeGeo = new THREE.BoxGeometry(0.03, 0.04, 0.18);
        const stockTube = new THREE.Mesh(stockTubeGeo, metalMat);
        stockTube.position.set(0, 0.01, 0.25);
        this.gunBody.add(stockTube);

        const stockPadGeo = new THREE.BoxGeometry(0.05, 0.08, 0.03);
        const stockPad = new THREE.Mesh(stockPadGeo, polymerMat);
        stockPad.position.set(0, 0, 0.35);
        this.gunBody.add(stockPad);

        // Stock adjustment lever
        const leverGeo = new THREE.BoxGeometry(0.015, 0.025, 0.03);
        const lever = new THREE.Mesh(leverGeo, metalMat);
        lever.position.set(0.02, -0.01, 0.2);
        this.gunBody.add(lever);

        // Trigger guard
        const guardGeo = new THREE.BoxGeometry(0.05, 0.035, 0.06);
        const guard = new THREE.Mesh(guardGeo, polymerMat);
        guard.position.set(0, -0.06, 0.05);
        this.gunBody.add(guard);

        // Trigger
        const triggerGeo = new THREE.BoxGeometry(0.008, 0.025, 0.012);
        const trigger = new THREE.Mesh(triggerGeo, metalMat);
        trigger.position.set(0, -0.045, 0.05);
        trigger.rotation.x = 0.2;
        this.gunBody.add(trigger);

        // Grip (vertical foregrip style)
        const gripGeo = new THREE.BoxGeometry(0.04, 0.12, 0.05);
        const grip = new THREE.Mesh(gripGeo, polymerMat);
        grip.rotation.x = Math.PI / 7;
        grip.position.set(0, -0.1, 0.07);
        this.gunBody.add(grip);

        // Grip texture
        for (let i = 0; i < 4; i++) {
            const texGeo = new THREE.BoxGeometry(0.045, 0.008, 0.04);
            const tex = new THREE.Mesh(texGeo, accentMat);
            tex.position.set(0, -0.08 - i * 0.02, 0.07);
            tex.rotation.x = Math.PI / 7;
            this.gunBody.add(tex);
        }

        // Extended magazine
        const magGeo = new THREE.BoxGeometry(0.038, 0.22, 0.045);
        this.magazine = new THREE.Mesh(magGeo, new THREE.MeshStandardMaterial({ color: 0x2a2a2a, flatShading: true }));
        this.magazine.position.set(0, -0.15, -0.02);
        this.gunBody.add(this.magazine);

        // Mag release button
        const magRelGeo = new THREE.BoxGeometry(0.015, 0.02, 0.015);
        const magRel = new THREE.Mesh(magRelGeo, metalMat);
        magRel.position.set(0.035, -0.04, -0.02);
        this.gunBody.add(magRel);

        // Iron sights
        const frontSightGeo = new THREE.BoxGeometry(0.015, 0.025, 0.015);
        const frontSight = new THREE.Mesh(frontSightGeo, new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x005500, flatShading: true }));
        frontSight.position.set(0, 0.065, -0.32);
        this.gunBody.add(frontSight);

        const rearSightGeo = new THREE.BoxGeometry(0.04, 0.02, 0.02);
        const rearSight = new THREE.Mesh(rearSightGeo, accentMat);
        rearSight.position.set(0, 0.06, 0.12);
        this.gunBody.add(rearSight);

        // Selector switch
        const selectorGeo = new THREE.BoxGeometry(0.02, 0.01, 0.03);
        const selector = new THREE.Mesh(selectorGeo, metalMat);
        selector.position.set(-0.035, 0.01, 0.08);
        this.gunBody.add(selector);
    }

    buildSniper(bodyMat, accentMat) {
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7, flatShading: true });
        const stockMat = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.7, flatShading: true });
        const scopeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.5, flatShading: true });

        // Main receiver (long precision rifle body)
        const receiverGeo = new THREE.BoxGeometry(0.065, 0.09, 0.55);
        const receiver = new THREE.Mesh(receiverGeo, bodyMat);
        receiver.position.set(0, 0, 0.05);
        this.gunBody.add(receiver);

        // Receiver rail (top)
        const railGeo = new THREE.BoxGeometry(0.045, 0.015, 0.4);
        const rail = new THREE.Mesh(railGeo, metalMat);
        rail.position.set(0, 0.052, 0);
        this.gunBody.add(rail);

        // Rail notches
        for (let i = 0; i < 12; i++) {
            const notchGeo = new THREE.BoxGeometry(0.048, 0.005, 0.012);
            const notch = new THREE.Mesh(notchGeo, accentMat);
            notch.position.set(0, 0.062, -0.18 + i * 0.03);
            this.gunBody.add(notch);
        }

        // Bolt handle
        const boltGeo = new THREE.BoxGeometry(0.05, 0.02, 0.04);
        const bolt = new THREE.Mesh(boltGeo, metalMat);
        bolt.position.set(0.05, 0.02, 0.12);
        this.gunBody.add(bolt);

        const boltKnobGeo = new THREE.BoxGeometry(0.025, 0.025, 0.025);
        const boltKnob = new THREE.Mesh(boltKnobGeo, metalMat);
        boltKnob.position.set(0.07, 0.02, 0.12);
        this.gunBody.add(boltKnob);

        // Long heavy barrel
        const barrelGeo = new THREE.BoxGeometry(0.035, 0.035, 0.55);
        const barrel = new THREE.Mesh(barrelGeo, metalMat);
        barrel.position.set(0, 0.025, -0.48);
        this.gunBody.add(barrel);

        // Barrel fluting (weight reduction grooves)
        for (let i = 0; i < 8; i++) {
            const fluteGeo = new THREE.BoxGeometry(0.04, 0.01, 0.4);
            const flute = new THREE.Mesh(fluteGeo, accentMat);
            flute.position.set(0, 0.025, -0.4);
            flute.rotation.z = (i / 8) * Math.PI;
            this.gunBody.add(flute);
        }

        // Muzzle brake
        const brakeGeo = new THREE.BoxGeometry(0.045, 0.045, 0.06);
        const brake = new THREE.Mesh(brakeGeo, accentMat);
        brake.position.set(0, 0.025, -0.78);
        this.gunBody.add(brake);

        // Brake ports
        for (let i = 0; i < 3; i++) {
            const portGeo = new THREE.BoxGeometry(0.05, 0.015, 0.012);
            const port = new THREE.Mesh(portGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
            port.position.set(0, 0.025, -0.74 - i * 0.025);
            this.gunBody.add(port);
        }

        // Scope mount
        const mountGeo = new THREE.BoxGeometry(0.05, 0.03, 0.08);
        const mount = new THREE.Mesh(mountGeo, metalMat);
        mount.position.set(0, 0.075, 0);
        this.gunBody.add(mount);

        // Scope body
        const scopeBodyGeo = new THREE.BoxGeometry(0.045, 0.055, 0.25);
        const scopeBody = new THREE.Mesh(scopeBodyGeo, scopeMat);
        scopeBody.position.set(0, 0.115, -0.02);
        this.gunBody.add(scopeBody);

        // Scope objective (front lens housing)
        const objGeo = new THREE.BoxGeometry(0.055, 0.065, 0.04);
        const objective = new THREE.Mesh(objGeo, scopeMat);
        objective.position.set(0, 0.115, -0.16);
        this.gunBody.add(objective);

        // Scope lens (front)
        const lensGeo = new THREE.BoxGeometry(0.04, 0.05, 0.01);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0x4466ff, emissive: 0x112244, flatShading: true, opacity: 0.8, transparent: true });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, 0.115, -0.185);
        this.gunBody.add(lens);

        // Scope ocular (rear)
        const ocularGeo = new THREE.BoxGeometry(0.04, 0.05, 0.03);
        const ocular = new THREE.Mesh(ocularGeo, scopeMat);
        ocular.position.set(0, 0.115, 0.12);
        this.gunBody.add(ocular);

        // Scope turrets (elevation/windage)
        const turretGeo = new THREE.BoxGeometry(0.025, 0.035, 0.025);
        const elevationTurret = new THREE.Mesh(turretGeo, metalMat);
        elevationTurret.position.set(0, 0.155, 0.02);
        this.gunBody.add(elevationTurret);

        const windageTurret = new THREE.Mesh(turretGeo.clone(), metalMat);
        windageTurret.position.set(0.035, 0.115, 0.02);
        windageTurret.rotation.z = Math.PI / 2;
        this.gunBody.add(windageTurret);

        // Adjustable stock
        const stockGeo = new THREE.BoxGeometry(0.06, 0.1, 0.22);
        const stock = new THREE.Mesh(stockGeo, stockMat);
        stock.position.set(0, -0.01, 0.4);
        this.gunBody.add(stock);

        // Stock cheek rest (adjustable)
        const cheekGeo = new THREE.BoxGeometry(0.055, 0.04, 0.12);
        const cheek = new THREE.Mesh(cheekGeo, stockMat);
        cheek.position.set(0, 0.06, 0.38);
        this.gunBody.add(cheek);

        // Stock butt pad
        const buttGeo = new THREE.BoxGeometry(0.065, 0.11, 0.025);
        const butt = new THREE.Mesh(buttGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95, flatShading: true }));
        butt.position.set(0, -0.01, 0.52);
        this.gunBody.add(butt);

        // Trigger guard
        const guardGeo = new THREE.BoxGeometry(0.05, 0.04, 0.07);
        const guard = new THREE.Mesh(guardGeo, bodyMat);
        guard.position.set(0, -0.06, 0.12);
        this.gunBody.add(guard);

        // Trigger (adjustable match trigger)
        const triggerGeo = new THREE.BoxGeometry(0.008, 0.03, 0.018);
        const trigger = new THREE.Mesh(triggerGeo, new THREE.MeshStandardMaterial({ color: 0xcc8800, metalness: 0.8, flatShading: true }));
        trigger.position.set(0, -0.045, 0.12);
        trigger.rotation.x = 0.2;
        this.gunBody.add(trigger);

        // Grip (vertical target grip)
        const gripGeo = new THREE.BoxGeometry(0.045, 0.13, 0.055);
        const grip = new THREE.Mesh(gripGeo, stockMat);
        grip.rotation.x = Math.PI / 6;
        grip.position.set(0, -0.1, 0.18);
        this.gunBody.add(grip);

        // Grip palm swell
        const swellGeo = new THREE.BoxGeometry(0.05, 0.05, 0.04);
        const swell = new THREE.Mesh(swellGeo, stockMat);
        swell.position.set(0, -0.08, 0.16);
        swell.rotation.x = Math.PI / 6;
        this.gunBody.add(swell);

        // Magazine (detachable box)
        const magGeo = new THREE.BoxGeometry(0.045, 0.1, 0.06);
        this.magazine = new THREE.Mesh(magGeo, new THREE.MeshStandardMaterial({ color: 0x2a2a2a, flatShading: true }));
        this.magazine.position.set(0, -0.09, 0.02);
        this.gunBody.add(this.magazine);

        // Magazine floor plate
        const floorGeo = new THREE.BoxGeometry(0.05, 0.015, 0.065);
        const floor = new THREE.Mesh(floorGeo, metalMat);
        floor.position.set(0, -0.145, 0.02);
        this.gunBody.add(floor);

        // Bipod (extended)
        const bipodArmGeo = new THREE.BoxGeometry(0.015, 0.15, 0.015);
        const leftArm = new THREE.Mesh(bipodArmGeo, metalMat);
        leftArm.position.set(-0.04, -0.1, -0.3);
        leftArm.rotation.x = 0.3;
        leftArm.rotation.z = -0.2;
        this.gunBody.add(leftArm);

        const rightArm = new THREE.Mesh(bipodArmGeo.clone(), metalMat);
        rightArm.position.set(0.04, -0.1, -0.3);
        rightArm.rotation.x = 0.3;
        rightArm.rotation.z = 0.2;
        this.gunBody.add(rightArm);

        // Bipod feet
        const footGeo = new THREE.BoxGeometry(0.02, 0.01, 0.04);
        const leftFoot = new THREE.Mesh(footGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, flatShading: true }));
        leftFoot.position.set(-0.06, -0.2, -0.25);
        this.gunBody.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeo.clone(), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, flatShading: true }));
        rightFoot.position.set(0.06, -0.2, -0.25);
        this.gunBody.add(rightFoot);
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
