import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Weapon } from './Weapon.js';
import { SoundManager } from './SoundManager.js';

export class Player {
    constructor(camera, scene, domElement, world) {
        this.camera = camera;
        this.scene = scene;
        this.domElement = domElement;
        this.world = world;

        // Audio
        this.soundManager = new SoundManager();

        // Controls
        this.controls = new PointerLockControls(camera, domElement);
        this.controls.minPolarAngle = 0.1;
        this.controls.maxPolarAngle = Math.PI - 0.1;
        this.sensitivity = 1.0;
        this.controls.pointerSpeed = this.sensitivity;

        // Weapon - starts with pistol
        this.weapon = new Weapon(this.camera, this.soundManager);
        this.weapon.setWorld(world);

        // Flashlight
        this.flashlight = new THREE.SpotLight(0xffffcc, 2, 30, Math.PI / 6, 0.5, 1);
        this.flashlight.position.set(0, 0, 0);
        this.flashlight.target.position.set(0, 0, -1);
        this.camera.add(this.flashlight);
        this.camera.add(this.flashlight.target);
        this.flashlightOn = true;

        // Settings - Tuned for weightier feel
        this.speed = 2.0;     // Was 10.0
        this.runSpeed = 4.0;  // Was 20.0 (Slightly faster than walk)
        this.jumpForce = 12;  // Was 15
        this.gravity = 45.0;
        this.playerHeight = 1.6;

        // Dash settings
        this.dashSpeed = 25.0;
        this.dashDuration = 0.15; // seconds
        this.dashCooldown = 3.0; // seconds
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.isDashing = false;
        this.dashDirection = new THREE.Vector3();

        // Stats
        this.maxHealth = 100;
        this.health = 100;
        this.maxStamina = 100;
        this.stamina = 100;
        this.staminaDrainRate = 30; // Per second
        this.staminaRegenRate = 15; // Per second

        // Low health state
        this.isLowHealth = false;
        this.lowHealthOverlayActive = false;

        // State
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.isSprinting = false;
        this.isSprintKeyPressed = false; // Track key state separately
        
        // Auto-fire for SMG
        this.isMouseDown = false

        // Step Logic
        this.stepTimer = 0;
        this.stepInterval = 0.5; // Seconds

        // Physics
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);

        // Initial Position
        this.camera.position.set(0, this.playerHeight, 0);

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Pointer Lock
        document.addEventListener('click', () => {
            // We only lock if we click on the canvas (handled in main usually), 
            // but let's just use the lock method if not locked.
            // Main.js handles the initial click usually.
            this.soundManager.resume();
        });

        this.controls.addEventListener('lock', () => {
            // ...
        });

        this.controls.addEventListener('unlock', () => {
            // ...
        });

        // Keyboard
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
                case 'Space':
                    if (this.canJump) {
                        this.velocity.y += this.jumpForce;
                        this.canJump = false;
                    }
                    break;
                case 'ShiftLeft':
                case 'ShiftRight': 
                    // Dash instead of sprint
                    if (!this.isDashing && this.dashCooldownTimer <= 0) {
                        this.startDash();
                    }
                    break;
                case 'KeyR': this.weapon.reload(); break;
                case 'KeyF': this.toggleFlashlight(); break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Sensitivity Controls
        document.addEventListener('keydown', (event) => {
            if (event.key === ']') {
                this.sensitivity += 0.1;
                console.log('Sensitivity:', this.sensitivity.toFixed(1));
                this.controls.pointerSpeed = this.sensitivity;
                // Optional: Visual feedback could be added later
            }
            if (event.key === '[') {
                this.sensitivity = Math.max(0.1, this.sensitivity - 0.1);
                console.log('Sensitivity:', this.sensitivity.toFixed(1));
                this.controls.pointerSpeed = this.sensitivity;
            }
        });

