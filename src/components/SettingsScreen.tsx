import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipId } from "../audio/clips";
import type { AudioSettings } from "../audio/settings";
import { SoundPanel } from "./MoreScreen";
import { buildSegments, planSummary, sanitizeConfig, totalDurationSec } from "../timer/plan";
import { formatClock } from "../timer/format";
import { LIMITS, type ConfigKey, type TimerConfig } from "../timer/types";

const FIELDS: { key: ConfigKey; label: string; hint: string; color: string; time: boolean }[] = [
  { key: "prepareSec", label: "準備", hint: "開始前的倒數", color: "#3AA3A6", time: true },
  { key: "workSec", label: "鍛鍊", hint: "運動時長", color: "#14686B", time: true },
  { key: "restSec", label: "休息", hint: "兩輪鍛鍊之間", color: "#C48B72", time: true },
  { key: "rounds", label: "週期", hint: "鍛鍊與休息的組合", color: "#1F7A86", time: false },
  { key: "cycles", label: "循環", hint: "由數個週期組成", color: "#C4A484", time: false },
  { key: "cycleRestSec", label: "循環之間的休息", hint: "循環結束後的恢復", color: "#E4D3C0", time: true },
  { key: "cooldownSec", label: "冷卻時間", hint: "全部完成後的緩和", color: "#7FB4B2", time: true },
];

function isDirty(draft: TimerConfig, preset: TimerConfig) {
  const keys: (keyof TimerConfig)[] = [
    "name",
    "prepareSec",
    "workSec",
    "restSec",
    "rounds",
    "cycles",
    "cycleRestSec",
    "cooldownSec",
  ];
  return keys.some((key) => draft[key] !== preset[key]);
}

