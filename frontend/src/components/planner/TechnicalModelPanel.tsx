import React from "react";
import { RefreshCw } from "lucide-react";
import { SliderBar } from "./SliderBar";

export default function TechnicalModelPanel(props: {
  activeCharacter: string;
  checkpoints: string[];
  vaes: string[];
  reforgeOptions?: { current_clip_skip?: number; current_vae?: string } | null;
  checkpointVersion: number;
  techConfigByCharacter: Record<
    string,
    {
      checkpoint?: string;
      vae?: string;
      clipSkip?: number;
      extraLoras?: string[];
    }
  >;
  globalConfig?: {
    checkpoint?: string;
    vae?: string;
    clipSkip?: number;
    upscaler?: string;
    hiresSteps?: number;
  };

  // Props CRÍTICAS para la nueva UI (ahora LoRAs se manejan en tab Estilos)
  // availableLoras y onToggleExtraLora ya no se usan aquí

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
    globalConfig,
    onSetCheckpoint,
    onSetVae,
    onSetClipSkip,
    onRefreshAll,
  } = props;

  const clipSkipValue =
    techConfigByCharacter[activeCharacter]?.clipSkip ??
    globalConfig?.clipSkip ??
    reforgeOptions?.current_clip_skip ??
    2;

  const vaeValue =
    techConfigByCharacter[activeCharacter]?.vae ??
    globalConfig?.vae ??
    reforgeOptions?.current_vae ??
    "Automatic";

  const checkpointValue =
    techConfigByCharacter[activeCharacter]?.checkpoint ??
    globalConfig?.checkpoint ??
    (checkpoints.length > 0 ? checkpoints[0] : "");

  return (
    <div className="space-y-4">
      {/* Fila 1: Checkpoint, VAE, Refresh */}
      <div className="grid grid-cols-12 gap-3 items-end">
        <div className="col-span-5">
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
            Checkpoint
          </label>
          <select
            value={checkpointValue}
            onChange={async (e) => {
              const title = e.target.value;
              await onSetCheckpoint(title);
            }}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
            key={`ckpt-${checkpointVersion}`}
          >
            <option value="">(Sin cambio)</option>
            {checkpoints.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-3">
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
            VAE
          </label>
          <select
            value={vaeValue}
            onChange={(e) => onSetVae(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="Automatic">Automatic</option>
            {vaes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-3">
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
            Clip Skip
          </label>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-6 flex items-center">
              {SliderBar({
                value: clipSkipValue,
                min: 1,
                max: 4,
                step: 1,
                onChange: (v) => onSetClipSkip(v),
              })}
            </div>
            <span className="text-xs font-mono text-slate-300 w-4 text-center">
              {clipSkipValue}
            </span>
          </div>
        </div>
        <div className="col-span-1 flex justify-end">
          <button
            onClick={() => onRefreshAll()}
            className="p-2 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Actualizar lista de modelos"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
