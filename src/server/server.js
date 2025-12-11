const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// Resolve root path (2 levels up from src/server)
const rootPath = path.join(__dirname, '../../');
console.log('Serving static files from:', rootPath);

app.use(express.static(rootPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(rootPath, 'index.html'));
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        players: Object.keys(players).length,
        round: gameState.currentRound,
        roundActive: gameState.roundActive
    });
});

// Game State
const players = {};
const projectiles = [];

// Round system state
const gameState = {
    currentRound: 0,
    roundActive: false,
    roundTimer: null,
    roundDuration: 120, // 2 minutes per round
    roundTimeRemaining: 0,
    minPlayersToStart: 2,
    scores: {},
    roundStartCountdown: 5, // seconds before round starts
    intermissionDuration: 5 // seconds between rounds
};

// Spawn points for players
const spawnPoints = [
    { x: -40, y: 1, z: -40 },
    { x: 40, y: 1, z: -40 },
    { x: -40, y: 1, z: 40 },
    { x: 40, y: 1, z: 40 },
    { x: 0, y: 1, z: -35 },
    { x: 0, y: 1, z: 35 },
    { x: -35, y: 1, z: 0 },
    { x: 35, y: 1, z: 0 }
];

function getRandomSpawn() {
    return spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
}

function checkRoundStart() {
    const playerCount = Object.keys(players).length;
    
    if (playerCount >= gameState.minPlayersToStart && !gameState.roundActive) {
        startRoundCountdown();
    }
}

function startRoundCountdown() {
    let countdown = gameState.roundStartCountdown;
    
    io.emit('roundCountdown', { countdown, message: `Round ${gameState.currentRound + 1} starting in...` });
    
    const countdownInterval = setInterval(() => {
        countdown--;
        
        if (countdown > 0) {
            io.emit('roundCountdown', { countdown, message: `Round ${gameState.currentRound + 1} starting in...` });
        } else {
            clearInterval(countdownInterval);
            startRound();
        }
    }, 1000);
}

function startRound() {
    gameState.currentRound++;
    gameState.roundActive = true;
    gameState.roundTimeRemaining = gameState.roundDuration;
    
    // Reset all player health and positions
    Object.keys(players).forEach(playerId => {
        const spawn = getRandomSpawn();
        players[playerId].health = 100;
        players[playerId].x = spawn.x;
        players[playerId].y = spawn.y;
        players[playerId].z = spawn.z;
        players[playerId].alive = true;
        
        // Initialize score if not exists
        if (!gameState.scores[playerId]) {
            gameState.scores[playerId] = 0;
        }
    });
    
    io.emit('roundStart', {
        round: gameState.currentRound,
        duration: gameState.roundDuration,
        players: players,
        scores: gameState.scores
    });
    
    // Start round timer
    gameState.roundTimer = setInterval(() => {
        gameState.roundTimeRemaining--;
        
        io.emit('roundTimer', { timeRemaining: gameState.roundTimeRemaining });
        
        if (gameState.roundTimeRemaining <= 0) {
            endRound('timeout');
        }
    }, 1000);
}

function endRound(reason) {
    if (!gameState.roundActive) return;
    
    gameState.roundActive = false;
    
    if (gameState.roundTimer) {
        clearInterval(gameState.roundTimer);
        gameState.roundTimer = null;
    }
    
    // Determine winner
    let winner = null;
    let winnerScore = -1;
    
    Object.keys(gameState.scores).forEach(playerId => {
        if (gameState.scores[playerId] > winnerScore) {
            winnerScore = gameState.scores[playerId];
            winner = playerId;
        }
    });
    
    io.emit('roundEnd', {
        round: gameState.currentRound,
        reason: reason,
        winner: winner,
        scores: gameState.scores
    });
    
    // Check if enough players for next round after intermission
    setTimeout(() => {
        checkRoundStart();
    }, gameState.intermissionDuration * 1000);
}

function checkAlivePlayersCount() {
    const alivePlayers = Object.values(players).filter(p => p.alive);
    
    if (alivePlayers.length <= 1 && gameState.roundActive) {
        // Only one or zero players alive - round ends
        const winner = alivePlayers.length === 1 ? alivePlayers[0].id : null;
        if (winner) {
            gameState.scores[winner] = (gameState.scores[winner] || 0) + 1;
        }
        endRound(winner ? 'elimination' : 'draw');
    }
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Initialize new player
    const spawn = getRandomSpawn();
    players[socket.id] = {
        id: socket.id,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        rotation: 0,
        health: 100,
        alive: true
    };
    
    // Initialize score
    gameState.scores[socket.id] = 0;

    // Send current players and game state to new player
    socket.emit('currentPlayers', players);
    socket.emit('gameState', {
        round: gameState.currentRound,
        roundActive: gameState.roundActive,
        timeRemaining: gameState.roundTimeRemaining,
        scores: gameState.scores
    });

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Check if we can start a round
    checkRoundStart();

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        delete gameState.scores[socket.id];
        io.emit('playerDisconnected', socket.id);
        
        // Check if round should end due to not enough players
        if (gameState.roundActive) {
            checkAlivePlayersCount();
        }
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;

            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('shoot', (shootData) => {
        socket.broadcast.emit('playerShot', {
            id: socket.id,
            position: shootData.position,
            direction: shootData.direction
        });
    });

    socket.on('hit', (hitData) => {
        const targetId = hitData.targetId;
        const damage = hitData.damage;

        if (players[targetId]) {
            players[targetId].health -= damage;
            io.to(targetId).emit('takeDamage', damage);

            if (players[targetId].health <= 0 && players[targetId].alive) {
                // Player died
                players[targetId].alive = false;
                
                // Award kill to shooter
                if (gameState.scores[socket.id] !== undefined) {
                    gameState.scores[socket.id]++;
                }
                
                io.emit('playerKilled', {
                    killer: socket.id,
                    victim: targetId,
                    scores: gameState.scores
                });
                
                // Check if round should end
                checkAlivePlayersCount();
            }
        }
    });
    
    // Request respawn (for next round)
    socket.on('requestRespawn', () => {
        if (players[socket.id] && !gameState.roundActive) {
            const spawn = getRandomSpawn();
            players[socket.id].health = 100;
            players[socket.id].x = spawn.x;
            players[socket.id].y = spawn.y;
            players[socket.id].z = spawn.z;
            players[socket.id].alive = true;
            
            socket.emit('respawn', players[socket.id]);
        }
    });
});

// Use PORT from environment variable (Render provides this)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
