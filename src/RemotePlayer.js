import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class RemotePlayer {
    constructor(scene, initialData) {
        this.scene = scene;
        this.id = initialData.id;

        // Mesh (Green Capsule)
        const geometry = new THREE.CapsuleGeometry(0.5, 1.8, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);

        this.mesh.position.set(initialData.x, initialData.y, initialData.z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // User Data for Raycasting
        this.mesh.userData = { isPlayer: true, id: this.id };

        this.scene.add(this.mesh);

        // Target values for interpolation
        this.targetPos = new THREE.Vector3(initialData.x, initialData.y, initialData.z);
        this.targetRot = initialData.rotation;
    }

    updatePosition(data) {
        this.targetPos.set(data.x, data.y, data.z);
        this.targetRot = data.rotation;
    }

    update(delta) {
        // Simple Lerp
        this.mesh.position.lerp(this.targetPos, 10 * delta);
        // For simple Y rotation:
        this.mesh.rotation.y = this.targetRot;
    }

    shoot(direction, onShoot) {
        // Spawns a projectile that travels towards the player
        const startPos = this.mesh.position.clone();
        startPos.y += 0.5; // Shoot from chest height

        const dirVec = new THREE.Vector3(direction.x, direction.y, direction.z);

        const proj = new Projectile(this.scene, startPos, dirVec);

        if (onShoot) onShoot(proj);
    }

    cleanup() {
        this.scene.remove(this.mesh);
    }
}
