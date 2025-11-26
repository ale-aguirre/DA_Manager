import React from "react";
import { RefreshCw } from "lucide-react";
import { SliderBar } from "./SliderBar";

export default function TechnicalModelPanel(props: {
  activeCharacter: string;
  checkpoints: string[];
  vaes: string[];
  reforgeOptions?: { current_clip_skip?: number; current_vae?: string } | null;
  checkpointVersion: number;
  techConfigByCharacter: Record<string, { checkpoint?: string; vae?: string; clipSkip?: number }>;
  onSetCheckpoint: (title: string) => Promise<void> | void;
  onSetVae: (value: string) => void;
  onSetClipSkip: (value: number) => void;
  onRefreshAll: () => Promise<void> | void;
}) {
  const {
    activeCharacter,
    checkpoints,
    vaes,
    reforgeOptions,
    checkpointVersion,
    techConfigByCharacter,
    onSetCheckpoint,
    onSetVae,
    onSetClipSkip,
    onRefreshAll,
  } = props;

  const clipSkipValue =
    techConfigByCharacter[activeCharacter]?.clipSkip ??
    (reforgeOptions?.current_clip_skip ?? 1);

  const vaeValue =
    techConfigByCharacter[activeCharacter]?.vae ??
    (reforgeOptions?.current_vae ?? "Automatic");

  const checkpointValue =
    techConfigByCharacter[activeCharacter]?.checkpoint ?? "";

  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-6">
        <label className="text-xs text-slate-300">Stable Diffusion Checkpoint</label>
        <select
          value={checkpointValue}
          onChange={async (e) => {
            const title = e.target.value;
            await onSetCheckpoint(title);
          }}
          className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
          key={`ckpt-${checkpointVersion}`}
        >
          <option value="">(Sin cambio)</option>
          {checkpoints.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="col-span-3">
        <label className="text-xs text-slate-300">VAE</label>
        <select
          value={vaeValue}
          onChange={(e) => onSetVae(e.target.value)}
          className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
        >
          <option value="Automatic">Automatic</option>
          {vaes.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-xs text-slate-300">Clip Skip</label>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1">
            {SliderBar({
              value: clipSkipValue,
              min: 1,
              max: 4,
              step: 1,
              onChange: (v) => onSetClipSkip(v),
            })}
          </div>
          <input
            type="number"
            min={1}
            max={4}
            step={1}
            value={clipSkipValue}
            onChange={(e) => onSetClipSkip(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
          />
        </div>
      </div>
      <div className="col-span-1 flex items-center justify-end">
        <button
          onClick={() => onRefreshAll()}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
        >
          <RefreshCw className="h-3 w-3" /> Actualizar
        </button>
      </div>
    </div>
  );
}

