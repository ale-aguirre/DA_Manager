"use client";
import React from "react";
import { Loader2, RefreshCw } from "lucide-react";

export default function HiresSettings(props: {
  hiresFix: boolean;
  onToggleHiresFix: (v: boolean) => void;
  upscalerList: string[];
  currentUpscaler: string;
  onChangeUpscaler: (v: string) => void;
  refreshUpscalers: () => void;
  refreshing: boolean;
  upscalerVersion: number;
  denoise: number;
  onChangeDenoise: (v: number) => void;
  upscaleBy: number;
  onChangeUpscaleBy: (v: number) => void;
  hiresSteps: number;
  onChangeHiresSteps: (v: number) => void;
}) {
  const {
    hiresFix,
    onToggleHiresFix,
    upscalerList,
    currentUpscaler,
    onChangeUpscaler,
    refreshUpscalers,
    refreshing,
    upscalerVersion,
    denoise,
    onChangeDenoise,
    upscaleBy,
    onChangeUpscaleBy,
    hiresSteps,
    onChangeHiresSteps,
  } = props;

  return (
    <>
      <div className="col-span-2 flex gap-6 items-center">
        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input
            type="checkbox"
            checked={hiresFix}
            onChange={(e) => onToggleHiresFix(e.target.checked)}
            className="accent-blue-500"
          />
          Hires. Fix
        </label>
      </div>
      {hiresFix && (
        <div className="col-span-2 w-full space-y-2">
          <div className="grid grid-cols-1 gap-4">
            <div className="min-w-0">
              <label className="text-xs text-slate-300 flex items-center justify-between">
                <span>Upscaler</span>
                <button
                  type="button"
                  onClick={refreshUpscalers}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                >
                  {refreshing ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Actualizando
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" /> Actualizar
                    </span>
                  )}
                </button>
              </label>
              <select
                key={`upscaler-${upscalerVersion}`}
                value={currentUpscaler}
                onChange={(e) => onChangeUpscaler(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
              >
                <option value="">(none)</option>
                {upscalerList.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="text-xs text-slate-300 flex items-center justify-between">
                <span>Denoise</span>
                <input
                  type="number"
                  step={0.01}
                  value={denoise}
                  onChange={(e) => onChangeDenoise(Number(e.target.value))}
                  className="ml-2 w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                />
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={denoise}
                onChange={(e) => onChangeDenoise(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-slate-300 flex items-center justify-between">
                <span>Upscale By (x)</span>
              </label>
              <input
                type="number"
                step={0.05}
                min={1}
                max={4}
                value={upscaleBy}
                onChange={(e) => onChangeUpscaleBy(Number(e.target.value))}
                className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
              />
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={upscaleBy}
                onChange={(e) => onChangeUpscaleBy(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-slate-300 flex items-center justify-between">
                <span>Hires Steps</span>
              </label>
              <input
                type="number"
                step={1}
                min={0}
                max={60}
                value={hiresSteps}
                onChange={(e) => onChangeHiresSteps(Number(e.target.value))}
                className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
              />
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={hiresSteps}
                onChange={(e) => onChangeHiresSteps(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
