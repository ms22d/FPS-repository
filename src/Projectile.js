import * as THREE from 'three';

export class Projectile {
    constructor(scene, position, direction, speed = 60, damage = 10) {
        this.scene = scene;
        this.speed = speed; // Increased default speed
        this.damage = damage;
        this.alive = true;
        this.creationTime = performance.now();
        this.maxLifeTime = 4000; // 4 seconds for longer range

        // Visible projectile mesh - glowing bullet
        const geometry = new THREE.SphereGeometry(0.08, 6, 6);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffcc00,
            transparent: true,
            opacity: 0.9
        }); 
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);

        // Add glow effect
        const glowGeo = new THREE.SphereGeometry(0.15, 6, 6);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.4
        });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.mesh.add(this.glow);

        // Direction normalized
        this.velocity = direction.clone().normalize().multiplyScalar(this.speed);
        
        // Rotate bullet to face direction
        if (this.velocity.length() > 0) {
            this.mesh.lookAt(position.clone().add(this.velocity));
        }

        // Add trail effect
        this.trail = [];
        this.trailLength = 8;

        this.scene.add(this.mesh);
    }

    update(delta, player, world) {
        if (!this.alive) return;

        // Store previous position for trail
        const prevPos = this.mesh.position.clone();

        // Move
        this.mesh.position.addScaledVector(this.velocity, delta);

        // Create trail effect
        this.updateTrail(prevPos);

        // Life check
        if (performance.now() - this.creationTime > this.maxLifeTime) {
            this.destroy();
            return;
        }

        // Collision Check with World Objects
        if (world && world.collidables) {
            const raycaster = new THREE.Raycaster(
                prevPos,
                this.velocity.clone().normalize(),
                0,
                this.velocity.length() * delta + 0.5
            );

            const intersects = raycaster.intersectObjects(world.collidables, false);
            if (intersects.length > 0) {
                // Hit an object - create impact effect and destroy
                this.createImpactEffect(intersects[0].point);
                this.destroy();
                return;
            }
        }

        // Collision Check (Simple Distance to Player)
        const playerPos = player.controls.getObject().position.clone();
        playerPos.y -= 0.5; // Mid-body

        const dist = this.mesh.position.distanceTo(playerPos);
        if (dist < 0.8) { // Hit radius
            if (player.takeDamage) player.takeDamage(this.damage);
            this.destroy();
        }

        // Floor collision
        if (this.mesh.position.y < 0.1) {
            this.createImpactEffect(this.mesh.position.clone());
            this.destroy();
        }
    }

    updateTrail(prevPos) {
        // Add new trail segment
        const trailGeo = new THREE.BoxGeometry(0.08, 0.08, 0.15);
        const trailMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.6
        });
        const trailMesh = new THREE.Mesh(trailGeo, trailMat);
        trailMesh.position.copy(prevPos);
        trailMesh.lookAt(this.mesh.position);
        this.scene.add(trailMesh);
        this.trail.push({ mesh: trailMesh, life: 0.1 });

        // Update existing trail
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const t = this.trail[i];
            t.life -= 0.016;
            t.mesh.material.opacity = t.life / 0.1 * 0.6;
            
            if (t.life <= 0) {
                this.scene.remove(t.mesh);
                this.trail.splice(i, 1);
            }
        }

        // Limit trail length
        while (this.trail.length > this.trailLength) {
            const t = this.trail.shift();
            this.scene.remove(t.mesh);
        }
    }

    createImpactEffect(position) {
        // PSX-style sparks
        const sparkCount = 4;
        for (let i = 0; i < sparkCount; i++) {
            const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffcc00,
                transparent: true,
                opacity: 1
            });
            const spark = new THREE.Mesh(geo, mat);
            spark.position.copy(position);
            
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                Math.random() * 4,
                (Math.random() - 0.5) * 4
            );
            
            this.scene.add(spark);
            
            // Animate spark
            const animateSpark = () => {
                vel.y -= 15 * 0.016;
                spark.position.addScaledVector(vel, 0.016);
                spark.material.opacity -= 0.05;
                
                if (spark.material.opacity > 0) {
                    requestAnimationFrame(animateSpark);
                } else {
                    this.scene.remove(spark);
                }
            };
            animateSpark();
        }
    }

    destroy() {
        this.alive = false;
        this.scene.remove(this.mesh);
        
        // Clean up trail
        this.trail.forEach(t => {
            this.scene.remove(t.mesh);
        });
        this.trail = [];
    }
}
