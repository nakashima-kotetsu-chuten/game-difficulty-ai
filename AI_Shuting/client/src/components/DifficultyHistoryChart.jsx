import { useEffect, useRef } from 'react';
import { DDA_RANGES } from '../game/difficultyParams';

const SERIES = [
  {
    key: 'enemyBulletCount',
    label: '弾数',
    color: '#ff00ff',
    min: DDA_RANGES.enemyBulletCount.min,
    max: DDA_RANGES.enemyBulletCount.max,
    invert: false,
  },
  {
    key: 'enemyBulletSpeed',
    label: '弾速',
    color: '#ff2244',
    min: DDA_RANGES.enemyBulletSpeed.min,
    max: DDA_RANGES.enemyBulletSpeed.max,
    invert: false,
  },
  {
    key: 'enemyFireIntervalMs',
    label: '射撃間隔',
    color: '#ff9944',
    min: DDA_RANGES.enemyFireIntervalMs.min,
    max: DDA_RANGES.enemyFireIntervalMs.max,
    invert: true,
  },
  {
    key: 'spawnIntervalMs',
    label: 'スポーン間隔',
    color: '#39ff14',
    min: DDA_RANGES.spawnIntervalMs.min,
    max: DDA_RANGES.spawnIntervalMs.max,
    invert: true,
  },
];

function norm(value, min, max, invert) {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, t));
  return invert ? 1 - clamped : clamped;
}

function drawChart(canvas, history) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = { left: 44, right: 16, top: 12, bottom: 28 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w, h);

  if (history.length < 1) return;

  const maxT = Math.max(history[history.length - 1].tSec, 1);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
  }

  const toX = (tSec) => pad.left + (tSec / maxT) * plotW;
  const toY = (n) => pad.top + plotH - n * plotH;

  for (const series of SERIES) {
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((point, i) => {
      const n = norm(point[series.key], series.min, series.max, series.invert);
      const x = toX(point.tSec);
      const y = toY(n);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const last = history[history.length - 1];
    const n = norm(last[series.key], series.min, series.max, series.invert);
    ctx.fillStyle = series.color;
    ctx.beginPath();
    ctx.arc(toX(last.tSec), toY(n), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('0s', pad.left, h - 8);
  ctx.fillText(`${maxT.toFixed(0)}s`, pad.left + plotW, h - 8);

  ctx.textAlign = 'right';
  ctx.fillText('易', pad.left - 6, pad.top + 4);
  ctx.fillText('難', pad.left - 6, pad.top + plotH + 4);
}

export default function DifficultyHistoryChart({ history }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history?.length) return;
    drawChart(canvas, history);
  }, [history]);

  if (!history?.length) return null;

  const last = history[history.length - 1];

  return (
    <div className="dda-history-chart">
      <h3 className="dda-chart-title">難易度の推移</h3>
      <canvas
        ref={canvasRef}
        className="dda-chart-canvas"
        width={560}
        height={200}
        aria-label="難易度パラメータの時系列グラフ"
      />
      <ul className="dda-chart-legend">
        {SERIES.map((s) => (
          <li key={s.key}>
            <span className="dda-legend-dot" style={{ background: s.color }} />
            {s.label}: {last[s.key]}
            {s.key.includes('Interval') ? 'ms' : s.key.includes('Speed') ? ' px/f' : ' 発'}
          </li>
        ))}
      </ul>
      <p className="dda-chart-hint">
        縦軸は各パラメータを正規化（上ほど難しめ）。間隔系は短いほど上。
      </p>
    </div>
  );
}
