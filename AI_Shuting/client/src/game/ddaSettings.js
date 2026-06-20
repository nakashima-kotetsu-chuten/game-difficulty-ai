/**
 * DDA 設定（スタート画面で編集 → ゲーム開始時に適用）
 */
import {
  DDA_RANGES,
  DDA_TARGETS,
  DDA_TIMING,
  FIXED,
  clampEvenBulletCount,
  createInitialDifficultyState,
} from './difficultyParams';

export function createDefaultDdaSettings() {
  return {
    enabled: true,
    targets: {
      killRate: DDA_TARGETS.killRate,
      targetSurvivalMs: FIXED.targetSurvivalMs,
    },
    thresholds: {
      hitsRatioEase: 1.1,
      hitsRatioHarder: 0.75,
      killRateMargin: 0.08,
    },
    timing: {
      cycleMs: DDA_TIMING.cycleMs,
      spawnLagMs: DDA_TIMING.spawnLagMs,
      bulletCountMinIntervalMs: DDA_TIMING.bulletCountMinIntervalMs,
    },
    ranges: structuredClone(DDA_RANGES),
    initial: createInitialDifficultyState(),
  };
}

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeRangeTriple(src, defaults, bounds) {
  const min = clampNum(src?.min, bounds.minMin, bounds.minMax, defaults.min);
  const max = clampNum(src?.max, bounds.maxMin, bounds.maxMax, defaults.max);
  const step = clampNum(src?.step, bounds.stepMin, bounds.stepMax, defaults.step);
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
    step: Math.max(bounds.stepMin, step),
  };
}

/** @param {Partial<DdaSettings>} partial */
export function normalizeDdaSettings(partial) {
  const defaults = createDefaultDdaSettings();
  const src = partial ?? {};

  const bulletCount = normalizeRangeTriple(
    src.ranges?.enemyBulletCount,
    defaults.ranges.enemyBulletCount,
    { minMin: 2, minMax: 6, maxMin: 2, maxMax: 8, stepMin: 2, stepMax: 2 }
  );
  bulletCount.min = Math.round(bulletCount.min / 2) * 2;
  bulletCount.max = Math.round(bulletCount.max / 2) * 2;
  if (bulletCount.max < bulletCount.min) bulletCount.max = bulletCount.min;

  const normalized = {
    enabled: src.enabled !== false,
    targets: {
      killRate: clampNum(src.targets?.killRate, 0.05, 0.95, defaults.targets.killRate),
      targetSurvivalMs: clampNum(
        src.targets?.targetSurvivalMs,
        60_000,
        10 * 60_000,
        defaults.targets.targetSurvivalMs
      ),
    },
    thresholds: {
      hitsRatioEase: clampNum(
        src.thresholds?.hitsRatioEase,
        1.01,
        3,
        defaults.thresholds.hitsRatioEase
      ),
      hitsRatioHarder: clampNum(
        src.thresholds?.hitsRatioHarder,
        0.1,
        0.99,
        defaults.thresholds.hitsRatioHarder
      ),
      killRateMargin: clampNum(
        src.thresholds?.killRateMargin,
        0.01,
        0.4,
        defaults.thresholds.killRateMargin
      ),
    },
    timing: {
      cycleMs: clampNum(src.timing?.cycleMs, 3000, 60_000, defaults.timing.cycleMs),
      spawnLagMs: clampNum(src.timing?.spawnLagMs, 0, 30_000, defaults.timing.spawnLagMs),
      bulletCountMinIntervalMs: clampNum(
        src.timing?.bulletCountMinIntervalMs,
        3000,
        60_000,
        defaults.timing.bulletCountMinIntervalMs
      ),
    },
    ranges: {
      enemyBulletCount: bulletCount,
      enemyBulletSpeed: normalizeRangeTriple(
        src.ranges?.enemyBulletSpeed,
        defaults.ranges.enemyBulletSpeed,
        { minMin: 1, minMax: 10, maxMin: 2, maxMax: 12, stepMin: 0.05, stepMax: 2 }
      ),
      enemyFireIntervalMs: normalizeRangeTriple(
        src.ranges?.enemyFireIntervalMs,
        defaults.ranges.enemyFireIntervalMs,
        { minMin: 300, minMax: 5000, maxMin: 500, maxMax: 8000, stepMin: 50, stepMax: 500 }
      ),
      spawnIntervalMs: normalizeRangeTriple(
        src.ranges?.spawnIntervalMs,
        defaults.ranges.spawnIntervalMs,
        { minMin: 200, minMax: 3000, maxMin: 400, maxMax: 5000, stepMin: 50, stepMax: 500 }
      ),
    },
  };

  const r = normalized.ranges;
  normalized.initial = {
    spawnIntervalMs: clampNum(
      src.initial?.spawnIntervalMs,
      r.spawnIntervalMs.min,
      r.spawnIntervalMs.max,
      defaults.initial.spawnIntervalMs
    ),
    enemyBulletSpeed: clampNum(
      src.initial?.enemyBulletSpeed,
      r.enemyBulletSpeed.min,
      r.enemyBulletSpeed.max,
      defaults.initial.enemyBulletSpeed
    ),
    enemyBulletCount: clampEvenBulletCount(
      clampNum(
        src.initial?.enemyBulletCount,
        r.enemyBulletCount.min,
        r.enemyBulletCount.max,
        defaults.initial.enemyBulletCount
      ),
      r.enemyBulletCount
    ),
    enemyFireIntervalMs: clampNum(
      src.initial?.enemyFireIntervalMs,
      r.enemyFireIntervalMs.min,
      r.enemyFireIntervalMs.max,
      defaults.initial.enemyFireIntervalMs
    ),
  };

  return normalized;
}

