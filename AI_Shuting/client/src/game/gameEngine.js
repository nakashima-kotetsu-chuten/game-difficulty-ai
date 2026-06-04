/**
 * AI NEON BLASTER - Core Game Engine
 * DDA: 期間被弾数 → 弾幕 / 期間撃墜率 → 出現間隔
 */

import { AIDirector } from './aiDirector';
import {
  createDefaultDdaSettings,
  normalizeDdaSettings,
} from './ddaSettings';
import {
  BULLET_ANGLE_JITTER_RAD,
  ENEMY_BULLET_COLOR,
  ENEMY_SHOT_ARC,
  ENEMY_SPAWN,
  FIXED,
  clampEvenBulletCount,
  getBurstAngles,
  getHealPerKill,
} from './difficultyParams';

function formatSurvivalTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function randomEnemySpawnX(canvasWidth, enemyWidth) {
  const margin = canvasWidth * ENEMY_SPAWN.marginRatio;
  const usable = canvasWidth - enemyWidth - margin * 2;
  const lane = Math.floor(Math.random() * ENEMY_SPAWN.laneCount);
  const laneWidth = usable / ENEMY_SPAWN.laneCount;
  const center = margin + lane * laneWidth + laneWidth / 2;
  const jitter =
    (Math.random() - 0.5) * laneWidth * ENEMY_SPAWN.laneJitter;
  return Math.max(
    margin,
    Math.min(canvasWidth - enemyWidth - margin, center - enemyWidth / 2 + jitter)
  );
}

