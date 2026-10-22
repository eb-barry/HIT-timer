import { useEffect, useState } from "react";
import { audio } from "../audio/controller";
import { VOICE_CLIPS, type ClipId } from "../audio/clips";
import type { AudioSettings } from "../audio/settings";

export function SoundPanel({
  settings,
  mp3Clips,
  running,
  onChange,
  onMp3,
}: {
  settings: AudioSettings;
  mp3Clips: ClipId[];
  running: boolean;
  onChange: (patch: Partial<AudioSettings>) => void;
  onMp3: (ids: ClipId[]) => void;
}) {
  const [found, setFound] = useState<ClipId[]>(mp3Clips);
  useEffect(() => setFound(mp3Clips), [mp3Clips]);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const ready = new Set(found);

  async function detect() {
    setBusy(true);
    try {
      const ids = await audio.detectAll();
      setFound(ids);
      onMp3(ids);
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    setPreviewing(true);
    try {
      await audio.preview(settings);
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <>
        <h2 className="section-title spaced">聲音</h2>
        <div className="glass panel">
          <ToggleRow label="語音提示" hint="階段名稱與三、二、一" checked={settings.voice} onChange={(voice) => onChange({ voice })} />
          <ToggleRow label="倒數嗶聲" hint="準備每秒一聲，其他階段只在最後三秒" checked={settings.beep} onChange={(beep) => onChange({ beep })} />
          <ToggleRow label="震動" hint="鍛鍊兩下短震，休息一下長震" checked={settings.vibrate} onChange={(vibrate) => onChange({ vibrate })} />
          <ToggleRow label="螢幕常亮" hint="訓練進行時不讓螢幕睡著" checked={settings.wakeLock} onChange={(wakeLock) => onChange({ wakeLock })} />
          <label className="slider-row">
            <span>語音音量</span>
            <input
              aria-label="語音音量"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.voiceVolume}
              onChange={(event) => onChange({ voiceVolume: Number(event.target.value) })}
            />
          </label>
          <label className="slider-row">
            <span>嗶聲音量</span>
            <input
              aria-label="嗶聲音量"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.beepVolume}
              onChange={(event) => onChange({ beepVolume: Number(event.target.value) })}
            />
          </label>
        </div>

        <button type="button" className="add-btn" data-testid="preview-voice" disabled={running || previewing} onClick={() => void preview()}>
          {previewing ? "試聽中…" : "試聽語音"}
        </button>
        <p className="rule">
          準備階段每秒一聲。鍛鍊、休息、循環休息和冷卻在開始時提示；最後三秒說三、二、一，接著說出下一個動作。
        </p>

        <h2 className="section-title">真人語音</h2>
        <p className="rule">
          {found.length > 0
            ? "已改用偵測到的真人錄音。還沒有檔案的句子仍用電腦語音。"
            : "目前使用電腦語音。把 MP3 放到 public/voices/ 後，按重新偵測就會改為真人錄音。"}
        </p>
        <ul className="voice-list glass panel">
          {VOICE_CLIPS.map((clip) => (
            <li key={clip.id}>
              <span className={ready.has(clip.id) ? "voice-dot is-on" : "voice-dot"} />
              <span className="voice-word">{clip.text}</span>
              <code>{clip.file}</code>
            </li>
          ))}
        </ul>
        <button type="button" className="solid-btn wide" data-testid="detect-voice" disabled={busy || running} onClick={() => void detect()}>
          {busy ? "偵測中…" : "重新偵測語音檔"}
        </button>
        <p className="rule">三、二、一請各錄成獨立短句，盡量短於一秒，才不會跟下一聲重疊。</p>
    </>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div>
        <div className="row-label">{label}</div>
        <div className="row-hint">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={checked ? "switch is-on" : "switch"}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}