/** ゲーム開始時の難易度（DDA の ON/OFF に関係なく常に適用） */
export const DDA_INITIAL_FIELDS = [
  {
    key: 'initial.enemyBulletCount',
    label: '弾数',
    hint: '敵1体あたりの同時発射数（偶数）。DDA ON 時はプレイ中に自動変更',
    unit: '発',
    rangeKey: 'enemyBulletCount',
    get: (s) => s.initial.enemyBulletCount,
    set: (v, s) => ({ ...s, initial: { ...s.initial, enemyBulletCount: v } }),
  },
  {
    key: 'initial.enemyBulletSpeed',
    label: '弾速',
    hint: '敵弾の移動速度。DDA ON 時はプレイ中に自動変更',
    unit: 'px/f',
    rangeKey: 'enemyBulletSpeed',
    decimals: 1,
    get: (s) => s.initial.enemyBulletSpeed,
    set: (v, s) => ({ ...s, initial: { ...s.initial, enemyBulletSpeed: v } }),
  },
  {
    key: 'initial.enemyFireIntervalMs',
    label: '射撃間隔',
    hint: '敵の連射間隔。短いほど難しい',
    unit: 'ms',
    rangeKey: 'enemyFireIntervalMs',
    get: (s) => s.initial.enemyFireIntervalMs,
    set: (v, s) => ({
      ...s,
      initial: { ...s.initial, enemyFireIntervalMs: v },
    }),
  },
  {
    key: 'initial.spawnIntervalMs',
    label: '出現間隔',
    hint: '敵のスポーン間隔。短いほど多く出現',
    unit: 'ms',
    rangeKey: 'spawnIntervalMs',
    get: (s) => s.initial.spawnIntervalMs,
    set: (v, s) => ({ ...s, initial: { ...s.initial, spawnIntervalMs: v } }),
  },
];

export function formatInitialSummary(settings) {
  const i = settings.initial;
  return `${i.enemyBulletCount}発 / ${i.enemyBulletSpeed}px / 射撃${i.enemyFireIntervalMs}ms / 出現${i.spawnIntervalMs}ms`;
}

