/**
 * AI NEON BLASTER - Core Game Engine
 * Includes real-time Dynamic Difficulty Adjustment (DDA) sync.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const overlay = document.getElementById('overlay');
const finalOverlay = document.getElementById('finalOverlay');
const hpBar = document.getElementById('hpBar');
const scoreValue = document.getElementById('scoreValue');
const aiMessage = document.getElementById('aiMessage');
const difficultyValue = document.getElementById('difficultyValue');

// Game State
let gameActive = false;
let score = 0;
let player, enemies, bullets, particles;
let keys = {};
let lastAiSync = 0;
let stats = {
    shots_fired: 0,
    shots_hit: 0,
    enemies_killed: 0,
    enemies_escaped: 0,
    start_time: 0
};

// Difficulty Multipliers (Controlled by AI)
let difficulty = {
    multiplier: 1.0,
    spawnRate: 1000,
    enemySpeed: 2,
    bulletSpeed: 7
};

class Player {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 100;
        this.speed = 6;
        this.hp = 100;
        this.color = '#00f2ff';
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        
        // Ship geometry
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    update() {
        if (keys['w'] || keys['ArrowUp']) this.y -= this.speed;
        if (keys['s'] || keys['ArrowDown']) this.y += this.speed;
        if (keys['a'] || keys['ArrowLeft']) this.x -= this.speed;
        if (keys['d'] || keys['ArrowRight']) this.x += this.speed;

        // Boundaries
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
    }
}

class Enemy {
    constructor(speedMult) {
        this.width = 30;
        this.height = 30;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -50;
        this.speed = (1.5 + Math.random() * 2) * speedMult;
        this.color = '#ff00ff';
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        return this.y > canvas.height;
    }
}

class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 15;
        this.speed = 10;
        this.color = '#00f2ff';
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
    }

    update() {
        this.y -= this.speed;
        return this.y < -50;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.color = color;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.02;
        return this.life <= 0;
    }
}

// System Functions
function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player = new Player();
    enemies = [];
    bullets = [];
    particles = [];
    score = 0;
    stats = { shots_fired: 0, shots_hit: 0, enemies_killed: 0, enemies_escaped: 0, start_time: Date.now() };
    difficulty = { multiplier: 1.0, spawnRate: 1000, enemySpeed: 2, bulletSpeed: 7 };
    updateHUD();
}

function spawnEnemy() {
    if (!gameActive) return;
    enemies.push(new Enemy(difficulty.multiplier));
    setTimeout(spawnEnemy, Math.max(200, difficulty.spawnRate / difficulty.multiplier));
}

async function syncWithAI() {
    if (!gameActive) return;

    const playTime = (Date.now() - stats.start_time) / 1000;
    const accuracy = stats.shots_fired > 0 ? stats.shots_hit / stats.shots_fired : 1.0;

    const telemetry = {
        acc: accuracy,
        health: player.hp,
        killed: stats.enemies_killed,
        escaped: stats.enemies_escaped,
        time: playTime
    };

    try {
        const response = await fetch('http://localhost:8000/adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telemetry)
        });
        const data = await response.json();
        
        difficulty.multiplier = data.difficulty;
        aiMessage.textContent = data.message;
        difficultyValue.textContent = `${data.difficulty}x`;
    } catch (e) {
        console.warn("AI Server not reachable. Using fallback difficulty.");
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateHUD() {
    hpBar.style.width = player.hp + "%";
    scoreValue.textContent = score.toString().padStart(6, '0');
    if (player.hp < 30) hpBar.style.background = '#ff00ff';
    else hpBar.style.background = 'linear-gradient(90deg, #00f2ff, #ff00ff)';
}

function gameOver() {
    gameActive = false;
    finalOverlay.classList.remove('hidden');
    document.getElementById('finalScore').textContent = score;
    const acc = stats.shots_fired > 0 ? Math.round((stats.shots_hit / stats.shots_fired) * 100) : 100;
    document.getElementById('finalAcc').textContent = acc + "%";
}

// Game Loop
function animate(time) {
    if (!gameActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // AI Syncing every 2 seconds
    if (time - lastAiSync > 2000) {
        syncWithAI();
        lastAiSync = time;
    }

    player.update();
    player.draw();

    // Bullets logic
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (bullets[i].update()) {
            bullets.splice(i, 1);
        } else {
            bullets[i].draw();
        }
    }

    // Enemies logic
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].update()) {
            stats.enemies_escaped++;
            enemies.splice(i, 1);
        } else {
            enemies[i].draw();

            // Collision with Player
            if (
                player.x < enemies[i].x + enemies[i].width &&
                player.x + player.width > enemies[i].x &&
                player.y < enemies[i].y + enemies[i].height &&
                player.y + player.height > enemies[i].y
            ) {
                player.hp -= 10;
                createExplosion(enemies[i].x, enemies[i].y, '#ff00ff');
                enemies.splice(i, 1);
                updateHUD();
                if (player.hp <= 0) gameOver();
                continue;
            }

            // Collision with Bullets
            for (let j = bullets.length - 1; j >= 0; j--) {
                if (
                    bullets[j].x < enemies[i].x + enemies[i].width &&
                    bullets[j].x > enemies[i].x &&
                    bullets[j].y < enemies[i].y + enemies[i].height &&
                    bullets[j].y > enemies[i].y
                ) {
                    createExplosion(enemies[i].x, enemies[i].y, '#ff00ff');
                    enemies.splice(i, 1);
                    bullets.splice(j, 1);
                    score += 100;
                    stats.enemies_killed++;
                    stats.shots_hit++;
                    updateHUD();
                    break;
                }
            }
        }
    }

    // Particles logic
    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].update()) {
            particles.splice(i, 1);
        } else {
            particles[i].draw();
        }
    }

    requestAnimationFrame(animate);
}

// Event Listeners
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.code === 'Space' && gameActive) {
        bullets.push(new Bullet(player.x + player.width / 2, player.y));
        stats.shots_fired++;
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    gameActive = true;
    init();
    spawnEnemy();
    requestAnimationFrame(animate);
});

restartBtn.addEventListener('click', () => {
    finalOverlay.classList.add('hidden');
    gameActive = true;
    init();
    spawnEnemy();
    requestAnimationFrame(animate);
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Check if server is running
fetch('http://localhost:8000/adjust', { method: 'OPTIONS' })
    .then(() => {
        document.getElementById('serverStatus').textContent = "AI DIRECTOR ONLINE";
        document.getElementById('serverStatus').classList.replace('status-warning', 'status-ready');
    })
    .catch(() => {
        // Silent fail, used for initial status check
    });
