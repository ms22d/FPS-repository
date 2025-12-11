import * as THREE from 'three';
import { Player } from './Player.js';
import { World } from './World.js';
// import { Enemy } from './Enemy.js'; // Removed
import { NetworkManager } from './NetworkManager.js';
import { Projectile } from './Projectile.js';

// --- CONFIGURATION ---
// PSX-inspired dark and gloomy atmosphere
const SCENE_BG_COLOR = 0x0a0a0f; // Very dark blue-black
const FOG_COLOR = 0x1a1520; // Dark purple-grey fog

// --- GLOBAL VARIABLES ---
let camera, scene, renderer;
let player, world, networkManager;
let projectiles = [];
let lastTime = 0;

// PSX-style render target for pixelation
let renderTarget;
const PSX_RESOLUTION_SCALE = 0.35; // Lower = more pixelated (PSX style)

init();
animate(0);

function init() {
    // 1. Setup Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG_COLOR);
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.04); // Exponential fog for creepier effect

    // 2. Setup Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    scene.add(camera); // Required for children of camera (gun) to be rendered

    // 3. Setup Renderer - PSX style (no antialiasing, low resolution)
    renderer = new THREE.WebGLRenderer({ antialias: false }); // No antialiasing for PSX look
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(PSX_RESOLUTION_SCALE); // Low resolution for pixelated look
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap; // Harsh shadows for PSX feel
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    document.body.appendChild(renderer.domElement);
    
    // Make canvas pixelated (no smoothing)
    renderer.domElement.style.imageRendering = 'pixelated';

    // 4. Setup World (Lights, Floor, Objects)
    world = new World(scene);

    // 5. Setup Player (Controls, Physics, Weapon)
    player = new Player(camera, scene, document.body, world);

    // 6. Network Manager
    networkManager = new NetworkManager(player, scene);
    networkManager.setOnShootCallback((proj) => {
        projectiles.push(proj);
    });

    // Setup round UI callbacks
    networkManager.setRoundCallbacks(
        handleRoundUpdate,
        handleScoreUpdate,
        handleKillEvent
    );

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('click', () => player.lockControls());
}

// Round UI Handlers
function handleRoundUpdate(data) {
    const roundNumber = document.getElementById('round-number');
    const roundTimer = document.getElementById('round-timer');
    const announcement = document.getElementById('round-announcement');
    const announcementText = document.getElementById('announcement-text');

    switch (data.type) {
        case 'gameState':
            if (data.active) {
                roundNumber.innerText = `ROUND ${data.round}`;
                updateTimerDisplay(data.timeRemaining);
            } else {
                roundNumber.innerText = 'WAITING FOR PLAYERS';
                roundTimer.innerText = '--:--';
            }
            break;

        case 'countdown':
            roundNumber.innerText = data.message;
            roundTimer.innerText = data.countdown;
            
            announcement.style.display = 'block';
            announcementText.innerText = data.countdown;
            break;

        case 'roundStart':
            roundNumber.innerText = `ROUND ${data.round}`;
            updateTimerDisplay(data.duration);
            
            announcement.style.display = 'block';
            announcementText.innerText = 'FIGHT!';
            
            setTimeout(() => {
                announcement.style.display = 'none';
            }, 2000);
            break;

        case 'timer':
            updateTimerDisplay(data.timeRemaining);
            break;

        case 'roundEnd':
            let endText = 'ROUND OVER';
            if (data.reason === 'elimination') {
                endText = data.winner === networkManager.getMyId() ? 'VICTORY!' : 'ELIMINATED';
            } else if (data.reason === 'timeout') {
                endText = 'TIME UP';
            }
            
            announcement.style.display = 'block';
            announcementText.innerText = endText;
            
            setTimeout(() => {
                announcement.style.display = 'none';
                roundNumber.innerText = 'NEXT ROUND STARTING...';
                roundTimer.innerText = '--:--';
            }, 3000);
            break;
    }
}

function updateTimerDisplay(seconds) {
    const roundTimer = document.getElementById('round-timer');
    if (!roundTimer) return;
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    roundTimer.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Flash red when low time
    if (seconds <= 10) {
        roundTimer.style.animation = 'announcePulse 0.5s infinite';
    } else {
        roundTimer.style.animation = 'none';
    }
}

function handleScoreUpdate(scores) {
    const scoreList = document.getElementById('score-list');
    if (!scoreList) return;
    
    const myId = networkManager.getMyId();
    
    // Sort by score
    const sortedScores = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8); // Top 8
    
    scoreList.innerHTML = sortedScores.map(([id, score]) => {
        const isMe = id === myId;
        const shortId = id.substring(0, 6);
        return `<div class="score-entry${isMe ? ' me' : ''}">
            <span>${isMe ? 'YOU' : shortId}</span>
            <span>${score}</span>
        </div>`;
    }).join('');
}

function handleKillEvent(data) {
    const killFeed = document.getElementById('kill-feed');
    if (!killFeed) return;
    
    const myId = networkManager.getMyId();
    const killerName = data.killer === myId ? 'You' : data.killer.substring(0, 6);
    const victimName = data.victim === myId ? 'You' : data.victim.substring(0, 6);
    
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.innerHTML = `<span style="color: ${data.killer === myId ? '#44ff44' : '#ff6666'}">${killerName}</span> ☠ <span style="color: ${data.isMe ? '#ff0000' : '#888'}">${victimName}</span>`;
    
    killFeed.insertBefore(entry, killFeed.firstChild);
    
    // Remove old entries
    while (killFeed.children.length > 5) {
        killFeed.removeChild(killFeed.lastChild);
    }
    
    // Fade out after 5 seconds
    setTimeout(() => {
        entry.style.opacity = '0';
        setTimeout(() => entry.remove(), 500);
    }, 5000);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time) {
    requestAnimationFrame(animate);

    const delta = (time - lastTime) / 1000;
    lastTime = time;

    // Cap delta to prevent huge jumps if tab is inactive
    const safeDelta = Math.min(delta, 0.1);

    if (player) {
        player.update(safeDelta, world);

        // Weapon Shoot Callback integration
        if (!player.weapon.onShoot) {
            player.weapon.onShoot = (dir) => {
                networkManager.sendShoot(dir);
            };
        }
    }

    if (networkManager) networkManager.update(safeDelta);

    // Update Projectiles with world collision
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        if (proj.alive) {
            proj.update(safeDelta, player, world);
        } else {
            projectiles.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}