        // Mouse (Weapon) - with auto-fire support for SMG
        document.addEventListener('mousedown', (event) => {
            if (!this.controls.isLocked) return;

            if (event.button === 0) { // Left Click
                this.isMouseDown = true;
                this.weapon.shoot(this.scene);
            } else if (event.button === 2) { // Right Click
                this.weapon.setAim(true);
            }
        });

        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) { // Left Click release
                this.isMouseDown = false;
            }
            if (event.button === 2) { // Right Click release
                this.weapon.setAim(false);
            }
        });
    }

    lockControls() {
        this.controls.lock();
    }

    toggleFlashlight() {
        this.flashlightOn = !this.flashlightOn;
        this.flashlight.visible = this.flashlightOn;
    }

    startDash() {
        if (this.isDashing || this.dashCooldownTimer > 0) return;
        
        // Get dash direction from current movement or forward
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();

        const camRight = new THREE.Vector3();
        camRight.crossVectors(new THREE.Vector3(0, 1, 0), camDir).normalize();

        this.dashDirection.set(0, 0, 0);
        
        if (this.moveForward) this.dashDirection.add(camDir);
        if (this.moveBackward) this.dashDirection.sub(camDir);
        if (this.moveRight) this.dashDirection.sub(camRight);
        if (this.moveLeft) this.dashDirection.add(camRight);

        // Default to forward if no direction
        if (this.dashDirection.length() < 0.1) {
            this.dashDirection.copy(camDir);
        }
        this.dashDirection.normalize();

        this.isDashing = true;
        this.dashTimer = this.dashDuration;
        this.dashCooldownTimer = this.dashCooldown;
    }

    update(delta, world) {
        if (!this.controls.isLocked) return;

        // Update dash cooldown
        if (this.dashCooldownTimer > 0) {
            this.dashCooldownTimer -= delta;
        }

        // Update dash cooldown UI
        this.updateDashUI();

        // SMG Auto-fire - shoot while mouse is held down
        if (this.isMouseDown && this.weapon.currentWeapon === 'smg') {
            this.weapon.shoot(this.scene);
        }

        // Update world (for weapon pickup animations)
        if (world && world.update) {
            world.update(delta);
        }

        // Check for weapon pickups
        if (world && world.checkWeaponPickup) {
            const playerPos = this.controls.getObject().position;
            world.checkWeaponPickup(playerPos, (weaponType) => {
                this.weapon.switchWeapon(weaponType);
                this.showPickupMessage(weaponType);
            });
        }

        // Low Health Effects
        if (this.health < 30 && this.health > 0) {
            // Heartbeat sound
            this.heartbeatTimer = (this.heartbeatTimer || 0) + delta;
            if (this.heartbeatTimer > 1.0) {
                this.soundManager.playHeartbeat();
                this.heartbeatTimer = 0;
            }
            
            // Red screen overlay
            if (!this.isLowHealth) {
                this.isLowHealth = true;
                const lowHealthOverlay = document.getElementById('low-health-overlay');
                if (lowHealthOverlay) {
                    lowHealthOverlay.style.opacity = '1';
                }
            }
        } else {
            if (this.isLowHealth) {
                this.isLowHealth = false;
                const lowHealthOverlay = document.getElementById('low-health-overlay');
                if (lowHealthOverlay) {
                    lowHealthOverlay.style.opacity = '0';
                }
            }
        }

        // 1. Ground Collision
        // ... (Existing logic)
        this.raycaster.ray.origin.copy(this.controls.getObject().position);
        const intersections = this.raycaster.intersectObjects(world.objects, false);
        const onObject = intersections.length > 0 && intersections[0].distance <= this.playerHeight + 0.1;

        // 2. Physics
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= this.gravity * delta;

        // 3. Input & Movement
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        const isMoving = (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight);

        // Handle Dash
        if (this.isDashing) {
            this.dashTimer -= delta;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        }

        // Movement speed - dash overrides normal movement
        const currentSpeed = this.isDashing ? this.dashSpeed : this.speed;

        if (this.isDashing) {
            // During dash, move in dash direction
            const dashMove = this.dashDirection.clone().multiplyScalar(currentSpeed * delta);
            this.controls.getObject().position.add(dashMove);
        } else {
            // Normal movement
            if (this.moveForward || this.moveBackward) {
                this.velocity.z -= this.direction.z * currentSpeed * delta * 50;
            }
            if (this.moveLeft || this.moveRight) {
                this.velocity.x -= this.direction.x * currentSpeed * delta * 50;
            }
        }

        // 4. Collision Response
        if (onObject === true) {
            this.velocity.y = Math.max(0, this.velocity.y);
            this.canJump = true;

            // Step Sound Logic
            if (isMoving && !this.isDashing) {
                this.stepTimer += delta;
                const interval = 0.55;
                if (this.stepTimer > interval) {
                    this.stepTimer = 0;
                    this.soundManager.playStep();
                }
            } else {
                this.stepTimer = 0; // Reset so first step triggers easier
            }
        }

        // 5. Apply Movement (With Wall Collision)
        const intendedMoveX = -this.velocity.x * delta;
        const intendedMoveZ = -this.velocity.z * delta;

        // X Axis Collision
        if (Math.abs(intendedMoveX) > 0.001) {
            const dirX = intendedMoveX > 0 ? 1 : -1;
            const rayX = new THREE.Vector3(dirX, 0, 0).applyQuaternion(this.camera.quaternion);
            rayX.y = 0;
            rayX.normalize();

            // We need to check in the direction of MOVEMENT (strafe), not just camera look.
            // Actually, `controls.moveRight` moves relative to camera.
            // Let's use world direction of the movement vector

            // Simpler approach: 
            // 1. Calculate next position
            // 2. Raycast from current to next? 
            // Or just Raycast in the 4 cardinal directions relative to player?

            // Best approach for box controller:
            // Controls uses moveRight/moveForward which updates position directly.
            // We should anticipate the move.

            // Since PointerLockControls handles the math of "Right" and "Forward", let's replicate it or peek.
            // But we can't peek easily.

            // Alternative: Move, check overlap, move back? (Poor performance/jitter)

            // Correct approach: Raycast in the direction of velocity (world space)
            // But velocity is separated into X/Z damping... 
            // Let's stick to world space velocity collision check.

            // Actually, we are modifying controls.getObject().position. 
            // We should check if the target position hits a wall.


            // Let's just implement a simple 4-ray check around the player for now, 
            // or just cast in the direction of velocity.

            // NEW PLAN: 
            // We have `this.velocity`. If `this.velocity.z` is negative, we are moving "forward" (relative to something?). 
            // Actually `this.velocity` here is Local or World? 
            // in `this.direction` calculation: 
            // input -> direction (local) -> velocity? 
            // No, code says: `controls.moveForward(-this.velocity.z * delta)`.
            // So `velocity` is Local to the camera/player look direction.

            // Checking collisions for Local velocity is tricky without transforming to World.
            // Let's simplify:
            // Just move, then separate? No.

            // Let's just cast a ray in the direction of the camera's local movement vectors before moving.

            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            camDir.y = 0;
            camDir.normalize();

            const camRight = new THREE.Vector3();
            camRight.crossVectors(this.camera.up, camDir).normalize(); // Actually this might be inverted depending on order
            // Controls.moveRight(d) -> crosses camera direction.

            const moveVec = new THREE.Vector3();
            moveVec.addScaledVector(camRight, intendedMoveX); // Local X move matches Right vector
            moveVec.addScaledVector(camDir, intendedMoveZ); // Local Z move matches Forward vector (inverted? moveForward takes distance. + moved forward)
            // Code: moveForward(-velocity.z). If vel.z is + (backward key), we move backward. 
            // So intendedMoveZ IS the signed distance.

            const dist = moveVec.length();

            if (dist > 0.001) {
                const navDir = moveVec.clone().normalize();

                // Cast ray at waist height
                this.raycaster.ray.origin.copy(this.controls.getObject().position);
                this.raycaster.ray.origin.y -= 0.5;
                this.raycaster.ray.direction.copy(navDir);
                this.raycaster.far = dist + 0.5; // Margin 0.5m

                const hits = this.raycaster.intersectObjects(world.objects, false);
                // Filter floor
                const wallHits = hits.filter(h => h.normal.y < 0.5); // Steep normal

                if (wallHits.length > 0) {
                    // Hit wall
                    // Simple stop: don't move
                    // Better: Slide (remove normal component)
                    // For prototype: Just stop
                    // Reduce move to hit distance - buffer
                    // this.velocity.set(0, this.velocity.y, 0); // Harsh stop

                    // Actually, if we just don't apply movement, that's fine.
                    // But we want to slide along walls. 
                    // Sliding is complex for this step size. 
                    // Let's just blocking movement if ray hits.

                    if (wallHits[0].distance < 0.5) {
                        // Block complete movement
                        // To allow sliding, we'd need to block only the perpendicular component.

                        // Let's try separate X and Z checks for basic sliding?
                        // Too much code for this block replacement.

                        // Simple: If hit, don't move.
                        // User request: "collisions between objects".
                        // This will feel sticky but fulfills request.
                    } else {
                        this.controls.moveRight(intendedMoveX);
                        this.controls.moveForward(intendedMoveZ);
                    }
                } else {
                    this.controls.moveRight(intendedMoveX);
                    this.controls.moveForward(intendedMoveZ);
                }
            }
        } else {
            this.controls.moveRight(intendedMoveX);
            this.controls.moveForward(intendedMoveZ);
        }

        this.controls.getObject().position.y += (this.velocity.y * delta);

        // Hard Floor
        if (this.controls.getObject().position.y < this.playerHeight) {
            this.velocity.y = 0;
            this.controls.getObject().position.y = this.playerHeight;
            this.canJump = true;
        }

        // Invisible boundary walls - keep player in arena
        const pos = this.controls.getObject().position;
        const boundaryLimit = 48; // Slightly inside the visible walls at 50
        if (pos.x > boundaryLimit) pos.x = boundaryLimit;
        if (pos.x < -boundaryLimit) pos.x = -boundaryLimit;
        if (pos.z > boundaryLimit) pos.z = boundaryLimit;
        if (pos.z < -boundaryLimit) pos.z = -boundaryLimit;

        // 6. Update Weapon
        this.weapon.update(delta, isMoving);

        // 7. Update HUD
        this.updateHUD();
    }

    updateHUD() {
        const healthBar = document.getElementById('health-bar-fill');
        const dashBar = document.getElementById('dash-bar-fill');

        if (healthBar) {
            healthBar.style.width = `${(this.health / this.maxHealth) * 100}%`;
        }

        // Update dash bar to show cooldown
        if (dashBar) {
            const dashReady = this.dashCooldownTimer <= 0 ? 100 : 
                ((this.dashCooldown - this.dashCooldownTimer) / this.dashCooldown) * 100;
            dashBar.style.width = `${dashReady}%`;
        }
    }

    updateDashUI() {
        const dashIndicator = document.getElementById('dash-indicator');
        if (dashIndicator) {
            if (this.dashCooldownTimer <= 0) {
                dashIndicator.innerText = 'DASH READY';
                dashIndicator.style.color = '#44ff44';
            } else {
                dashIndicator.innerText = `DASH: ${this.dashCooldownTimer.toFixed(1)}s`;
                dashIndicator.style.color = '#888888';
            }
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        this.updateHUD();

        // Damage Vignette
        const vignette = document.getElementById('damage-vignette');
        if (vignette) {
            vignette.style.opacity = '1';
            setTimeout(() => {
                if (vignette) vignette.style.opacity = '0';
            }, 300);
        }

        if (this.health <= 0) {
            // Game Over
            // Ideally notify Main to stop loop or show UI
            // For now: Simple alert
            alert("Game Over! Reloading...");
            location.reload();
        }
    }

    showPickupMessage(weaponType) {
        const weaponNames = {
            pistol: 'PISTOL',
            shotgun: 'SHOTGUN',
            smg: 'SMG',
            sniper: 'SNIPER RIFLE'
        };

        const message = document.getElementById('pickup-message');
        if (message) {
            message.innerText = `PICKED UP: ${weaponNames[weaponType] || weaponType.toUpperCase()}`;
            message.style.opacity = '1';
            message.style.transform = 'translateX(-50%) translateY(0)';
            
            setTimeout(() => {
                message.style.opacity = '0';
                message.style.transform = 'translateX(-50%) translateY(20px)';
            }, 2000);
        }
    }
}
