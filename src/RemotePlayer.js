import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class RemotePlayer {
    constructor(scene, initialData) {
        this.scene = scene;
        this.id = initialData.id;

        // Create anime-inspired low-poly character
        this.mesh = this.createAnimeCharacter();

        this.mesh.position.set(initialData.x, initialData.y, initialData.z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // User Data for Raycasting
        this.mesh.userData = { isPlayer: true, id: this.id };

        this.scene.add(this.mesh);

        // Target values for interpolation
        this.targetPos = new THREE.Vector3(initialData.x, initialData.y, initialData.z);
        this.targetRot = initialData.rotation;

        // Animation
        this.animTime = 0;
    }

    createAnimeCharacter() {
        const group = new THREE.Group();

        // Random hair/outfit color for variety
        const hairColors = [0xff6699, 0x66ccff, 0xffcc00, 0xff4444, 0x9966ff, 0x00ff88];
        const outfitColors = [0x2a2a3a, 0x3a2a2a, 0x2a3a2a, 0x4a3a5a, 0x3a4a5a];
        const skinColor = 0xffdbac;
        const hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];
        const outfitColor = outfitColors[Math.floor(Math.random() * outfitColors.length)];

        const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, flatShading: true });
        const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, flatShading: true });
        const outfitMat = new THREE.MeshStandardMaterial({ color: outfitColor, flatShading: true });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const eyeHighlightMat = new THREE.MeshBasicMaterial({ color: hairColor });

        // === HEAD ===
        const headGroup = new THREE.Group();
        headGroup.position.y = 1.5;

        // Face (slightly elongated for anime look)
        const headGeo = new THREE.BoxGeometry(0.35, 0.4, 0.3);
        const head = new THREE.Mesh(headGeo, skinMat);
        headGroup.add(head);

        // Hair - spiky anime style
        const hairBaseGeo = new THREE.BoxGeometry(0.4, 0.25, 0.35);
        const hairBase = new THREE.Mesh(hairBaseGeo, hairMat);
        hairBase.position.set(0, 0.15, 0);
        headGroup.add(hairBase);

        // Hair spikes
        for (let i = 0; i < 5; i++) {
            const spikeGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
            const spike = new THREE.Mesh(spikeGeo, hairMat);
            spike.position.set((i - 2) * 0.08, 0.3, -0.05);
            spike.rotation.z = (i - 2) * 0.15;
            spike.rotation.x = -0.2;
            headGroup.add(spike);
        }

        // Back hair
        const backHairGeo = new THREE.BoxGeometry(0.35, 0.3, 0.15);
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, 0.05, -0.2);
        headGroup.add(backHair);

        // Eyes (large anime style)
        const eyeGroup = new THREE.Group();
        eyeGroup.position.z = 0.15;

        // Left eye
        const leftEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.02), eyeWhiteMat);
        leftEyeWhite.position.set(-0.08, 0.02, 0);
        eyeGroup.add(leftEyeWhite);

        const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.025), eyeMat);
        leftPupil.position.set(-0.08, 0.01, 0.01);
        eyeGroup.add(leftPupil);

        const leftHighlight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.03), eyeHighlightMat);
        leftHighlight.position.set(-0.06, 0.04, 0.02);
        eyeGroup.add(leftHighlight);

        // Right eye
        const rightEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.02), eyeWhiteMat);
        rightEyeWhite.position.set(0.08, 0.02, 0);
        eyeGroup.add(rightEyeWhite);

        const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.025), eyeMat);
        rightPupil.position.set(0.08, 0.01, 0.01);
        eyeGroup.add(rightPupil);

        const rightHighlight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.03), eyeHighlightMat);
        rightHighlight.position.set(0.1, 0.04, 0.02);
        eyeGroup.add(rightHighlight);

        headGroup.add(eyeGroup);

        // Small mouth
        const mouthGeo = new THREE.BoxGeometry(0.06, 0.02, 0.02);
        const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshBasicMaterial({ color: 0x331111 }));
        mouth.position.set(0, -0.12, 0.15);
        headGroup.add(mouth);

        group.add(headGroup);

        // === BODY ===
        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.4, 0.5, 0.25);
        const torso = new THREE.Mesh(torsoGeo, outfitMat);
        torso.position.y = 1.0;
        group.add(torso);

        // Collar/neck area
        const collarGeo = new THREE.BoxGeometry(0.25, 0.1, 0.2);
        const collar = new THREE.Mesh(collarGeo, skinMat);
        collar.position.y = 1.3;
        group.add(collar);

        // === ARMS ===
        // Left arm
        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.28, 1.1, 0);
        
        const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.12), outfitMat);
        leftUpperArm.position.y = -0.1;
        leftArmGroup.add(leftUpperArm);

        const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.1), skinMat);
        leftHand.position.y = -0.3;
        leftArmGroup.add(leftHand);

        group.add(leftArmGroup);
        this.leftArm = leftArmGroup;

        // Right arm
        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.28, 1.1, 0);
        
        const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.12), outfitMat);
        rightUpperArm.position.y = -0.1;
        rightArmGroup.add(rightUpperArm);

        const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.1), skinMat);
        rightHand.position.y = -0.3;
        rightArmGroup.add(rightHand);

        group.add(rightArmGroup);
        this.rightArm = rightArmGroup;

        // === LEGS ===
        // Left leg
        const leftLegGroup = new THREE.Group();
        leftLegGroup.position.set(-0.12, 0.5, 0);

        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), outfitMat);
        leftLeg.position.y = -0.25;
        leftLegGroup.add(leftLeg);

        const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.18), new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true }));
        leftFoot.position.set(0, -0.55, 0.03);
        leftLegGroup.add(leftFoot);

        group.add(leftLegGroup);
        this.leftLeg = leftLegGroup;

        // Right leg
        const rightLegGroup = new THREE.Group();
        rightLegGroup.position.set(0.12, 0.5, 0);

        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), outfitMat);
        rightLeg.position.y = -0.25;
        rightLegGroup.add(rightLeg);

        const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.18), new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true }));
        rightFoot.position.set(0, -0.55, 0.03);
        rightLegGroup.add(rightFoot);

        group.add(rightLegGroup);
        this.rightLeg = rightLegGroup;

        // Offset to ground level
        group.position.y = 0;

        return group;
    }

    updatePosition(data) {
        this.targetPos.set(data.x, data.y, data.z);
        this.targetRot = data.rotation;
    }

    update(delta) {
        // Position interpolation
        const prevPos = this.mesh.position.clone();
        this.mesh.position.lerp(this.targetPos, 10 * delta);
        
        // Rotation
        this.mesh.rotation.y = this.targetRot;

        // Walking animation based on movement
        const moved = prevPos.distanceTo(this.mesh.position);
        if (moved > 0.01) {
            this.animTime += delta * 10;
            
            // Arm swing
            if (this.leftArm) {
                this.leftArm.rotation.x = Math.sin(this.animTime) * 0.5;
            }
            if (this.rightArm) {
                this.rightArm.rotation.x = -Math.sin(this.animTime) * 0.5;
            }
            
            // Leg swing
            if (this.leftLeg) {
                this.leftLeg.rotation.x = -Math.sin(this.animTime) * 0.4;
            }
            if (this.rightLeg) {
                this.rightLeg.rotation.x = Math.sin(this.animTime) * 0.4;
            }
        } else {
            // Idle - reset pose
            if (this.leftArm) this.leftArm.rotation.x *= 0.9;
            if (this.rightArm) this.rightArm.rotation.x *= 0.9;
            if (this.leftLeg) this.leftLeg.rotation.x *= 0.9;
            if (this.rightLeg) this.rightLeg.rotation.x *= 0.9;
        }
    }

    shoot(direction, onShoot) {
        // Spawns a projectile that travels towards the player
        const startPos = this.mesh.position.clone();
        startPos.y += 1.2; // Shoot from chest height

        const dirVec = new THREE.Vector3(direction.x, direction.y, direction.z);

        const proj = new Projectile(this.scene, startPos, dirVec, 60, 10);

        if (onShoot) onShoot(proj);
    }

    cleanup() {
        this.scene.remove(this.mesh);
    }
}