export function createGameEngine(canvas, callbacks) {
  const ctx = canvas.getContext('2d');
  const { onHudUpdate, onDifficultyUpdate, onGameOver } = callbacks;

  let gameActive = false;
  let score = 0;
  let player;
  let enemies;
  let playerBullets;
  let enemyBullets;
  let particles;
  const keys = {};
  let lastBulletAdjust = 0;
  let lastSpawnAdjust = 0;
  let stats = {
    shots_fired: 0,
    shots_hit: 0,
    enemies_killed: 0,
    enemies_escaped: 0,
  };

  let bulletPeriodStats = { hits: 0 };
  let spawnPeriodStats = { spawned: 0, killed: 0 };
  let difficulty = null;

  let spawnTimeoutId = null;
  let rafId = null;
  let gameStartTime = 0;
  let ddaHistory = [];
  let ddaSettings = createDefaultDdaSettings();
  const director = new AIDirector(ddaSettings);

  class Player {
    constructor() {
      this.width = 40;
      this.height = 40;
      this.x = canvas.width / 2 - this.width / 2;
      this.y = canvas.height - 100;
      this.speed = 6;
      this.hp = FIXED.playerHp;
      this.color = '#00f2ff';
      this.invincibleUntil = 0;
    }

    isInvincible(now) {
      return now < this.invincibleUntil;
    }

    draw(now) {
      if (this.isInvincible(now) && Math.floor(now / 40) % 2 === 0) {
        return;
      }
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
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
      this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
      this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
    }
  }

  function snapshotBulletProfile() {
    const r = ddaSettings.ranges;
    const speed =
      difficulty.enemyBulletSpeed ?? FIXED.defaultEnemyBulletSpeed;
    return {
      count: clampEvenBulletCount(
        difficulty.enemyBulletCount,
        r.enemyBulletCount
      ),
      speed,
      fireIntervalMs: clampMs(
        difficulty.enemyFireIntervalMs,
        r.enemyFireIntervalMs.min,
        r.enemyFireIntervalMs.max,
        ddaSettings.initial.enemyFireIntervalMs
      ),
    };
  }

  class Enemy {
    constructor() {
      this.width = 30;
      this.height = 30;
      this.x = randomEnemySpawnX(canvas.width, this.width);
      this.y = -50;
      const mult = FIXED.enemyMoveSpeedMult;
      this.speed = (1.5 + Math.random() * 2) * mult;
      this.color = '#ff00ff';
      this.lastFireTime = 0;
      /** 出現時点の弾幕設定（DDA 変更の影響を受けない） */
      this.bulletProfile = snapshotBulletProfile();
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

    tryFire(now) {
      if (now - this.lastFireTime < this.bulletProfile.fireIntervalMs) return;
      this.lastFireTime = now;
      fireRadialBurst(this, this.bulletProfile);
    }
  }

  class PlayerBullet {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = 4;
      this.height = 15;
      this.hitHalfWidth = FIXED.playerBulletHitHalfWidth;
      this.hitHeight = FIXED.playerBulletHitHeight;
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

  class EnemyBullet {
    constructor(x, y, vx, vy, speed) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.speed = speed;
      this.radius = 6;
      this.color = ENEMY_BULLET_COLOR;
    }

    draw() {
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      return (
        this.y - this.radius > canvas.height + 20 ||
        this.x + this.radius < -20 ||
        this.x - this.radius > canvas.width + 20
      );
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

  function recordPeriodHit() {
    bulletPeriodStats.hits += 1;
  }

  function damagePlayer(amount, now) {
    if (player.isInvincible(now)) return;
    player.hp -= amount;
    player.invincibleUntil = now + FIXED.invincibilityMs;
    recordPeriodHit();
    updateHUD(now);
    if (player.hp <= 0) endGame();
  }

  function fireRadialBurst(enemy, profile) {
    const cx = enemy.x + enemy.width / 2;
    const cy = enemy.y + enemy.height;
    const count = profile.count;
    const speed = profile.speed ?? FIXED.defaultEnemyBulletSpeed;
    if (!count || count < 2 || !Number.isFinite(speed)) return;

    const baseAngles = getBurstAngles(count);
    for (let i = 0; i < count; i++) {
      const jitter = (Math.random() - 0.5) * 2 * BULLET_ANGLE_JITTER_RAD;
      const angle = baseAngles[i] + jitter;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      enemyBullets.push(new EnemyBullet(cx, cy, vx, vy, speed));
    }
  }

  function playerBulletHitsEnemy(pb, enemy) {
    const left = pb.x - pb.hitHalfWidth;
    const right = pb.x + pb.hitHalfWidth;
    const top = pb.y;
    const bottom = pb.y + pb.hitHeight;
    return (
      right > enemy.x &&
      left < enemy.x + enemy.width &&
      bottom > enemy.y &&
      top < enemy.y + enemy.height
    );
  }

  function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < r * r;
  }

  function syncDifficultyFromDirector() {
    difficulty = sanitizeDifficultyState(director.getState());
  }

  function sanitizeDifficultyState(state) {
    const r = ddaSettings.ranges;
    const init = ddaSettings.initial;
    const s = { ...state };
    s.spawnIntervalMs = clampMs(
      s.spawnIntervalMs,
      r.spawnIntervalMs.min,
      r.spawnIntervalMs.max,
      init.spawnIntervalMs
    );
    s.enemyFireIntervalMs = clampMs(
      s.enemyFireIntervalMs,
      r.enemyFireIntervalMs.min,
      r.enemyFireIntervalMs.max,
      init.enemyFireIntervalMs
    );
    s.enemyBulletSpeed = Number.isFinite(s.enemyBulletSpeed)
      ? Math.max(
          r.enemyBulletSpeed.min,
          Math.min(r.enemyBulletSpeed.max, s.enemyBulletSpeed)
        )
      : init.enemyBulletSpeed;
    s.enemyBulletCount = clampEvenBulletCount(
      s.enemyBulletCount ?? init.enemyBulletCount,
      r.enemyBulletCount
    );
    return s;
  }

  function clampMs(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function getSpawnDelayMs() {
    return difficulty?.spawnIntervalMs ?? 1200;
  }

  function recordDdaSnapshot(elapsedMs) {
    const s = director.getState();
    ddaHistory.push({
      tSec: Math.round((elapsedMs / 1000) * 10) / 10,
      enemyBulletCount: s.enemyBulletCount,
      enemyBulletSpeed: s.enemyBulletSpeed,
      enemyFireIntervalMs: s.enemyFireIntervalMs,
      spawnIntervalMs: s.spawnIntervalMs,
    });
  }

  function buildDdaPayload(message, metrics = {}) {
    const display = director.getDisplayMetrics();
    return {
      message,
      ddaEnabled: ddaSettings.enabled,
      spawnIntervalMs: difficulty.spawnIntervalMs,
      enemyBulletSpeed: difficulty.enemyBulletSpeed,
      enemyBulletCount: difficulty.enemyBulletCount,
      enemyFireIntervalMs: difficulty.enemyFireIntervalMs,
      enemySpeedMin: display.enemySpeedMin,
      enemySpeedMax: display.enemySpeedMax,
      targetKillRatePct: display.targetKillRatePct,
      trend: 'hold',
      delta: 0,
      ...metrics,
    };
  }

  function emitDifficultyState(message, metrics) {
    onDifficultyUpdate?.(buildDdaPayload(message, metrics));
  }

  function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player = new Player();
    enemies = [];
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    score = 0;
    stats = {
      shots_fired: 0,
      shots_hit: 0,
      enemies_killed: 0,
      enemies_escaped: 0,
    };
    bulletPeriodStats = { hits: 0 };
    spawnPeriodStats = { spawned: 0, killed: 0 };
    director.reset();
    syncDifficultyFromDirector();
    ddaHistory = [];
    recordDdaSnapshot(0);
    updateHUD();
    emitDifficultyState(
      ddaSettings.enabled ? 'INITIALIZING...' : 'DDA OFF — FIXED DIFFICULTY'
    );
  }

  function scheduleNextSpawn() {
    if (!gameActive) return;
    spawnTimeoutId = setTimeout(() => {
      if (!gameActive) return;
      enemies.push(new Enemy());
      spawnPeriodStats.spawned += 1;
      scheduleNextSpawn();
    }, getSpawnDelayMs());
  }

  function rescheduleSpawnLoop() {
    if (!gameActive) return;
    if (spawnTimeoutId) clearTimeout(spawnTimeoutId);
    scheduleNextSpawn();
  }

  function publishDda(metrics = {}) {
    syncDifficultyFromDirector();
    const message = ddaSettings.enabled
      ? director.getCombinedMessage()
      : 'DDA OFF — FIXED DIFFICULTY';
    onDifficultyUpdate?.(buildDdaPayload(message, metrics));
  }

  function runBulletAdjust(now = performance.now()) {
    if (!gameActive || !ddaSettings.enabled) return;
    const result = director.adjustBullets(bulletPeriodStats, now);
    bulletPeriodStats = { hits: 0 };
    syncDifficultyFromDirector();
    recordDdaSnapshot(now - gameStartTime);
    publishDda(result.metrics);
  }

  function runSpawnAdjust(now = performance.now()) {
    if (!gameActive || !ddaSettings.enabled) return;
    const prevSpawn = difficulty.spawnIntervalMs;
    const result = director.adjustSpawn(spawnPeriodStats);
    spawnPeriodStats = { spawned: 0, killed: 0 };
    syncDifficultyFromDirector();
    if (difficulty.spawnIntervalMs !== prevSpawn) {
      rescheduleSpawnLoop();
    }
    recordDdaSnapshot(now - gameStartTime);
    publishDda(result.metrics);
  }

  function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
      particles.push(new Particle(x, y, color));
    }
  }

  function updateHUD(now = performance.now()) {
    const lowHp = player.hp < 30;
    const elapsed = gameStartTime > 0 ? now - gameStartTime : 0;
    onHudUpdate?.({
      hp: player.hp,
      score: score.toString().padStart(6, '0'),
      survivalTime: formatSurvivalTime(elapsed),
      hpBarBackground: lowHp
        ? '#ff00ff'
        : 'linear-gradient(90deg, #00f2ff, #ff00ff)',
    });
  }

  function endGame() {
    gameActive = false;
    if (spawnTimeoutId) clearTimeout(spawnTimeoutId);
    const acc =
      stats.shots_fired > 0
        ? Math.round((stats.shots_hit / stats.shots_fired) * 100)
        : 100;
    const survivalTime = formatSurvivalTime(performance.now() - gameStartTime);
    onGameOver?.({
      score,
      accuracy: `${acc}%`,
      survivalTime,
      ddaHistory: [...ddaHistory],
    });
  }

  function animate(time) {
    if (!gameActive) return;

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cycleMs = ddaSettings.timing.cycleMs;
      if (ddaSettings.enabled && time - lastBulletAdjust >= cycleMs) {
        runBulletAdjust(time);
        lastBulletAdjust = time;
      }
      if (ddaSettings.enabled && time - lastSpawnAdjust >= cycleMs) {
        runSpawnAdjust(time);
        lastSpawnAdjust = time;
      }

      player.update();
      player.draw(time);

      for (let i = playerBullets.length - 1; i >= 0; i--) {
        if (playerBullets[i].update()) {
          playerBullets.splice(i, 1);
        } else {
          playerBullets[i].draw();
        }
      }

      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        if (b.update()) {
          enemyBullets.splice(i, 1);
          continue;
        }
        b.draw();
        if (
          circleRectHit(
            b.x,
            b.y,
            b.radius,
            player.x,
            player.y,
            player.width,
            player.height
          )
        ) {
          damagePlayer(FIXED.bulletHitDamage, time);
          createExplosion(b.x, b.y, ENEMY_BULLET_COLOR);
          enemyBullets.splice(i, 1);
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.update()) {
          stats.enemies_escaped++;
          enemies.splice(i, 1);
          continue;
        }

        enemy.tryFire(time);
        enemy.draw();

        if (
          player.x < enemy.x + enemy.width &&
          player.x + player.width > enemy.x &&
          player.y < enemy.y + enemy.height &&
          player.y + player.height > enemy.y
        ) {
          damagePlayer(FIXED.bodyHitDamage, time);
          createExplosion(enemy.x, enemy.y, '#ff00ff');
          enemies.splice(i, 1);
          continue;
        }

        for (let j = playerBullets.length - 1; j >= 0; j--) {
          const pb = playerBullets[j];
          if (playerBulletHitsEnemy(pb, enemy)) {
            createExplosion(enemy.x, enemy.y, '#ff00ff');
            enemies.splice(i, 1);
            playerBullets.splice(j, 1);
            score += 100;
            stats.enemies_killed++;
            spawnPeriodStats.killed += 1;
            stats.shots_hit++;
            player.hp = Math.min(
              FIXED.playerHp,
              player.hp + getHealPerKill()
            );
            updateHUD(time);
            break;
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].update()) {
          particles.splice(i, 1);
        } else {
          particles[i].draw();
        }
      }

      updateHUD(time);
    } catch (err) {
      console.error('[gameEngine] animate error:', err);
    } finally {
      if (gameActive) {
        rafId = requestAnimationFrame(animate);
      }
    }
  }

  function firePlayerBullet() {
    if (!gameActive || !player) return;
    playerBullets.push(
      new PlayerBullet(player.x + player.width / 2, player.y)
    );
    stats.shots_fired++;
  }

  function setVirtualKey(key, pressed) {
    const k = key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(k)) {
      keys[k] = pressed;
    }
  }

  function clearVirtualKeys() {
    keys['w'] = false;
    keys['a'] = false;
    keys['s'] = false;
    keys['d'] = false;
  }

  function onKeyDown(e) {
    if (e.code === 'Space' && gameActive) {
      e.preventDefault();
      firePlayerBullet();
      return;
    }
    keys[e.key.toLowerCase()] = true;
  }

  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }

  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function start(settings) {
    gameActive = false;
    if (spawnTimeoutId) clearTimeout(spawnTimeoutId);
    if (rafId) cancelAnimationFrame(rafId);
    clearVirtualKeys();
    if (settings) {
      ddaSettings = normalizeDdaSettings(settings);
      director.applySettings(ddaSettings);
    }
    gameActive = true;
    const now = performance.now();
    init();
    gameStartTime = now;
    lastBulletAdjust = now;
    lastSpawnAdjust =
      now + ddaSettings.timing.spawnLagMs - ddaSettings.timing.cycleMs;
    scheduleNextSpawn();
    rafId = requestAnimationFrame(animate);
  }

  function destroy() {
    gameActive = false;
    clearVirtualKeys();
    if (spawnTimeoutId) clearTimeout(spawnTimeoutId);
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onResize);
  }

  function mount() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  return {
    mount,
    start,
    destroy,
    setVirtualKey,
    clearVirtualKeys,
    firePlayerBullet,
  };
}
