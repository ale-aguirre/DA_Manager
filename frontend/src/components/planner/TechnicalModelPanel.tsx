import React, { useState } from "react";
import { RefreshCw, Search, X, ChevronDown, ChevronUp } from "lucide-react";
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

  // Props CRÍTICAS para la nueva UI
  availableLoras?: string[];
  onToggleExtraLora?: (loraName: string) => void;

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
    availableLoras = [], // Default a array vacío para evitar crash
    onToggleExtraLora,
    onSetCheckpoint,
    onSetVae,
    onSetClipSkip,
    onRefreshAll,
  } = props;

  const clipSkipValue =
    techConfigByCharacter[activeCharacter]?.clipSkip ??
    reforgeOptions?.current_clip_skip ??
    1;

  const vaeValue =
    techConfigByCharacter[activeCharacter]?.vae ??
    reforgeOptions?.current_vae ??
    "Automatic";

  const checkpointValue =
    techConfigByCharacter[activeCharacter]?.checkpoint ?? "";

  const selectedExtraLoras =
    techConfigByCharacter[activeCharacter]?.extraLoras || [];

  // Estado local para UI
  const [loraSearch, setLoraSearch] = useState("");
  const [lorasExpanded, setLorasExpanded] = useState(true); // Default abierto para que VEAS el cambio

  const filteredLoras = availableLoras.filter((l) =>
    l.toLowerCase().includes(loraSearch.toLowerCase())
  );

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

      {/* Fila 2: SECCIÓN DE LORAS (LA ZONA ZOMBIE QUE DEBE REVIVIR) */}
      <div className="border-t border-slate-800 pt-3">
        <button
          onClick={() => setLorasExpanded(!lorasExpanded)}
          className="flex items-center justify-between w-full text-left group hover:bg-slate-900/50 p-1 rounded"
        >
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider cursor-pointer group-hover:text-violet-400 transition-colors">
              Extra LoRAs ({selectedExtraLoras.length})
            </label>
            {/* Mini preview de seleccionados */}
            {selectedExtraLoras.length > 0 && !lorasExpanded && (
              <div className="flex gap-1 overflow-hidden">
                <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                <span className="text-[10px] text-slate-500">Activos</span>
              </div>
            )}
          </div>
          {lorasExpanded ? (
            <ChevronUp size={14} className="text-slate-500" />
          ) : (
            <ChevronDown size={14} className="text-slate-500" />
          )}
        </button>

        {lorasExpanded && (
          <div className="mt-2 p-3 rounded-lg border border-slate-800 bg-slate-950 animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Buscador */}
            <div className="relative mb-3">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar LoRA local..."
                value={loraSearch}
                onChange={(e) => setLoraSearch(e.target.value)}
                className="w-full rounded bg-slate-900 border border-slate-700 py-1.5 pl-8 pr-2 text-xs text-slate-200 focus:border-violet-500 focus:outline-none placeholder:text-slate-600"
              />
            </div>

            {/* Lista de Chips */}
            <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto custom-scrollbar content-start">
              {filteredLoras.length === 0 ? (
                <div className="w-full text-center py-2">
                  <span className="text-xs text-slate-600 italic">
                    {availableLoras.length === 0
                      ? "⚠️ No se detectaron LoRAs en /local/loras"
                      : "Sin resultados para tu búsqueda"}
                  </span>
                </div>
              ) : (
                filteredLoras.map((loraName) => {
                  const isSelected = selectedExtraLoras.includes(loraName);
                  return (
                    <button
                      key={loraName}
                      onClick={() =>
                        onToggleExtraLora && onToggleExtraLora(loraName)
                      }
                      className={`
                        px-2.5 py-1 rounded-full text-[11px] border transition-all select-none flex items-center gap-1.5
                        ${
                          isSelected
                            ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/20"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                        }
                      `}
                    >
                      {loraName}
                      {isSelected && <X size={10} className="opacity-70" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
