"use client";

import React from "react";
import { RefreshCw, Settings } from "lucide-react";
import { usePlannerContext } from "../../context/PlannerContext";

export default function TechnicalPanel() {
    const { globalConfig, setGlobalConfig, resources, loadResources, uiState } = usePlannerContext();

    // Helper to handle config changes
    const handleChange = (updates: any) => {
        setGlobalConfig(updates);
    };

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Settings className="h-4 w-4 text-violet-400" />
                    Panel Técnico
                </h3>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        Motor: Online
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                {/* Checkpoint */}
                <div className="md:col-span-5">
                    <label className="mb-1 block text-xs font-medium text-slate-400">CHECKPOINT</label>
                    <select
                        value={globalConfig.checkpoint || ""}
                        onChange={(e) => handleChange({ checkpoint: e.target.value })}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                    >
                        <option value="">(Default / None)</option>
                        {resources?.checkpoints?.map((ckpt) => (
                            <option key={ckpt} value={ckpt}>
                                {ckpt}
                            </option>
                        ))}
                    </select>
                </div>

                {/* VAE */}
                <div className="md:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-400">VAE</label>
                    <select
                        value={globalConfig.vae || "Automatic"}
                        onChange={(e) => handleChange({ vae: e.target.value })}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                    >
                        <option value="Automatic">Automatic</option>
                        <option value="None">None</option>
                        {resources?.vaes?.map((vae) => (
                            <option key={vae} value={vae}>
                                {vae}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Clip Skip */}
                <div className="md:col-span-4 flex items-end gap-2">
                    <div className="flex-1">
                        <label className="mb-1 flex justify-between text-xs font-medium text-slate-400">
                            <span>CLIP SKIP</span>
                            <input
                                type="number"
                                min={1}
                                max={12}
                                value={globalConfig.clipSkip || 1}
                                onChange={(e) => handleChange({ clipSkip: Number(e.target.value) })}
                                className="w-12 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                            />
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={12}
                            step={1}
                            value={globalConfig.clipSkip || 1}
                            onChange={(e) => handleChange({ clipSkip: Number(e.target.value) })}
                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-violet-500"
                        />
                    </div>
                    <button
                        onClick={loadResources}
                        disabled={uiState.isLoading}
                        className="mb-0.5 rounded border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
                        title="Recargar Recursos"
                    >
                        <RefreshCw className={`h-4 w-4 ${uiState.isLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}