export function SettingsScreen({
  preset,
  presets,
  onSave,
  onSelect,
  onAdd,
  onDelete,
  onBack,
  statusNote,
  audio,
  onAudio,
  mp3Clips,
  onMp3,
  running,
}: {
  preset: TimerConfig;
  presets: TimerConfig[];
  onSave: (next: TimerConfig) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  statusNote: string | null;
  audio: AudioSettings;
  onAudio: (patch: Partial<AudioSettings>) => void;
  mp3Clips: ClipId[];
  onMp3: (ids: ClipId[]) => void;
  running: boolean;
}) {
  const [draft, setDraft] = useState(preset);
  const [picker, setPicker] = useState<ConfigKey | null>(null);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [pendingAdd, setPendingAdd] = useState(false);
  const [pendingBack, setPendingBack] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = isDirty(draft, preset);
  const safe = sanitizeConfig(draft);
  const total = totalDurationSec(buildSegments(safe));
  const short = [safe.prepareSec, safe.workSec, safe.restSec, safe.cycleRestSec, safe.cooldownSec].some(
    (value, index) => value > 0 && value < 3 && !(index === 1 && value === 0),
  );

  useEffect(() => {
    setDraft(preset);
  }, [preset]);

  function update(key: ConfigKey, value: number) {
    const limit = LIMITS[key];
    const next = Math.min(limit.max, Math.max(limit.min, Math.round(value)));
    setDraft((current) => ({ ...current, [key]: next }));
  }

  function step(key: ConfigKey, direction: number) {
    const limit = LIMITS[key];
    update(key, draft[key] + direction * limit.step);
  }

  function commitAnd(then: () => void) {
    onSave(sanitizeConfig(draft));
    then();
  }

  function requestBack() {
    if (dirty) setPendingBack(true);
    else onBack();
  }

  return (
    <section className="settings">
      <header className="editor-bar">
        <button type="button" className="text-btn" onClick={requestBack}>
          返回
        </button>
        <h1>設定</h1>
        <button
          type="button"
          className="text-btn save"
          data-testid="save-settings"
          disabled={!dirty}
          onClick={() => onSave(sanitizeConfig(draft))}
        >
          儲存
        </button>
      </header>
      {statusNote ? (
        <button type="button" className="live-chip" onClick={requestBack}>
          {statusNote}
        </button>
      ) : null}

      <div className="scroll">
        <label className="name-field glass">
          <span>計時器名稱</span>
          <input
            aria-label="計時器名稱"
            maxLength={24}
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </label>

        <div className="chips" role="tablist" aria-label="計時器">
          {presets.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === preset.id ? "chip is-on" : "chip"}
              aria-pressed={item.id === preset.id}
              onClick={() => {
                if (item.id === preset.id) return;
                if (dirty) setPendingSelect(item.id);
                else onSelect(item.id);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="glass panel">
          {FIELDS.map((field) => {
            const value = draft[field.key];
            const limit = LIMITS[field.key];
            return (
              <div className="row" key={field.key}>
                <span className="pebble" style={{ background: pebble(field.color) }} />
                <div className="row-copy">
                  <div className="row-label">{field.label}</div>
                  <div className="row-hint">{field.hint}</div>
                </div>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`減少${field.label}`}
                    disabled={value <= limit.min}
                    onClick={() => step(field.key, -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="step-value"
                    data-testid={`${field.key}-value`}
                    onClick={() => setPicker(field.key)}
                  >
                    {field.time ? formatClock(value) : value}
                  </button>
                  <button
                    type="button"
                    aria-label={`增加${field.label}`}
                    disabled={value >= limit.max}
                    onClick={() => step(field.key, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="plan-copy">{planSummary(safe)}</p>
        <p className="plan-total" data-testid="plan-total">
          本次總長 {formatClock(total)}
        </p>
        <p className="rule">
          每個循環的最後一輪會改接循環間休息；全部結束後進入冷卻。少於 3 秒的階段只說出動作，不播三、二、一。
        </p>
        {short ? <p className="rule warn">目前有短於 3 秒的階段，倒數數字會讓給動作名稱。</p> : null}

        <button type="button" className="add-btn" onClick={() => (dirty ? setPendingAdd(true) : onAdd())}>
          <span className="add-icon">＋</span>
          增加新的計時器
        </button>
        <button
          type="button"
          className="text-btn danger"
          disabled={presets.length <= 1}
          onClick={() => setConfirmDelete(true)}
        >
          刪除這個計時器
        </button>

        <SoundPanel
          settings={audio}
          mp3Clips={mp3Clips}
          running={running}
          onChange={onAudio}
          onMp3={onMp3}
        />
      </div>

      {picker ? (
        <Picker
          field={FIELDS.find((field) => field.key === picker)!}
          value={draft[picker]}
          onChange={(value) => update(picker, value)}
          onClose={() => setPicker(null)}
        />
      ) : null}

      {pendingSelect ? (
        <ChoiceDialog
          title="設定還沒儲存"
          copy="要先儲存，再切換到另一個計時器嗎？"
          confirm="儲存並切換"
          alt="放棄修改"
          onConfirm={() => {
            const id = pendingSelect;
            setPendingSelect(null);
            commitAnd(() => onSelect(id));
          }}
          onAlt={() => {
            const id = pendingSelect;
            setPendingSelect(null);
            onSelect(id);
          }}
          onClose={() => setPendingSelect(null)}
        />
      ) : null}

      {pendingAdd ? (
        <ChoiceDialog
          title="設定還沒儲存"
          copy="新增會計時器會沿用已儲存的內容。"
          confirm="儲存後新增"
          alt="放棄修改並新增"
          onConfirm={() => {
            setPendingAdd(false);
            commitAnd(onAdd);
          }}
          onAlt={() => {
            setPendingAdd(false);
            onAdd();
          }}
          onClose={() => setPendingAdd(false)}
        />
      ) : null}

      {pendingBack ? (
        <ChoiceDialog
          title="設定還沒儲存"
          copy="返回計時畫面之前，要先儲存週期變更嗎？"
          confirm="儲存並返回"
          alt="不儲存"
          onConfirm={() => {
            setPendingBack(false);
            commitAnd(onBack);
          }}
          onAlt={() => {
            setPendingBack(false);
            onBack();
          }}
          onClose={() => setPendingBack(false)}
        />
      ) : null}

      {confirmDelete ? (
        <ChoiceDialog
          title="刪除這個計時器？"
          copy={`「${preset.name}」會從這台裝置移除。`}
          confirm="刪除"
          alt="取消"
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete(preset.id);
          }}
          onAlt={() => setConfirmDelete(false)}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </section>
  );
}

function pebble(color: string) {
  return `radial-gradient(circle at 35% 30%, #ffffff, ${color} 46%, color-mix(in srgb, ${color} 72%, #14383a))`;
}

function Picker({
  field,
  value,
  onChange,
  onClose,
}: {
  field: (typeof FIELDS)[number];
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
}) {
  const limit = LIMITS[field.key];
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  const minuteOptions = useMemo(() => range(0, Math.floor(limit.max / 60)), [limit.max]);
  const countOptions = useMemo(() => range(limit.min, limit.max), [limit.max, limit.min]);

  return (
    <div className="backdrop sheet-host" onClick={onClose}>
      <div
        className="sheet glass"
        role="dialog"
        aria-label={field.label}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2>{field.label}</h2>
        <p>{field.hint}</p>
        {field.time ? (
          <div className="wheels">
            <Wheel
              label="分"
              value={minutes}
              options={minuteOptions}
              onChange={(next) => onChange(next * 60 + seconds)}
            />
            <Wheel
              label="秒"
              value={seconds}
              options={range(0, 59)}
              onChange={(next) => onChange(minutes * 60 + next)}
            />
          </div>
        ) : (
          <div className="wheels single">
            <Wheel label={field.label} value={value} options={countOptions} onChange={onChange} />
          </div>
        )}
        <button type="button" className="solid-btn wide" onClick={onClose}>
          完成
        </button>
      </div>
    </div>
  );
}

function Wheel({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrolling = useRef(false);
  const item = 48;

  useEffect(() => {
    const element = ref.current;
    if (!element || scrolling.current) return;
    const index = Math.max(0, options.indexOf(value));
    element.scrollTop = index * item;
  }, [options, value]);

  return (
    <div className="wheel-wrap">
      <div className="wheel-window" />
      <div
        className="wheel"
        ref={ref}
        role="listbox"
        aria-label={label}
        onScroll={(event) => {
          const element = event.currentTarget;
          scrolling.current = true;
          window.clearTimeout(Number(element.dataset.timer));
          const timer = window.setTimeout(() => {
            scrolling.current = false;
            const index = Math.min(options.length - 1, Math.max(0, Math.round(element.scrollTop / item)));
            const next = options[index];
            if (next !== undefined && next !== value) onChange(next);
          }, 90);
          element.dataset.timer = String(timer);
        }}
      >
        <div style={{ height: item * 2 }} />
        {options.map((option) => (
          <div key={option} role="option" aria-selected={option === value} className={option === value ? "wheel-item is-selected" : "wheel-item"}>
            {String(option).padStart(2, "0")}
          </div>
        ))}
        <div style={{ height: item * 2 }} />
      </div>
      <span className="wheel-unit">{label}</span>
    </div>
  );
}

function ChoiceDialog({
  title,
  copy,
  confirm,
  alt,
  onConfirm,
  onAlt,
  onClose,
}: {
  title: string;
  copy: string;
  confirm: string;
  alt: string;
  onConfirm: () => void;
  onAlt: () => void;
  onClose: () => void;
}) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog glass" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className="dialog-actions column">
          <button type="button" className="solid-btn" onClick={onConfirm}>
            {confirm}
          </button>
          <button type="button" className="text-btn" onClick={onAlt}>
            {alt}
          </button>
        </div>
      </div>
    </div>
  );
}

function range(start: number, end: number) {
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}
