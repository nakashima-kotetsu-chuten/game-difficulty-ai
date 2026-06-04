import { DDA_RANGES } from '../game/difficultyParams';

function Meter({ label, value, max, unit, hint, color = 'var(--neon-blue)' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="dda-meter">
      <div className="dda-meter-header">
        <span className="dda-meter-label">{label}</span>
        <span className="dda-meter-value">
          {value}
          {unit}
        </span>
      </div>
      <div className="dda-meter-track">
        <div
          className="dda-meter-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {hint && <span className="dda-meter-hint">{hint}</span>}
    </div>
  );
}

function TrendBadge({ trend, delta }) {
  const labels = { up: '↑ 難化', down: '↓ 易化', hold: '→ 維持' };
  return (
    <span className={`dda-trend dda-trend-${trend}`}>
      {labels[trend]}
      {delta !== 0 && ` (${delta > 0 ? '+' : ''}${delta})`}
    </span>
  );
}

export default function DifficultyPanel({ dda, visible }) {
  if (!visible) return null;

  const killDisplay =
    dda.killRate != null ? `${dda.killRate}%` : '—';

  const ddaOn = dda.ddaEnabled !== false;

  return (
    <aside className="dda-panel glass" aria-label="難易度パラメータ">
      <div className="dda-panel-header">
        <span className="label">
          {ddaOn ? 'DDA（10秒窓）' : 'DDA（無効）'}
        </span>
        {ddaOn && <TrendBadge trend={dda.trend} delta={dda.delta} />}
      </div>

      <p className="dda-message">{dda.message}</p>
      {!ddaOn && (
        <p className="dda-disabled-note">
          スタート画面の設定どおり、難易度は固定です。
        </p>
      )}

      <div className="dda-section-title">直近テレメトリ</div>
      <div className="dda-row">
        <span className="dda-stat">
          <span className="label">被弾数</span>
          <span className="value">{dda.periodHits ?? 0}</span>
        </span>
        <span className="dda-stat">
          <span className="label">目標/期</span>
          <span className="value">{dda.targetHitsPerPeriod ?? '—'}</span>
        </span>
      </div>
      <div className="dda-row">
        <span className="dda-stat">
          <span className="label">撃墜率</span>
          <span className="value">{killDisplay}</span>
        </span>
        <span className="dda-stat">
          <span className="label">目標撃墜率</span>
          <span className="value">{dda.targetKillRatePct ?? 30}%</span>
        </span>
      </div>

      <div className="dda-section-title">被弾数 → 弾幕（自動）</div>
      <div className="dda-legend">
        <span className="dda-legend-line">
          <span className="dda-legend-swatch dda-legend-bullet" aria-hidden />
          偶数弾のみ（中央弾なし）
        </span>
      </div>
      <Meter
        label="弾数"
        value={dda.enemyBulletCount ?? 2}
        max={DDA_RANGES.enemyBulletCount.max}
        unit=" 発"
        hint={`${DDA_RANGES.enemyBulletCount.min}〜${DDA_RANGES.enemyBulletCount.max}（±2）| 強さは弾速・射撃間隔 | 弾数は10秒に1回`}
        color="var(--neon-red)"
      />
      <Meter
        label="弾速（DDA）"
        value={dda.enemyBulletSpeed ?? 4}
        max={7}
        unit=" px/f"
        hint="弾数が上限でも弾速で難化"
        color="var(--neon-red)"
      />
      <div className="dda-row">
        <span className="dda-stat">
          <span className="label">射撃間隔</span>
          <span className="value">{dda.enemyFireIntervalMs ?? '—'} ms</span>
        </span>
        <span className="dda-stat">
          <span className="label">被弾比</span>
          <span className="value">{dda.hitsRatio ?? '—'}</span>
        </span>
      </div>

      <div className="dda-section-title">撃墜率 → 出現（自動）</div>
      <Meter
        label="敵スポーン間隔"
        value={dda.spawnIntervalMs ?? 0}
        max={2800}
        unit="ms"
        hint="10秒ごと（弾幕より5秒遅れ）| 目標撃墜30%"
        color="var(--neon-green)"
      />

      <div className="dda-row">
        <span className="dda-stat">
          <span className="label">敵速度</span>
          <span className="value">
            {dda.enemySpeedMin}〜{dda.enemySpeedMax} px/f（固定）
          </span>
        </span>
      </div>
    </aside>
  );
}
