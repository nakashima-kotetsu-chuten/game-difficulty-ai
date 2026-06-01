/**
 * DDA（2軸・別タイミングで更新）
 * - 被弾数 → 弾数2〜4（±2・10秒に1回まで）・弾速・射撃間隔（10秒ごと）
 * - 撃墜率 → 出現間隔（10秒ごと、5秒ラグ）
 */
import {
  DDA_RANGES,
  DDA_TARGETS,
  DDA_TIMING,
  FIXED,
  stepBulletCount,
  createInitialDifficultyState,
  getTargetHitsPerPeriod,
} from './difficultyParams';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export class AIDirector {
  constructor() {
    this.state = createInitialDifficultyState();
    this.lastBulletMessage = '';
    this.lastSpawnMessage = '';
    this.lastBulletCountAdjustTime = 0;
  }

  reset() {
    this.state = createInitialDifficultyState();
    this.lastBulletMessage = '';
    this.lastSpawnMessage = '';
    this.lastBulletCountAdjustTime = 0;
  }

  getState() {
    const s = { ...this.state };
    s.spawnIntervalMs = clamp(
      s.spawnIntervalMs,
      DDA_RANGES.spawnIntervalMs.min,
      DDA_RANGES.spawnIntervalMs.max
    );
    s.enemyFireIntervalMs = clamp(
      s.enemyFireIntervalMs,
      DDA_RANGES.enemyFireIntervalMs.min,
      DDA_RANGES.enemyFireIntervalMs.max
    );
    s.enemyBulletSpeed = clamp(
      s.enemyBulletSpeed,
      DDA_RANGES.enemyBulletSpeed.min,
      DDA_RANGES.enemyBulletSpeed.max
    );
    return s;
  }

  /** @param {{ hits: number }} period @param {number} now */
  adjustBullets(period, now = performance.now()) {
    const prev = { ...this.state };
    const targetHits = getTargetHitsPerPeriod();
    const hitsRatio = period.hits / Math.max(targetHits, 0.05);

    let { enemyBulletCount, enemyFireIntervalMs, enemyBulletSpeed } =
      this.state;
    const canChangeCount =
      now - this.lastBulletCountAdjustTime >=
      DDA_TIMING.bulletCountMinIntervalMs;

    if (period.hits > 0 && hitsRatio > 1.1) {
      if (canChangeCount) {
        const next = stepBulletCount(enemyBulletCount, -1);
        if (next !== enemyBulletCount) {
          enemyBulletCount = next;
          this.lastBulletCountAdjustTime = now;
        }
      }
      enemyFireIntervalMs = clamp(
        enemyFireIntervalMs + DDA_RANGES.enemyFireIntervalMs.step,
        DDA_RANGES.enemyFireIntervalMs.min,
        DDA_RANGES.enemyFireIntervalMs.max
      );
      enemyBulletSpeed = clamp(
        enemyBulletSpeed - DDA_RANGES.enemyBulletSpeed.step,
        DDA_RANGES.enemyBulletSpeed.min,
        DDA_RANGES.enemyBulletSpeed.max
      );
      this.lastBulletMessage = canChangeCount
        ? 'HIGH DAMAGE — EASING BULLETS'
        : 'HIGH DAMAGE — EASING FIRE RATE';
    } else if (hitsRatio < 0.75) {
      if (canChangeCount) {
        const next = stepBulletCount(enemyBulletCount, 1);
        if (next !== enemyBulletCount) {
          enemyBulletCount = next;
          this.lastBulletCountAdjustTime = now;
        }
      }
      enemyFireIntervalMs = clamp(
        enemyFireIntervalMs - DDA_RANGES.enemyFireIntervalMs.step,
        DDA_RANGES.enemyFireIntervalMs.min,
        DDA_RANGES.enemyFireIntervalMs.max
      );
      enemyBulletSpeed = clamp(
        enemyBulletSpeed + DDA_RANGES.enemyBulletSpeed.step,
        DDA_RANGES.enemyBulletSpeed.min,
        DDA_RANGES.enemyBulletSpeed.max
      );
      this.lastBulletMessage = canChangeCount
        ? 'LOW THREAT — TIGHTENING BULLETS'
        : 'LOW THREAT — TIGHTENING FIRE RATE';
    } else {
      this.lastBulletMessage = 'BULLETS — HOLD STEADY';
    }

    this.state = {
      ...this.state,
      enemyBulletCount,
      enemyFireIntervalMs: Math.round(enemyFireIntervalMs),
      enemyBulletSpeed: round2(enemyBulletSpeed),
    };

    const countDelta = this.state.enemyBulletCount - prev.enemyBulletCount;
    const intervalDelta = this.state.enemyFireIntervalMs - prev.enemyFireIntervalMs;
    const speedDelta = round2(
      this.state.enemyBulletSpeed - prev.enemyBulletSpeed
    );

    return {
      axis: 'bullets',
      message: this.getCombinedMessage(),
      metrics: {
        periodHits: period.hits,
        targetHitsPerPeriod: round2(targetHits),
        hitsRatio: round2(hitsRatio),
        bulletCountDelta: countDelta,
        fireIntervalDelta: intervalDelta,
        bulletSpeedDelta: speedDelta,
        trend:
          countDelta > 0 || speedDelta > 0 || intervalDelta < 0
            ? 'up'
            : countDelta < 0 || speedDelta < 0 || intervalDelta > 0
              ? 'down'
              : 'hold',
        delta: countDelta !== 0 ? countDelta : speedDelta || intervalDelta,
      },
    };
  }

  /** @param {{ spawned: number, killed: number }} period */
  adjustSpawn(period) {
    const prev = { ...this.state };
    let { spawnIntervalMs } = this.state;
    let killRate = null;

    if (period.spawned > 0) {
      killRate = period.killed / period.spawned;
      if (killRate > DDA_TARGETS.killRate + 0.08) {
        spawnIntervalMs = clamp(
          spawnIntervalMs - DDA_RANGES.spawnIntervalMs.step,
          DDA_RANGES.spawnIntervalMs.min,
          DDA_RANGES.spawnIntervalMs.max
        );
        this.lastSpawnMessage = 'HIGH KILL RATE — MORE ENEMIES';
      } else if (killRate < DDA_TARGETS.killRate - 0.08) {
        spawnIntervalMs = clamp(
          spawnIntervalMs + DDA_RANGES.spawnIntervalMs.step,
          DDA_RANGES.spawnIntervalMs.min,
          DDA_RANGES.spawnIntervalMs.max
        );
        this.lastSpawnMessage = 'LOW KILL RATE — FEWER ENEMIES';
      } else {
        this.lastSpawnMessage = 'SPAWN — HOLD STEADY';
      }
    } else {
      this.lastSpawnMessage = 'SPAWN — NO DATA';
    }

    this.state = {
      ...this.state,
      spawnIntervalMs: Math.round(spawnIntervalMs),
    };

    const spawnDelta = this.state.spawnIntervalMs - prev.spawnIntervalMs;

    return {
      axis: 'spawn',
      message: this.getCombinedMessage(),
      metrics: {
        periodSpawned: period.spawned,
        periodKilled: period.killed,
        killRate: killRate !== null ? round2(killRate * 100) : null,
        targetKillRatePct: DDA_TARGETS.killRate * 100,
        trend:
          spawnDelta < 0 ? 'up' : spawnDelta > 0 ? 'down' : 'hold',
        delta: spawnDelta,
      },
    };
  }

  getCombinedMessage() {
    if (this.lastBulletMessage && this.lastSpawnMessage) {
      return `${this.lastBulletMessage} | ${this.lastSpawnMessage}`;
    }
    return this.lastBulletMessage || this.lastSpawnMessage || 'BALANCING';
  }

  getDisplayMetrics() {
    return {
      enemySpeedMin: round2(1.5 * FIXED.enemyMoveSpeedMult),
      enemySpeedMax: round2(3.5 * FIXED.enemyMoveSpeedMult),
      targetKillRatePct: DDA_TARGETS.killRate * 100,
    };
  }
}
