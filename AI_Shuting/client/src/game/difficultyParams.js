/**
 * 難易度パラメータ（DDA 調整対象と固定値）
 */

export const ENEMY_BULLET_COLOR = '#ff2244';

/** DDA の更新周期（弾幕・出現ともに 10 秒ごと、出現は 5 秒遅れ） */
export const DDA_TIMING = {
  cycleMs: 10000,
  spawnLagMs: 5000,
  /** 弾数の変更はこの間隔より短くしない（ms） */
  bulletCountMinIntervalMs: 10000,
};

/** ゲーム内で固定する値（DDA では変更しない） */
export const FIXED = {
  playerHp: 100,
  bulletHitDamage: 8,
  /** 撃墜何体で弾1発分（bulletHitDamage）の HP を回復するか */
  killsPerBulletHeal: 8,
  bodyHitDamage: 10,
  enemyMoveSpeedMult: 1.0,
  /** 被弾後の無敵時間（ms） */
  invincibilityMs: 200,
  /** プレイヤー弾の当たり判定（表示より広め） */
  playerBulletHitHalfWidth: 10,
  playerBulletHitHeight: 18,
  targetSurvivalMs: 3 * 60 * 1000,
  /** 敵弾の初期速度（DDA 開始値） */
  defaultEnemyBulletSpeed: 4,
};

export const DDA_TARGETS = {
  killRate: 0.3,
};

export const DDA_RANGES = {
  /** 弾数は 2〜4 のみ。それ以上の強さは弾速・射撃頻度で調整 */
  enemyBulletCount: { min: 2, max: 4, step: 2 },
  enemyBulletSpeed: { min: 3, max: 7, step: 0.35 },
  enemyFireIntervalMs: { min: 700, max: 3000, step: 180 },
  spawnIntervalMs: { min: 500, max: 2800, step: 120 },
};

/** 最大弾数時の扇形（下向き ±45°） */
export const ENEMY_SHOT_ARC = {
  minAngle: Math.PI / 4,
  maxAngle: (3 * Math.PI) / 4,
  centerAngle: Math.PI / 2,
};

const BULLET_COUNT_MIN = DDA_RANGES.enemyBulletCount.min;
const BULLET_COUNT_MAX = DDA_RANGES.enemyBulletCount.max;

/**
 * 弾数に応じた発射角度（少ないほど下向きに集中＝2発で真横になりすぎない）
 */
export function getBurstAngles(count) {
  const center = ENEMY_SHOT_ARC.centerAngle;
  const fullHalfSpan = (ENEMY_SHOT_ARC.maxAngle - ENEMY_SHOT_ARC.minAngle) / 2;
  const t = (count - BULLET_COUNT_MIN) / (BULLET_COUNT_MAX - BULLET_COUNT_MIN);
  const halfSpan = fullHalfSpan * (0.22 + t * 0.78);

  const angles = [];
  for (let i = 0; i < count; i++) {
    const frac = i / (count - 1);
    angles.push(center - halfSpan + frac * 2 * halfSpan);
  }
  return angles;
}

/** 各弾の角度に足す乱数（ラジアン、±この値） */
export const BULLET_ANGLE_JITTER_RAD = 0.1;

/** 出現位置を横方向に分散（レーン数・端余白） */
export const ENEMY_SPAWN = {
  laneCount: 7,
  marginRatio: 0.06,
  /** レーン内でのランダム幅（0〜1） */
  laneJitter: 0.85,
};

/** 5 秒ウィンドウあたりの目標被弾数（3 分で HP0） */
export function getHealPerKill() {
  return FIXED.bulletHitDamage / FIXED.killsPerBulletHeal;
}

export function getTargetHitsPerPeriod() {
  const hitsToDie = FIXED.playerHp / FIXED.bulletHitDamage;
  const periods = FIXED.targetSurvivalMs / DDA_TIMING.cycleMs;
  return hitsToDie / periods;
}

export function clampEvenBulletCount(count, range = DDA_RANGES.enemyBulletCount) {
  const rounded = Math.round(count / 2) * 2;
  return Math.max(range.min, Math.min(range.max, rounded));
}

/** 弾数を ±step だけ変化 */
export function stepBulletCount(current, deltaSteps, range = DDA_RANGES.enemyBulletCount) {
  return clampEvenBulletCount(
    current + deltaSteps * range.step,
    range
  );
}

export function createInitialDifficultyState() {
  return {
    spawnIntervalMs: 1200,
    enemyBulletSpeed: FIXED.defaultEnemyBulletSpeed,
    enemyBulletCount: 4,
    enemyFireIntervalMs: 1600,
  };
}
