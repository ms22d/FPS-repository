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

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('click', () => player.lockControls());
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
