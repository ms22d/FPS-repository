import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class Enemy {
    constructor(scene, position) {
        this.scene = scene;
        this.health = 50;
        this.alive = true;
        this.speed = 3.5;
        this.attackRange = 10;
        this.stopDistance = 5;
        this.lastShotTime = 0;
        this.fireRate = 1.5;

        // Mesh (Red Capsule)
        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Tag for Raycasting
        this.mesh.userData = { isEnemy: true, entity: this };

        // Collision
        this.raycaster = new THREE.Raycaster();

        this.scene.add(this.mesh);
    }

    update(delta, player, worldObject, onShoot) {
        if (!this.alive) return;

        const playerPos = player.controls.getObject().position;
        const dist = this.mesh.position.distanceTo(playerPos);

        // Look at player
        this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);

        // Chase
        if (dist > this.stopDistance) {
            const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
            dir.y = 0; // Stay on floor

            // Wall Collision Check
            this.raycaster.ray.origin.copy(this.mesh.position);
            this.raycaster.ray.origin.y -= 0.2; // Check lower
            this.raycaster.ray.direction.copy(dir);
            this.raycaster.far = 1.0;

            // Allow passing world objects into update
            let blocked = false;

            if (worldObject && worldObject.objects) {
                const hits = this.raycaster.intersectObjects(worldObject.objects, false);
                if (hits.some(h => h.distance < 0.8)) {
                    blocked = true;
                }
            }

            if (!blocked) {
                this.mesh.position.addScaledVector(dir, this.speed * delta);
            }
        }

        // Attack
        if (dist < this.attackRange) {
            this.shoot(player, onShoot);
        }
    }

    shoot(player, onShoot) {
        const now = performance.now() / 1000;
        if (now - this.lastShotTime < this.fireRate) return;
        this.lastShotTime = now;

        // Flash
        const originalColor = this.mesh.material.color.getHex();
        this.mesh.material.color.setHex(0xffff00);
        setTimeout(() => {
            if (this.alive) this.mesh.material.color.setHex(originalColor);
        }, 100);

        // Create Projectile
        const startPos = this.mesh.position.clone();
        startPos.y += 0.5; // Shoot from "chest"

        // Predict direction slightly? No, direct aim.
        const playerCenter = player.controls.getObject().position.clone();
        playerCenter.y -= 0.5;

        const dir = new THREE.Vector3().subVectors(playerCenter, startPos);

        const proj = new Projectile(this.scene, startPos, dir);
        if (onShoot) onShoot(proj);
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.health -= amount;

        // Flash White
        const originalColor = this.mesh.material.color.getHex();
        this.mesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if (this.alive) {
                // Return to red (or original if we store it)
                this.mesh.material.color.setHex(0xff0000);
            }
        }, 50);

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.alive = false;
        this.scene.remove(this.mesh);
    }
}