/** UI 用フィールド定義 */
export const DDA_SETTINGS_FIELDS = [
  {
    section: '目標',
    fields: [
      {
        key: 'targets.killRate',
        label: '目標撃墜率',
        hint: 'この値より高いと敵を増やす',
        type: 'percent',
        min: 5,
        max: 95,
        step: 1,
        toDisplay: (s) => Math.round(s.targets.killRate * 100),
        fromDisplay: (v, s) => ({
          ...s,
          targets: { ...s.targets, killRate: v / 100 },
        }),
      },
      {
        key: 'targets.targetSurvivalMs',
        label: '目標生存時間',
        hint: '被弾ペース算出の基準（分）',
        type: 'minutes',
        min: 1,
        max: 10,
        step: 0.5,
        toDisplay: (s) => s.targets.targetSurvivalMs / 60_000,
        fromDisplay: (v, s) => ({
          ...s,
          targets: { ...s.targets, targetSurvivalMs: v * 60_000 },
        }),
      },
    ],
  },
  {
    section: '判定しきい値',
    fields: [
      {
        key: 'thresholds.hitsRatioEase',
        label: '被弾比（易化）',
        hint: '目標比がこれを超えると弾幕を易化',
        type: 'number',
        min: 1.01,
        max: 3,
        step: 0.05,
        decimals: 2,
        get: (s) => s.thresholds.hitsRatioEase,
        set: (v, s) => ({
          ...s,
          thresholds: { ...s.thresholds, hitsRatioEase: v },
        }),
      },
      {
        key: 'thresholds.hitsRatioHarder',
        label: '被弾比（難化）',
        hint: '目標比がこれ未満だと弾幕を難化',
        type: 'number',
        min: 0.1,
        max: 0.99,
        step: 0.05,
        decimals: 2,
        get: (s) => s.thresholds.hitsRatioHarder,
        set: (v, s) => ({
          ...s,
          thresholds: { ...s.thresholds, hitsRatioHarder: v },
        }),
      },
      {
        key: 'thresholds.killRateMargin',
        label: '撃墜率の許容幅',
        hint: '目標±この幅の内側は出現間隔を維持',
        type: 'percent',
        min: 1,
        max: 40,
        step: 1,
        toDisplay: (s) => Math.round(s.thresholds.killRateMargin * 100),
        fromDisplay: (v, s) => ({
          ...s,
          thresholds: { ...s.thresholds, killRateMargin: v / 100 },
        }),
      },
    ],
  },
  {
    section: '更新タイミング',
    fields: [
      {
        key: 'timing.cycleMs',
        label: '調整周期',
        hint: '弾幕・出現の集計ウィンドウ（秒）',
        type: 'seconds',
        min: 5,
        max: 60,
        step: 1,
        toDisplay: (s) => s.timing.cycleMs / 1000,
        fromDisplay: (v, s) => ({
          ...s,
          timing: { ...s.timing, cycleMs: v * 1000 },
        }),
      },
      {
        key: 'timing.spawnLagMs',
        label: '出現調整の遅れ',
        hint: '弾幕より遅らせる秒数',
        type: 'seconds',
        min: 0,
        max: 30,
        step: 1,
        toDisplay: (s) => s.timing.spawnLagMs / 1000,
        fromDisplay: (v, s) => ({
          ...s,
          timing: { ...s.timing, spawnLagMs: v * 1000 },
        }),
      },
      {
        key: 'timing.bulletCountMinIntervalMs',
        label: '弾数変更の最短間隔',
        hint: '弾数を変えられる最小間隔（秒）',
        type: 'seconds',
        min: 5,
        max: 60,
        step: 1,
        toDisplay: (s) => s.timing.bulletCountMinIntervalMs / 1000,
        fromDisplay: (v, s) => ({
          ...s,
          timing: { ...s.timing, bulletCountMinIntervalMs: v * 1000 },
        }),
      },
    ],
  },
];

export const DDA_RANGE_FIELDS = [
  { rangeKey: 'enemyBulletCount', label: '弾数', unit: '発', countEven: true },
  { rangeKey: 'enemyBulletSpeed', label: '弾速', unit: 'px/f', decimals: 2 },
  { rangeKey: 'enemyFireIntervalMs', label: '射撃間隔', unit: 'ms', decimals: 0 },
  { rangeKey: 'spawnIntervalMs', label: 'スポーン間隔', unit: 'ms', decimals: 0 },
];
