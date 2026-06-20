/**
 * DDA（2軸・別タイミングで更新）
 * - 被弾数 → 弾数・弾速・射撃間隔
 * - 撃墜率 → 出現間隔
 */
import { FIXED, stepBulletCount } from './difficultyParams';
import {
  createDefaultDdaSettings,
  normalizeDdaSettings,
} from './ddaSettings';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export class AIDirector {
  constructor(settings) {
    this.config = normalizeDdaSettings(settings ?? createDefaultDdaSettings());
    this.state = { ...this.config.initial };
    this.lastBulletMessage = '';
    this.lastSpawnMessage = '';
    this.lastBulletCountAdjustTime = 0;
  }

  applySettings(settings) {
    this.config = normalizeDdaSettings(settings);
  }

  reset() {
    this.state = { ...this.config.initial };
    this.lastBulletMessage = '';
    this.lastSpawnMessage = '';
    this.lastBulletCountAdjustTime = 0;
  }

  getTargetHitsPerPeriod() {
    const hitsToDie = FIXED.playerHp / FIXED.bulletHitDamage;
    const periods =
      this.config.targets.targetSurvivalMs / this.config.timing.cycleMs;
    return hitsToDie / periods;
  }

  getState() {
    const r = this.config.ranges;
    const s = { ...this.state };
    s.spawnIntervalMs = clamp(
      s.spawnIntervalMs,
      r.spawnIntervalMs.min,
      r.spawnIntervalMs.max
    );
    s.enemyFireIntervalMs = clamp(
      s.enemyFireIntervalMs,
      r.enemyFireIntervalMs.min,
      r.enemyFireIntervalMs.max
    );
    s.enemyBulletSpeed = clamp(
      s.enemyBulletSpeed,
      r.enemyBulletSpeed.min,
      r.enemyBulletSpeed.max
    );
    return s;
  }

  /** @param {{ hits: number }} period @param {number} now */
  adjustBullets(period, now = performance.now()) {
    const prev = { ...this.state };
    const targetHits = this.getTargetHitsPerPeriod();
    const hitsRatio = period.hits / Math.max(targetHits, 0.05);
    const { thresholds, ranges, timing } = this.config;

    let { enemyBulletCount, enemyFireIntervalMs, enemyBulletSpeed } =
      this.state;
    const canChangeCount =
      now - this.lastBulletCountAdjustTime >= timing.bulletCountMinIntervalMs;

    if (period.hits > 0 && hitsRatio > thresholds.hitsRatioEase) {
      if (canChangeCount) {
        const next = stepBulletCount(
          enemyBulletCount,
          -1,
          ranges.enemyBulletCount
        );
        if (next !== enemyBulletCount) {
          enemyBulletCount = next;
          this.lastBulletCountAdjustTime = now;
        }
      }
      enemyFireIntervalMs = clamp(
        enemyFireIntervalMs + ranges.enemyFireIntervalMs.step,
        ranges.enemyFireIntervalMs.min,
        ranges.enemyFireIntervalMs.max
      );
      enemyBulletSpeed = clamp(
        enemyBulletSpeed - ranges.enemyBulletSpeed.step,
        ranges.enemyBulletSpeed.min,
        ranges.enemyBulletSpeed.max
      );
      this.lastBulletMessage = canChangeCount
        ? 'HIGH DAMAGE — EASING BULLETS'
        : 'HIGH DAMAGE — EASING FIRE RATE';
    } else if (hitsRatio < thresholds.hitsRatioHarder) {
      if (canChangeCount) {
        const next = stepBulletCount(
          enemyBulletCount,
          1,
          ranges.enemyBulletCount
        );
        if (next !== enemyBulletCount) {
          enemyBulletCount = next;
          this.lastBulletCountAdjustTime = now;
        }
      }
      enemyFireIntervalMs = clamp(
        enemyFireIntervalMs - ranges.enemyFireIntervalMs.step,
        ranges.enemyFireIntervalMs.min,
        ranges.enemyFireIntervalMs.max
      );
      enemyBulletSpeed = clamp(
        enemyBulletSpeed + ranges.enemyBulletSpeed.step,
        ranges.enemyBulletSpeed.min,
        ranges.enemyBulletSpeed.max
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
    const target = this.config.targets.killRate;
    const margin = this.config.thresholds.killRateMargin;
    const r = this.config.ranges.spawnIntervalMs;

    if (period.spawned > 0) {
      killRate = period.killed / period.spawned;
      if (killRate > target + margin) {
        spawnIntervalMs = clamp(
          spawnIntervalMs - r.step,
          r.min,
          r.max
        );
        this.lastSpawnMessage = 'HIGH KILL RATE — MORE ENEMIES';
      } else if (killRate < target - margin) {
        spawnIntervalMs = clamp(
          spawnIntervalMs + r.step,
          r.min,
          r.max
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
        targetKillRatePct: round2(target * 100),
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
      targetKillRatePct: round2(this.config.targets.killRate * 100),
    };
  }
}
