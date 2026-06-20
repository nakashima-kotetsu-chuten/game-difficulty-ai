/**
 * ゲーム全体の設定（スタート画面）
 */

export function createDefaultGameSettings() {
  const coarsePointer =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches;

  return {
    /** スマホ・タブレット向けの半透明タッチボタン */
    touchControlsEnabled: coarsePointer,
  };
}

export function normalizeGameSettings(partial) {
  const defaults = createDefaultGameSettings();
  return {
    touchControlsEnabled:
      partial?.touchControlsEnabled ?? defaults.touchControlsEnabled,
  };
}
