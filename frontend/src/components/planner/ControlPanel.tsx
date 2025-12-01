"use client";

import React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { usePlannerContext } from "../../context/PlannerContext";
import HiresSettings from "./HiresSettings";
import { SliderBar } from "./SliderBar";

interface ControlPanelProps {
  activeCharacter: string;
  paramTab: "generation" | "hires" | "adetailer";
  setParamTab: (tab: "generation" | "hires" | "adetailer") => void;
  isRegenerating: boolean;
  onRegenerateDrafts: () => void | Promise<void>;
  // Upscaler props passed down for now or moved to context later
  reforgeUpscalers: string[];
  refreshingUpscalers: boolean;
  upscalerVersion: number;
  refreshUpscalers: () => void | Promise<void>;
}

export default function ControlPanel(props: ControlPanelProps) {
  const {
    activeCharacter,
    paramTab,
    setParamTab,
    isRegenerating,
    onRegenerateDrafts,
    reforgeUpscalers,
    refreshingUpscalers,
    upscalerVersion,
    refreshUpscalers,
  } = props;

  const { techConfig, setTechConfig } = usePlannerContext();

  // Helper to get current config for active character
  const currentConfig = techConfig[activeCharacter] || {};
  // const globalDefaults = globalConfig || {};

  const handleConfigChange = (updates: any) => {
    setTechConfig(activeCharacter, updates);
  };

  return (
    <div className="mt-4">
      {/* Tabs */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["generation", "hires", "adetailer"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setParamTab(tab)}
              className={`rounded-md px-3 py-1 text-xs border ${paramTab === tab
                ? "border-slate-600 bg-slate-800 text-slate-100"
                : "border-slate-700 bg-slate-900 text-slate-300"
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onRegenerateDrafts}
          disabled={isRegenerating}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
        >
          {isRegenerating ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Generando...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" /> Update
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900 border border-slate-700 rounded-lg">
        {paramTab === "generation" && (
          <div className="col-span-2 grid grid-cols-4 gap-4 items-end">
            {/* Sampler & Scheduler */}
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300">Sampling method</label>
                <select
                  value={currentConfig.sampler || "Euler a"}
                  onChange={(e) => handleConfigChange({ sampler: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                >
                  <option>Euler a</option>
                  <option>Euler</option>
                  <option>DDIM</option>
                  <option>DPM++ 2M Karras</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-300">Schedule type</label>
                <select
                  value={currentConfig.schedulerType || "Automatic"}
                  onChange={(e) => handleConfigChange({ schedulerType: e.target.value })}
                  className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                >
                  <option>Automatic</option>
                  <option>Karras</option>
                  <option>Default</option>
                </select>
              </div>
            </div>

            {/* Steps */}
            <div>
              <label className="text-xs text-slate-300">Steps</label>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1">
                  <SliderBar
                    value={currentConfig.steps || 30}
                    min={1}
                    max={60}
                    step={1}
                    onChange={(v) => handleConfigChange({ steps: v })}
                  />
                </div>
                <input
                  type="number"
                  value={currentConfig.steps || 30}
                  onChange={(e) => handleConfigChange({ steps: Number(e.target.value) })}
                  className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                />
              </div>
            </div>

            {/* CFG */}
            <div>
              <label className="text-xs text-slate-300">CFG</label>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1">
                  <SliderBar
                    value={currentConfig.cfg || 7}
                    min={1}
                    max={20}
                    step={0.5}
                    onChange={(v) => handleConfigChange({ cfg: v })}
                  />
                </div>
                <input
                  type="number"
                  value={currentConfig.cfg || 7}
                  onChange={(e) => handleConfigChange({ cfg: Number(e.target.value) })}
                  className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                />
              </div>
            </div>

            {/* Width/Height & Batch */}
            <div className="col-span-2 grid grid-cols-2 gap-4 mt-2">
              {/* Dimensions */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300">Width</label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      <SliderBar value={currentConfig.width || 832} min={512} max={2048} step={8} onChange={(v) => handleConfigChange({ width: v })} />
                    </div>
                    <input type="number" value={currentConfig.width || 832} onChange={(e) => handleConfigChange({ width: Number(e.target.value) })} className="w-16 rounded bg-slate-800 px-2 py-1 text-right" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Height</label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      <SliderBar value={currentConfig.height || 1216} min={512} max={2048} step={8} onChange={(v) => handleConfigChange({ height: v })} />
                    </div>
                    <input type="number" value={currentConfig.height || 1216} onChange={(e) => handleConfigChange({ height: Number(e.target.value) })} className="w-16 rounded bg-slate-800 px-2 py-1 text-right" />
                  </div>
                </div>
              </div>

              {/* Batch */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300">Batch count</label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      <SliderBar
                        value={currentConfig.batch_count || 1}
                        min={1}
                        max={20}
                        step={1}
                        onChange={(v) => handleConfigChange({ batch_count: v })}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={currentConfig.batch_count || 1}
                      onChange={(e) => handleConfigChange({ batch_count: Number(e.target.value) })}
                      className="w-12 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Batch size</label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      <SliderBar
                        value={currentConfig.batch_size || 1}
                        min={1}
                        max={8}
                        step={1}
                        onChange={(v) => handleConfigChange({ batch_size: v })}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={currentConfig.batch_size || 1}
                      onChange={(e) => handleConfigChange({ batch_size: Number(e.target.value) })}
                      className="w-12 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seed */}
            <div className="col-span-2 mt-2">
              <label className="text-xs text-slate-300">Seed</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={currentConfig.seed ?? -1}
                  onChange={(e) => handleConfigChange({ seed: Number(e.target.value) })}
                  className="flex-1 rounded border border-slate-600 bg-slate-800 p-2 text-slate-100"
                  placeholder="-1 (Random)"
                />
                <button onClick={() => handleConfigChange({ seed: -1 })} className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700">
                  Random
                </button>
              </div>
            </div>
          </div>
        )}

        {paramTab === "hires" && (
          <HiresSettings
            hiresFix={currentConfig.hiresFix ?? true}
            onToggleHiresFix={(v) => handleConfigChange({ hiresFix: v })}
            upscalerList={reforgeUpscalers}
            currentUpscaler={currentConfig.upscaler || ""}
            onChangeUpscaler={(v) => handleConfigChange({ upscaler: v })}
            refreshUpscalers={refreshUpscalers}
            refreshing={refreshingUpscalers}
            upscalerVersion={upscalerVersion}
            denoise={currentConfig.denoisingStrength ?? 0.35}
            onChangeDenoise={(v) => handleConfigChange({ denoisingStrength: v })}
            upscaleBy={currentConfig.upscaleBy || 1.5}
            onChangeUpscaleBy={(v) => handleConfigChange({ upscaleBy: v })}
            hiresSteps={currentConfig.hiresSteps || 10}
            onChangeHiresSteps={(v) => handleConfigChange({ hiresSteps: v })}
          />
        )}

        {paramTab === "adetailer" && (
          <div className="col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input
                type="checkbox"
                checked={currentConfig.adetailer ?? true}
                onChange={(e) => handleConfigChange({ adetailer: e.target.checked })}
                className="accent-blue-500"
              />
              ADetailer
            </label>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-300">Model</label>
              <select
                value={currentConfig.adetailerModel || "face_yolov8n.pt"}
                onChange={(e) => handleConfigChange({ adetailerModel: e.target.value })}
                disabled={!(currentConfig.adetailer ?? true)}
                className="rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
              >
                <option>face_yolov8n.pt</option>
                <option>hand_yolov8n.pt</option>
                <option>mediapipe_face.pt</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
