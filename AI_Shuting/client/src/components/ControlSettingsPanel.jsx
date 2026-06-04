import {
  createDefaultGameSettings,
  normalizeGameSettings,
} from '../game/gameSettings';
import './ControlSettingsPanel.css';

export default function ControlSettingsPanel({ settings, onChange }) {
  const toggleTouch = () => {
    onChange(
      normalizeGameSettings({
        ...settings,
        touchControlsEnabled: !settings.touchControlsEnabled,
      })
    );
  };

  const resetControls = () => {
    onChange(createDefaultGameSettings());
  };

  return (
    <div className="control-settings glass">
      <div className="control-settings-header">
        <span className="control-settings-title">操作</span>
      </div>
      <label className="control-enable-row">
        <input
          type="checkbox"
          checked={settings.touchControlsEnabled}
          onChange={toggleTouch}
        />
        <span>タッチ操作ボタンを表示（スマホ・タブレット向け）</span>
      </label>
      <p className="control-settings-note">
        左下に方向パッド、右下に発射ボタンが表示されます。キーボード操作と併用できます。
      </p>
      <button
        type="button"
        className="control-settings-reset"
        onClick={resetControls}
      >
        操作設定をデフォルトに戻す
      </button>
    </div>
  );
}
