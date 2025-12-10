import { RemotePlayer } from './RemotePlayer.js';

export class NetworkManager {
    constructor(player, scene) {
        this.player = player;
        this.scene = scene;

        if (typeof io === 'undefined') {
            console.error('Socket.io not loaded!');
            alert('Network Error: Socket.io failed to load. Multiplayer will not work.');
            return;
        }

        this.socket = io();
        this.remotePlayers = {}; // id -> RemotePlayer
        this.lastUpdateTime = 0;
        this.updateRate = 0.05; // 20 updates per second (50ms)

        this.setupSocketListeners();
    }

    // ...

    update(delta) {
        Object.values(this.remotePlayers).forEach(p => p.update(delta));

        this.lastUpdateTime += delta;
        if (this.lastUpdateTime >= this.updateRate) {
            this.sendUpdate(); // Send my movement
            this.lastUpdateTime = 0;
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
        });

        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (id === this.socket.id) return;
                this.addRemotePlayer(players[id]);
            });
        });

        this.socket.on('newPlayer', (playerInfo) => {
            this.addRemotePlayer(playerInfo);
        });

        this.socket.on('playerDisconnected', (id) => {
            this.removeRemotePlayer(id);
        });

        this.socket.on('playerMoved', (playerInfo) => {
            if (this.remotePlayers[playerInfo.id]) {
                this.remotePlayers[playerInfo.id].updatePosition(playerInfo);
            }
        });

        this.socket.on('playerShot', (shootData) => {
            // Buffer the shot? Or just fire immediately if we have the callback?
            // We need to pass the projectile creation up to Main.
            // Let's store pending shots or just fire if we have the reference.
            // Better: NetworkManager.update() calls RemotePlayer.update(), but shoot is event based.
            // We can just trigger it here if we have a callback stored, or store the event.

            if (this.remotePlayers[shootData.id]) {
                // We need the onShoot callback here.
                // Let's store a reference or emit an event.
                if (this.onShootCallback) {
                    this.remotePlayers[shootData.id].shoot(shootData.direction, this.onShootCallback);
                }
            }
        });

        this.socket.on('takeDamage', (damage) => {
            if (this.player.takeDamage) {
                this.player.takeDamage(damage);
            }
        });
    }

    // Set callback for projectile spawning
    setOnShootCallback(cb) {
        this.onShootCallback = cb;
    }

    update(delta) {
        // Update remote players (interpolation)
        Object.values(this.remotePlayers).forEach(p => p.update(delta));

        // Throttle outgoing updates
        this.lastUpdateTime += delta;
        if (this.lastUpdateTime >= this.updateRate) {
            this.sendUpdate();
            this.lastUpdateTime = 0;
        }
    }

    addRemotePlayer(playerInfo) {
        if (!this.remotePlayers[playerInfo.id]) {
            this.remotePlayers[playerInfo.id] = new RemotePlayer(this.scene, playerInfo);
        }
    }

    removeRemotePlayer(id) {
        if (this.remotePlayers[id]) {
            this.remotePlayers[id].cleanup();
            delete this.remotePlayers[id];
        }
    }

    sendUpdate() {
        if (!this.player) return;

        const pos = this.player.controls.getObject().position;
        const rot = this.player.controls.getObject().rotation.y; // Yaw

        this.socket.emit('playerMovement', {
            x: pos.x,
            y: pos.y,
            z: pos.z,
            rotation: rot
        });
    }

    sendShoot(direction) {
        const pos = this.player.controls.getObject().position;
        this.socket.emit('shoot', {
            position: { x: pos.x, y: pos.y, z: pos.z },
            direction: direction
        });
    }

    sendHit(targetId, damage) {
        this.socket.emit('hit', {
            targetId: targetId,
            damage: damage
        });
    }
}
