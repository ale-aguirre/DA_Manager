"use client";

import React, { useState } from "react";
import { Loader2, Wand2, Settings2 } from "lucide-react";
import { usePlannerContext } from "../../context/PlannerContext";
import { useTranslation } from "../../hooks/useTranslation";
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
  // Lifted state
  strategyMode: "Random" | "Sequence";
  setStrategyMode: (m: "Random" | "Sequence") => void;
  strategyTheme: "None" | "Christmas" | "Halloween";
  setStrategyTheme: (t: "None" | "Christmas" | "Halloween") => void;
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
    strategyMode,
    setStrategyMode,
    strategyTheme,
    setStrategyTheme,
  } = props;

  const { t } = useTranslation();
  const { techConfig, setTechConfig } = usePlannerContext();

  // Local state for UI organization
  const [mainTab, setMainTab] = useState<"strategy" | "technical">("strategy");

  // Helper to get current config for active character
  const currentConfig = techConfig[activeCharacter] || {};

  const handleConfigChange = (updates: any) => {
    setTechConfig(activeCharacter, updates);
  };

  return (
    <div className="mt-4">
      {/* Main Tabs Header */}
      <div className="mb-4 flex border-b border-slate-700">
        <button
          onClick={() => setMainTab("strategy")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${mainTab === "strategy"
            ? "border-violet-500 text-violet-400"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <Wand2 className="h-4 w-4" />
          {t("planner.strategy_title")}
        </button>
        <button
          onClick={() => setMainTab("technical")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${mainTab === "technical"
            ? "border-blue-500 text-blue-400"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <Settings2 className="h-4 w-4" />
          {t("planner.tech_title")}
        </button>
      </div>

      {/* STRATEGY PANEL */}
      {mainTab === "strategy" && (
        <div data-section="section-strategy-panel" className="p-4 bg-slate-900 border border-slate-700 rounded-lg space-y-4">
          {/* Top Row: Mode, Theme, Count - Compact 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Mode */}
            <div>
              <label className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1 block">
                {t("planner.mode_label")}
              </label>
              <select
                value={strategyMode}
                onChange={(e) => setStrategyMode(e.target.value as any)}
                className="w-full h-9 rounded bg-slate-950 border border-slate-700 text-xs text-slate-300 px-2 focus:border-violet-500 focus:outline-none"
              >
                <option value="Random">Random</option>
                <option value="Sequence">Sequence</option>
              </select>
            </div>

            {/* 2. Theme */}
            <div>
              <label className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1 block">
                {t("planner.theme_label")}
              </label>
              <select
                value={strategyTheme}
                onChange={(e) => setStrategyTheme(e.target.value as any)}
                className="w-full h-9 rounded bg-slate-950 border border-slate-700 text-xs text-slate-300 px-2 focus:border-violet-500 focus:outline-none"
              >
                <option value="None">Ninguno</option>
                <option value="Christmas">Christmas (Navidad)</option>
                <option value="Halloween">Halloween</option>
              </select>
            </div>

            {/* 3. Batch Count (Dropdown Max 10) */}
            <div>
              <label className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1 block">
                {t("planner.count_label")}
              </label>
              <select
                value={Math.min(currentConfig.batch_count || 1, 10)}
                onChange={(e) => handleConfigChange({ batch_count: Number(e.target.value) })}
                className="w-full h-9 rounded bg-slate-950 border border-slate-700 text-xs text-slate-300 px-2 focus:border-violet-500 focus:outline-none"
              >
                {[...Array(10)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={onRegenerateDrafts}
              disabled={isRegenerating}
              className="w-full md:w-auto min-w-[200px] relative overflow-hidden group rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 p-3 text-white shadow-lg transition-all hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                {isRegenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="font-bold tracking-wide text-sm">GENERANDO PLAN...</span>
                  </>
                ) : (
                  <>
                    <span className="text-base font-bold tracking-wide">{t("planner.draft_btn")}</span>
                  </>
                )}
              </div>
              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
            </button>
          </div>
        </div>
      )}

      {/* TECHNICAL PANEL */}
      {mainTab === "technical" && (
        <div data-section="section-tech-settings">
          {/* Sub Tabs */}
          <div className="mb-3 flex gap-2">
            {(["generation", "hires", "adetailer"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setParamTab(tab)}
                className={`rounded-md px-3 py-1 text-xs border ${paramTab === tab
                  ? "border-slate-600 bg-slate-800 text-slate-100"
                  : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300"
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
            {paramTab === "generation" && (
              <div className="grid grid-cols-2 gap-4 items-end">
                {/* Generation Settings */}
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300">Sampling method</label>
                    <select
                      value={currentConfig.sampler || "Euler a"}
                      onChange={(e) => handleConfigChange({ sampler: e.target.value })}
                      className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100 text-xs"
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
                      className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100 text-xs"
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
                      className="w-12 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100 text-xs"
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
                      className="w-12 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100 text-xs"
                    />
                  </div>
                </div>

                {/* Width/Height & Batch Size */}
                <div className="col-span-2 grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-300">Width</label>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1">
                          <SliderBar value={currentConfig.width || 832} min={512} max={2048} step={8} onChange={(v) => handleConfigChange({ width: v })} />
                        </div>
                        <input type="number" value={currentConfig.width || 832} onChange={(e) => handleConfigChange({ width: Number(e.target.value) })} className="w-14 rounded bg-slate-800 px-2 py-1 text-right text-xs" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-300">Height</label>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1">
                          <SliderBar value={currentConfig.height || 1216} min={512} max={2048} step={8} onChange={(v) => handleConfigChange({ height: v })} />
                        </div>
                        <input type="number" value={currentConfig.height || 1216} onChange={(e) => handleConfigChange({ height: Number(e.target.value) })} className="w-14 rounded bg-slate-800 px-2 py-1 text-right text-xs" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-300">Batch size (VRAM)</label>
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
                          className="w-12 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-xs text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Seed */}
                    <div>
                      <label className="text-xs text-slate-300">Seed</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          value={currentConfig.seed ?? -1}
                          onChange={(e) => handleConfigChange({ seed: Number(e.target.value) })}
                          className="flex-1 rounded border border-slate-600 bg-slate-800 p-1.5 text-slate-100 text-xs"
                          placeholder="-1"
                        />
                        <button onClick={() => handleConfigChange({ seed: -1 })} className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs hover:bg-slate-700">
                          🎲
                        </button>
                      </div>
                    </div>
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
              <div className="col-span-2 flex items-center gap-6 p-4">
                <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={currentConfig.adetailer ?? true}
                    onChange={(e) => handleConfigChange({ adetailer: e.target.checked })}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <span>Enable ADetailer</span>
                </label>
                <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
                  <label className="text-xs text-slate-400 uppercase font-bold">Model</label>
                  <select
                    value={currentConfig.adetailerModel || "face_yolov8n.pt"}
                    onChange={(e) => handleConfigChange({ adetailerModel: e.target.value })}
                    disabled={!(currentConfig.adetailer ?? true)}
                    className="rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100 text-sm disabled:opacity-50"
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
      )}
    </div>
  );
}
