import { useCallback, useEffect, useRef, useState } from 'react';
import { createGameEngine } from './game/gameEngine';
import DifficultyPanel from './components/DifficultyPanel';
import DifficultyHistoryChart from './components/DifficultyHistoryChart';
import './App.css';

const INITIAL_HUD = {
  hp: 100,
  score: '000000',
  survivalTime: '00:00',
  hpBarBackground: 'linear-gradient(90deg, #00f2ff, #ff00ff)',
};

const INITIAL_DDA = {
  message: '待機中',
  spawnIntervalMs: 1200,
  enemyBulletSpeed: 4,
  enemyBulletCount: 4,
  enemyFireIntervalMs: 1600,
  enemySpeedMin: 1.5,
  enemySpeedMax: 3.5,
  periodHits: 0,
  targetHitsPerPeriod: 0.69,
  killRate: null,
  targetKillRatePct: 30,
  hitsRatio: 0,
  delta: 0,
  trend: 'hold',
};

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [showStart, setShowStart] = useState(true);
  const [showFinal, setShowFinal] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hud, setHud] = useState(INITIAL_HUD);
  const [dda, setDda] = useState(INITIAL_DDA);
  const [finalStats, setFinalStats] = useState({
    score: 0,
    accuracy: '0%',
    survivalTime: '00:00',
    ddaHistory: [],
  });

  const handleHudUpdate = useCallback((next) => {
    setHud(next);
  }, []);

  const handleDifficultyUpdate = useCallback((next) => {
    setDda(next);
  }, []);

  const handleGameOver = useCallback((stats) => {
    setFinalStats(stats);
    setPlaying(false);
    setShowFinal(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createGameEngine(canvas, {
      onHudUpdate: handleHudUpdate,
      onDifficultyUpdate: handleDifficultyUpdate,
      onGameOver: handleGameOver,
    });
    engine.mount();
    engineRef.current = engine;

    return () => engine.destroy();
  }, [handleHudUpdate, handleDifficultyUpdate, handleGameOver]);

  const startGame = () => {
    document.activeElement?.blur();
    setShowStart(false);
    setShowFinal(false);
    setPlaying(true);
    setHud(INITIAL_HUD);
    setDda(INITIAL_DDA);
    engineRef.current?.start();
    canvasRef.current?.focus();
  };

  const preventSpaceClick = (e) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
    }
  };

  return (
    <div className="game-app">
      <canvas ref={canvasRef} tabIndex={0} />

      <div className="hud glass">
        <div className="hud-item hp-container">
          <span className="label">HP</span>
          <div className="bar-bg">
            <div
              className="bar-fill"
              style={{
                width: `${hud.hp}%`,
                background: hud.hpBarBackground,
              }}
            />
          </div>
        </div>
        <div className="hud-item score-container">
          <span className="label">SCORE</span>
          <span className="value">{hud.score}</span>
        </div>
        <div className="hud-item time-container">
          <span className="label">TIME</span>
          <span className="value">{hud.survivalTime}</span>
        </div>
        <div className="hud-item ai-status">
          <span className="label">AI DIRECTOR</span>
          <span className="value pulse">{dda.message}</span>
        </div>
        <div className="hud-item difficulty-container">
          <span className="label">SPAWN</span>
          <span className="value">{dda.spawnIntervalMs}ms</span>
        </div>
      </div>

      <DifficultyPanel dda={dda} visible={playing} />

      <div className={`overlay ${showStart ? '' : 'hidden'}`}>
        <div className="overlay-content glass">
          <h1 className="neon-text">AI NEON BLASTER</h1>
          <p className="description">
            AIがあなたのプレイを監視し、リアルタイムで難易度を最適化します。
            <br />
            [W/A/S/D] 移動 | [SPACE] 攻撃
          </p>
          <button
            type="button"
            className="premium-btn"
            onClick={startGame}
            onKeyDown={preventSpaceClick}
          >
            SYSTEM INITIALIZE
          </button>
        </div>
      </div>

      <div className={`overlay ${showFinal ? '' : 'hidden'}`}>
        <div className="overlay-content glass overlay-content-wide">
          <h2 className="neon-text">MISSION END</h2>
          <div className="stats-grid stats-grid-3">
            <div className="stat-box">
              <span className="label">TIME</span>
              <span className="value">{finalStats.survivalTime}</span>
            </div>
            <div className="stat-box">
              <span className="label">SCORE</span>
              <span className="value">{finalStats.score}</span>
            </div>
            <div className="stat-box">
              <span className="label">ACCURACY</span>
              <span className="value">{finalStats.accuracy}</span>
            </div>
          </div>
          <DifficultyHistoryChart history={finalStats.ddaHistory} />
          <button
            type="button"
            className="premium-btn"
            onClick={startGame}
            onKeyDown={preventSpaceClick}
          >
            RE-INITIALIZE
          </button>
        </div>
      </div>
    </div>
  );
}
