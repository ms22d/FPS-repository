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

        // Round system state
        this.roundActive = false;
        this.currentRound = 0;
        this.timeRemaining = 0;
        this.scores = {};
        
        // UI callbacks
        this.onRoundUpdate = null;
        this.onScoreUpdate = null;
        this.onKillEvent = null;

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
            if (this.remotePlayers[shootData.id]) {
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

        // Round system events
        this.socket.on('gameState', (state) => {
            this.currentRound = state.round;
            this.roundActive = state.roundActive;
            this.timeRemaining = state.timeRemaining;
            this.scores = state.scores;
            
            if (this.onRoundUpdate) {
                this.onRoundUpdate({
                    type: 'gameState',
                    round: this.currentRound,
                    active: this.roundActive,
                    timeRemaining: this.timeRemaining
                });
            }
            if (this.onScoreUpdate) {
                this.onScoreUpdate(this.scores);
            }
        });

        this.socket.on('roundCountdown', (data) => {
            if (this.onRoundUpdate) {
                this.onRoundUpdate({
                    type: 'countdown',
                    countdown: data.countdown,
                    message: data.message
                });
            }
        });

        this.socket.on('roundStart', (data) => {
            this.currentRound = data.round;
            this.roundActive = true;
            this.timeRemaining = data.duration;
            this.scores = data.scores;
            
            // Respawn player at new position
            if (data.players && data.players[this.socket.id]) {
                const myData = data.players[this.socket.id];
                this.player.respawn(myData.x, myData.y, myData.z);
            }
            
            if (this.onRoundUpdate) {
                this.onRoundUpdate({
                    type: 'roundStart',
                    round: this.currentRound,
                    duration: data.duration
                });
            }
            if (this.onScoreUpdate) {
                this.onScoreUpdate(this.scores);
            }
        });

        this.socket.on('roundTimer', (data) => {
            this.timeRemaining = data.timeRemaining;
            
            if (this.onRoundUpdate) {
                this.onRoundUpdate({
                    type: 'timer',
                    timeRemaining: this.timeRemaining
                });
            }
        });

        this.socket.on('roundEnd', (data) => {
            this.roundActive = false;
            this.scores = data.scores;
            
            if (this.onRoundUpdate) {
                this.onRoundUpdate({
                    type: 'roundEnd',
                    round: data.round,
                    reason: data.reason,
                    winner: data.winner
                });
            }
            if (this.onScoreUpdate) {
                this.onScoreUpdate(this.scores);
            }
        });

        this.socket.on('playerKilled', (data) => {
            this.scores = data.scores;
            
            if (this.onKillEvent) {
                this.onKillEvent({
                    killer: data.killer,
                    victim: data.victim,
                    isMe: data.victim === this.socket.id
                });
            }
            if (this.onScoreUpdate) {
                this.onScoreUpdate(this.scores);
            }
        });

        this.socket.on('respawn', (playerData) => {
            if (this.player.respawn) {
                this.player.respawn(playerData.x, playerData.y, playerData.z);
            }
        });
    }

    // Set callback for projectile spawning
    setOnShootCallback(cb) {
        this.onShootCallback = cb;
    }

    // Set callbacks for round UI
    setRoundCallbacks(onRoundUpdate, onScoreUpdate, onKillEvent) {
        this.onRoundUpdate = onRoundUpdate;
        this.onScoreUpdate = onScoreUpdate;
        this.onKillEvent = onKillEvent;
    }

    getMyId() {
        return this.socket ? this.socket.id : null;
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

    requestRespawn() {
        this.socket.emit('requestRespawn');
    }
}
