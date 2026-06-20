import { useState } from 'react';
import {
  createDefaultDdaSettings,
  normalizeDdaSettings,
  DDA_SETTINGS_FIELDS,
  DDA_RANGE_FIELDS,
  DDA_INITIAL_FIELDS,
  formatInitialSummary,
} from '../game/ddaSettings';
import './DdaSettingsPanel.css';

function SettingRow({ field, settings, onChange, disabled }) {
  const value =
    field.toDisplay?.(settings) ??
    field.get?.(settings) ??
    0;
  const displayUnit =
    field.type === 'percent'
      ? '%'
      : field.type === 'minutes'
        ? '分'
        : field.type === 'seconds'
          ? '秒'
          : field.unit ?? '';

  const min = field.getMin?.(settings) ?? field.min;
  const max = field.getMax?.(settings) ?? field.max;
  const step = field.getStep?.(settings) ?? field.step;

  const apply = (raw) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    const next = field.fromDisplay
      ? field.fromDisplay(num, settings)
      : field.set(num, settings);
    onChange(normalizeDdaSettings(next));
  };

  return (
    <label className="dda-setting-row">
      <span className="dda-setting-label">
        {field.label}
        {field.hint && (
          <span className="dda-setting-hint" title={field.hint}>
            ?
          </span>
        )}
      </span>
      <span className="dda-setting-control">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => apply(e.target.value)}
        />
        {displayUnit && <span className="dda-setting-unit">{displayUnit}</span>}
      </span>
    </label>
  );
}

function InitialSettingRow({ field, settings, onChange }) {
  const range = settings.ranges[field.rangeKey];
  const value = field.get(settings);
  const step =
    field.decimals != null
      ? 10 ** -field.decimals
      : range.step;

  const apply = (raw) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    onChange(normalizeDdaSettings(field.set(num, settings)));
  };

  return (
    <label className="dda-setting-row">
      <span className="dda-setting-label">
        {field.label}
        {field.hint && (
          <span className="dda-setting-hint" title={field.hint}>
            ?
          </span>
        )}
      </span>
      <span className="dda-setting-control">
        <input
          type="number"
          min={range.min}
          max={range.max}
          step={step}
          value={value}
          onChange={(e) => apply(e.target.value)}
        />
        <span className="dda-setting-unit">{field.unit}</span>
      </span>
    </label>
  );
}

function RangeRow({ meta, settings, onChange, disabled }) {
  const range = settings.ranges[meta.rangeKey];
  const update = (key, raw) => {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    const next = {
      ...settings,
      ranges: {
        ...settings.ranges,
        [meta.rangeKey]: { ...range, [key]: num },
      },
    };
    onChange(normalizeDdaSettings(next));
  };

  return (
    <div className="dda-range-block">
      <div className="dda-range-title">{meta.label}</div>
      <div className="dda-range-grid">
        {(['min', 'max', 'step']).map((key) => (
          <label key={key} className="dda-setting-row dda-setting-row-compact">
            <span className="dda-setting-label">
              {key === 'min' ? '下限' : key === 'max' ? '上限' : 'ステップ'}
            </span>
            <span className="dda-setting-control">
              <input
                type="number"
                value={range[key]}
                disabled={disabled}
                step={meta.decimals ? 10 ** -meta.decimals : 1}
                onChange={(e) => update(key, e.target.value)}
              />
              <span className="dda-setting-unit">{meta.unit}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function DdaSettingsPanel({ settings, onChange }) {
  const [open, setOpen] = useState(false);
  const ddaAutoDisabled = !settings.enabled;

  const handleToggleEnabled = () => {
    onChange(
      normalizeDdaSettings({ ...settings, enabled: !settings.enabled })
    );
  };

  const handleReset = () => {
    onChange(createDefaultDdaSettings());
  };

  const handleResetInitialOnly = () => {
    const defaults = createDefaultDdaSettings();
    onChange(
      normalizeDdaSettings({
        ...settings,
        initial: { ...defaults.initial },
      })
    );
  };

  return (
    <div className="dda-settings-panel">
      <div className="dda-initial-block glass">
        <div className="dda-initial-header">
          <span className="dda-initial-title">ゲーム開始時の難易度</span>
          <span className="dda-initial-badge">常に適用</span>
        </div>
        <p className="dda-settings-note dda-initial-note">
          弾数・弾速・射撃間隔・出現間隔の<strong>開始値</strong>です。
          DDA が ON のときはここから自動調整、OFF のときはこのまま固定されます。
        </p>
        <div className="dda-initial-grid">
          {DDA_INITIAL_FIELDS.map((field) => (
            <InitialSettingRow
              key={field.key}
              field={field}
              settings={settings}
              onChange={onChange}
            />
          ))}
        </div>
        <p className="dda-initial-summary" aria-live="polite">
          現在: {formatInitialSummary(settings)}
        </p>
        <button
          type="button"
          className="dda-settings-reset dda-settings-reset-inline"
          onClick={handleResetInitialOnly}
        >
          開始値だけデフォルトに戻す
        </button>
      </div>

      <button
        type="button"
        className="dda-settings-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? '▲' : '▼'} 難易度の自動調整（DDA）
        <span
          className={`dda-settings-badge ${settings.enabled ? 'on' : 'off'}`}
        >
          {settings.enabled ? 'ON' : 'OFF'}
        </span>
      </button>

      {open && (
        <div className="dda-settings-body glass">
          <label className="dda-enable-row">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={handleToggleEnabled}
            />
            <span>プレイ中に難易度を自動調整する</span>
          </label>
          <p className="dda-settings-note">
            OFF のときは上の開始値のまま変化しません。ON のときは被弾数・撃墜率に応じて
            弾幕と出現間隔が変わります。
          </p>

          {DDA_SETTINGS_FIELDS.map((section) => (
            <fieldset
              key={section.section}
              className="dda-settings-section"
              disabled={ddaAutoDisabled}
            >
              <legend>{section.section}</legend>
              {section.fields.map((field) => (
                <SettingRow
                  key={field.key}
                  field={field}
                  settings={settings}
                  onChange={onChange}
                  disabled={ddaAutoDisabled}
                />
              ))}
            </fieldset>
          ))}

          <fieldset className="dda-settings-section" disabled={ddaAutoDisabled}>
            <legend>自動調整の下限・上限・ステップ</legend>
            <p className="dda-settings-note">
              プレイ中に変化しうる範囲です。開始値は上のブロックで設定します。
            </p>
            {DDA_RANGE_FIELDS.map((meta) => (
              <RangeRow
                key={meta.rangeKey}
                meta={meta}
                settings={settings}
                onChange={onChange}
                disabled={ddaAutoDisabled}
              />
            ))}
          </fieldset>

          <button
            type="button"
            className="dda-settings-reset"
            onClick={handleReset}
          >
            すべてデフォルトに戻す
          </button>
        </div>
      )}
    </div>
  );
}
