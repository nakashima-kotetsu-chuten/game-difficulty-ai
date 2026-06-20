import { useCallback, useEffect, useRef } from 'react';
import './TouchControls.css';

const DIRECTIONS = [
  { id: 'up', label: '▲', key: 'w' },
  { id: 'left', label: '◀', key: 'a' },
  { id: 'down', label: '▼', key: 's' },
  { id: 'right', label: '▶', key: 'd' },
];

const FIRE_INTERVAL_MS = 120;

export default function TouchControls({ engineRef }) {
  const fireTimerRef = useRef(null);
  const activeDirsRef = useRef(new Set());

  const setDirection = useCallback(
    (dirId, pressed) => {
      const engine = engineRef.current;
      if (!engine) return;
      const dir = DIRECTIONS.find((d) => d.id === dirId);
      if (!dir) return;
      if (pressed) {
        activeDirsRef.current.add(dirId);
        engine.setVirtualKey(dir.key, true);
      } else {
        activeDirsRef.current.delete(dirId);
        engine.setVirtualKey(dir.key, false);
      }
    },
    [engineRef]
  );

  const stopFire = useCallback(() => {
    if (fireTimerRef.current) {
      clearInterval(fireTimerRef.current);
      fireTimerRef.current = null;
    }
  }, []);

  const startFire = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.firePlayerBullet();
    stopFire();
    fireTimerRef.current = setInterval(() => {
      engineRef.current?.firePlayerBullet();
    }, FIRE_INTERVAL_MS);
  }, [engineRef, stopFire]);

  useEffect(() => () => {
    stopFire();
    const engine = engineRef.current;
    activeDirsRef.current.forEach((dirId) => {
      const dir = DIRECTIONS.find((d) => d.id === dirId);
      if (dir) engine?.setVirtualKey(dir.key, false);
    });
    activeDirsRef.current.clear();
    engine?.clearVirtualKeys();
  }, [engineRef, stopFire]);

  const bindDirection = (dirId) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDirection(dirId, true);
    },
    onPointerUp: (e) => {
      e.preventDefault();
      setDirection(dirId, false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    onPointerCancel: (e) => {
      setDirection(dirId, false);
    },
    onLostPointerCapture: () => {
      setDirection(dirId, false);
    },
  });

  const bindFire = {
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      startFire();
    },
    onPointerUp: (e) => {
      e.preventDefault();
      stopFire();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    onPointerCancel: () => {
      stopFire();
    },
    onLostPointerCapture: () => {
      stopFire();
    },
  };

  return (
    <div className="touch-controls" aria-label="タッチ操作">
      <div className="touch-dpad">
        {DIRECTIONS.map((dir) => (
          <button
            key={dir.id}
            type="button"
            className={`touch-btn touch-btn-dir touch-btn-${dir.id}`}
            aria-label={
              dir.id === 'up'
                ? '上'
                : dir.id === 'down'
                  ? '下'
                  : dir.id === 'left'
                    ? '左'
                    : '右'
            }
            {...bindDirection(dir.id)}
          >
            {dir.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="touch-btn touch-btn-fire"
        aria-label="発射"
        {...bindFire}
      >
        FIRE
      </button>
    </div>
  );
}
