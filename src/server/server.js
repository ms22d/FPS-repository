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
    res.status(200).json({ status: 'ok', players: Object.keys(players).length });
});

// Game State
const players = {};
const projectiles = [];

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Initialize new player
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 1,
        z: 0,
        rotation: 0,
        health: 100
    };

    // Send current players to new player
    socket.emit('currentPlayers', players);

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
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
        // Simple trust client for now
        const targetId = hitData.targetId;
        const damage = hitData.damage;

        if (players[targetId]) {
            players[targetId].health -= damage;
            io.to(targetId).emit('takeDamage', damage);

            if (players[targetId].health <= 0) {
                // Respawn logic or just Game Over
                // For now, let client handle death
            }
        }
    });
});

// Use PORT from environment variable (Render provides this)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
