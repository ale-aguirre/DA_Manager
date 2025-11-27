"use client";
import React from "react";
import HiresSettings from "./HiresSettings";
import { SliderBar } from "./SliderBar";
import { RefreshCw, Loader2 } from "lucide-react";

export default function ControlPanel(props: {
  activeCharacter: string;
  paramTab: "generation" | "hires" | "adetailer";
  setParamTab: (tab: "generation" | "hires" | "adetailer") => void;
  techConfigByCharacter: Record<string, {
    steps?: number;
    cfg?: number;
    sampler?: string;
    schedulerType?: string;
    width?: number;
    height?: number;
    batch_count?: number;
    batch_size?: number;
    seed?: number;
    hiresFix?: boolean;
    upscaleBy?: number;
    upscaler?: string;
    hiresSteps?: number;
    adetailer?: boolean;
    adetailerModel?: string;
    extraLoras?: string[];
  }>;
  configByCharacter: Record<string, { denoising?: number; hiresFix?: boolean; outputPath?: string }>;
  plannerContext: Record<string, { recommended_params?: { sampler?: string; steps?: number; cfg?: number } } & { base_prompt?: string; reference_images?: Array<{ url: string; meta: Record<string, unknown> }> } >;
  setTechConfig: (character: string, partial: Partial<{
    steps: number;
    cfg: number;
    sampler: string;
    schedulerType: string;
    seed: number;
    hiresFix: boolean;
    upscaleBy: number;
    upscaler: string;
    hiresSteps: number;
    batch_size: number;
    batch_count: number;
    adetailer: boolean;
    adetailerModel: string;
    width: number;
    height: number;
    extraLoras: string[];
  }>) => void;
  setConfigByCharacter: React.Dispatch<React.SetStateAction<Record<string, { denoising?: number; hiresFix?: boolean; outputPath?: string }>>>;
  reforgeUpscalers: string[];
  refreshingUpscalers: boolean;
  upscalerVersion: number;
  refreshUpscalers: () => void | Promise<void>;
  isRegenerating: boolean;
  onRegenerateDrafts: () => void | Promise<void>;
}) {
  const {
    activeCharacter,
    paramTab,
    setParamTab,
    techConfigByCharacter,
    configByCharacter,
    plannerContext,
    setTechConfig,
    setConfigByCharacter,
    reforgeUpscalers,
    refreshingUpscalers,
    upscalerVersion,
    refreshUpscalers,
    isRegenerating,
    onRegenerateDrafts,
  } = props;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setParamTab("generation")}
          className={`rounded-md px-3 py-1 text-xs border ${
            paramTab === "generation"
              ? "border-slate-600 bg-slate-800 text-slate-100"
              : "border-slate-700 bg-slate-900 text-slate-300"
          }`}
        >
          Generation
        </button>
        <button
          onClick={() => setParamTab("hires")}
          className={`rounded-md px-3 py-1 text-xs border ${
            paramTab === "hires"
              ? "border-slate-600 bg-slate-800 text-slate-100"
              : "border-slate-700 bg-slate-900 text-slate-300"
          }`}
        >
          Hires. Fix
        </button>
        <button
          onClick={() => setParamTab("adetailer")}
          className={`rounded-md px-3 py-1 text-xs border ${
            paramTab === "adetailer"
              ? "border-slate-600 bg-slate-800 text-slate-100"
              : "border-slate-700 bg-slate-900 text-slate-300"
          }`}
        >
          ADetailer
        </button>
        <div className="ml-auto">
          <button
            type="button"
            onClick={onRegenerateDrafts}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            title="Generar"
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Generando...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Generar
              </span>
            )}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900 border border-slate-700 rounded-lg">
        {paramTab === "generation" ? (
          <div>
            <div className="col-span-2 grid grid-cols-4 gap-4 items-end">
              <div className="col-span-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300">Sampling method</label>
                    <select
                      value={
                        techConfigByCharacter[activeCharacter]?.sampler ??
                        plannerContext[activeCharacter]?.recommended_params?.sampler ??
                        "Euler a"
                      }
                      onChange={(e) =>
                        setTechConfig(activeCharacter, { sampler: e.target.value })
                      }
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
                      value={
                        techConfigByCharacter[activeCharacter]?.schedulerType ?? "Automatic"
                      }
                      onChange={(e) =>
                        setTechConfig(activeCharacter, { schedulerType: e.target.value })
                      }
                      className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                    >
                      <option>Automatic</option>
                      <option>Karras</option>
                      <option>Default</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-300">Steps</label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1">
                    {SliderBar({
                      value:
                        techConfigByCharacter[activeCharacter]?.steps ??
                        plannerContext[activeCharacter]?.recommended_params?.steps ??
                        30,
                      min: 1,
                      max: 60,
                      step: 1,
                      onChange: (v) => setTechConfig(activeCharacter, { steps: v }),
                    })}
                  </div>
                  <input
                    type="number"
                    value={
                      techConfigByCharacter[activeCharacter]?.steps ??
                      plannerContext[activeCharacter]?.recommended_params?.steps ??
                      30
                    }
                    onChange={(e) => {
                      let v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      if (v < 1) v = 1;
                      if (v > 60) v = 60;
                      setTechConfig(activeCharacter, { steps: v });
                    }}
                    className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-300">CFG</label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1">
                    {SliderBar({
                      value:
                        techConfigByCharacter[activeCharacter]?.cfg ??
                        plannerContext[activeCharacter]?.recommended_params?.cfg ??
                        7,
                      min: 1,
                      max: 20,
                      step: 0.5,
                      onChange: (v) => setTechConfig(activeCharacter, { cfg: v }),
                    })}
                  </div>
                  <input
                    type="number"
                    step={0.5}
                    value={
                      techConfigByCharacter[activeCharacter]?.cfg ??
                      plannerContext[activeCharacter]?.recommended_params?.cfg ??
                      7
                    }
                    onChange={(e) => {
                      let v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      if (v < 1) v = 1;
                      if (v > 20) v = 20;
                      setTechConfig(activeCharacter, { cfg: v });
                    }}
                    className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                  />
                </div>
              </div>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300">Width</label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      {SliderBar({
                        value: techConfigByCharacter[activeCharacter]?.width ?? 832,
                        min: 512,
                        max: 2048,
                        step: 8,
                        onChange: (v) => setTechConfig(activeCharacter, { width: v }),
                      })}
                    </div>
                    <input
                      type="number"
                      min={512}
                      max={2048}
                      step={8}
                      value={techConfigByCharacter[activeCharacter]?.width ?? 832}
                      onChange={(e) => {
                        let v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        if (v < 512) v = 512;
                        if (v > 2048) v = 2048;
                        setTechConfig(activeCharacter, { width: v });
                      }}
                      className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Height</label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      {SliderBar({
                        value: techConfigByCharacter[activeCharacter]?.height ?? 1216,
                        min: 512,
                        max: 2048,
                        step: 8,
                        onChange: (v) => setTechConfig(activeCharacter, { height: v }),
                      })}
                    </div>
                    <input
                      type="number"
                      min={512}
                      max={2048}
                      step={8}
                      value={techConfigByCharacter[activeCharacter]?.height ?? 1216}
                      onChange={(e) => {
                        let v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        if (v < 512) v = 512;
                        if (v > 2048) v = 2048;
                        setTechConfig(activeCharacter, { height: v });
                      }}
                      className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300">Batch count</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={techConfigByCharacter[activeCharacter]?.batch_count ?? 1}
                      onChange={(e) =>
                        setTechConfig(activeCharacter, { batch_count: Number(e.target.value) })
                      }
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={techConfigByCharacter[activeCharacter]?.batch_count ?? 1}
                      onChange={(e) => {
                        let v = Number(e.target.value);
                        if (!Number.isFinite(v)) v = 1;
                        if (v < 1) v = 1;
                        if (v > 20) v = 20;
                        setTechConfig(activeCharacter, { batch_count: v });
                      }}
                      className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {(techConfigByCharacter[activeCharacter]?.batch_count ?? 1)} jobs planificados
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Batch size</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={techConfigByCharacter[activeCharacter]?.batch_size ?? 1}
                      onChange={(e) =>
                        setTechConfig(activeCharacter, { batch_size: Number(e.target.value) })
                      }
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={techConfigByCharacter[activeCharacter]?.batch_size ?? 1}
                      onChange={(e) => {
                        let v = Number(e.target.value);
                        if (!Number.isFinite(v)) v = 1;
                        if (v < 1) v = 1;
                        if (v > 8) v = 8;
                        setTechConfig(activeCharacter, { batch_size: v });
                      }}
                      className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-300">Seed</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Random (-1)"
                  value={techConfigByCharacter[activeCharacter]?.seed ?? -1}
                  onChange={(e) => {
                    let v = Number(e.target.value);
                    if (!Number.isFinite(v)) v = -1;
                    setTechConfig(activeCharacter, { seed: v });
                  }}
                  className="w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                />
                <button
                  type="button"
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                  onClick={() => setTechConfig(activeCharacter, { seed: -1 })}
                >
                  Random
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {paramTab === "hires" && (
          <HiresSettings
            hiresFix={
              techConfigByCharacter[activeCharacter]?.hiresFix ??
              configByCharacter[activeCharacter]?.hiresFix ??
              true
            }
            onToggleHiresFix={(v) => setTechConfig(activeCharacter, { hiresFix: v })}
            upscalerList={reforgeUpscalers}
            currentUpscaler={techConfigByCharacter[activeCharacter]?.upscaler ?? ""}
            onChangeUpscaler={(v) => setTechConfig(activeCharacter, { upscaler: v })}
            refreshUpscalers={refreshUpscalers}
            refreshing={refreshingUpscalers}
            upscalerVersion={upscalerVersion}
            denoise={configByCharacter[activeCharacter]?.denoising ?? 0.35}
            onChangeDenoise={(v) =>
              setConfigByCharacter((prev) => {
                const next = {
                  ...prev,
                  [activeCharacter]: {
                    ...(prev[activeCharacter] || { hiresFix: true, denoising: 0.35 }),
                    denoising: v,
                  },
                };
                try {
                  localStorage.setItem("planner_config", JSON.stringify(next));
                } catch {}
                return next;
              })
            }
            upscaleBy={techConfigByCharacter[activeCharacter]?.upscaleBy ?? 1.5}
            onChangeUpscaleBy={(v) => setTechConfig(activeCharacter, { upscaleBy: v })}
            hiresSteps={techConfigByCharacter[activeCharacter]?.hiresSteps ?? 10}
            onChangeHiresSteps={(v) => setTechConfig(activeCharacter, { hiresSteps: v })}
          />
        )}
        {paramTab === "adetailer" && (
          <div className="col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <input
                type="checkbox"
                checked={techConfigByCharacter[activeCharacter]?.adetailer ?? true}
                onChange={(e) => setTechConfig(activeCharacter, { adetailer: e.target.checked })}
                className="accent-blue-500"
              />
              ADetailer
            </label>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-300">Modelo</label>
              <select
                value={techConfigByCharacter[activeCharacter]?.adetailerModel ?? "face_yolov8n.pt"}
                onChange={(e) => setTechConfig(activeCharacter, { adetailerModel: e.target.value })}
                disabled={!(techConfigByCharacter[activeCharacter]?.adetailer ?? true)}
                className="rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
              >
                <option>face_yolov8n.pt</option>
                <option>hand_yolov8n.pt</option>
                <option>mediapipe_face.pt</option>
              </select>
            </div>
          </div>
        )}
        {paramTab === "generation" && null}
      </div>
    </div>
  );
}
