"use client";

import React from "react";
import { Play, Save, Upload, Loader2 } from "lucide-react";
import { usePlannerContext } from "../../context/PlannerContext";

interface GlobalPromptsProps {
    onGenerate: () => void;
    isRegenerating: boolean;
}

export default function GlobalPrompts({ onGenerate, isRegenerating }: GlobalPromptsProps) {
    const { globalConfig, setGlobalConfig } = usePlannerContext();

    const handleChange = (updates: any) => {
        setGlobalConfig(updates);
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_200px]">
            <div className="space-y-4">
                {/* Positive Prompt */}
                <div className="relative">
                    <textarea
                        value={globalConfig.positivePrompt || ""}
                        onChange={(e) => handleChange({ positivePrompt: e.target.value })}
                        placeholder="Global Positive Prompt (appended to all jobs)..."
                        className="h-24 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1">
                        <button className="rounded bg-slate-800 p-1 text-slate-400 hover:text-slate-200" title="Guardar Positivo">
                            <Save className="h-3 w-3" />
                        </button>
                        <button className="rounded bg-slate-800 p-1 text-slate-400 hover:text-slate-200" title="Cargar Positivo">
                            <Upload className="h-3 w-3" />
                        </button>
                    </div>
                </div>

                {/* Negative Prompt */}
                <div className="relative">
                    <textarea
                        value={globalConfig.negativePrompt || ""}
                        onChange={(e) => handleChange({ negativePrompt: e.target.value })}
                        placeholder="Global Negative Prompt (appended to all jobs)..."
                        className="h-24 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-red-900/50 focus:outline-none"
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1">
                        <button className="rounded bg-slate-800 p-1 text-slate-400 hover:text-slate-200" title="Guardar Negativo">
                            <Save className="h-3 w-3" />
                        </button>
                        <button className="rounded bg-slate-800 p-1 text-slate-400 hover:text-slate-200" title="Cargar Negativo">
                            <Upload className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Generate Button Area */}
            <div className="flex flex-col gap-2">
                <button
                    onClick={onGenerate}
                    disabled={isRegenerating}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-green-600 p-4 text-green-100 transition-all hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    {isRegenerating ? (
                        <>
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span className="font-bold">GENERANDO...</span>
                        </>
                    ) : (
                        <>
                            <Play className="h-8 w-8 fill-current" />
                            <span className="text-lg font-bold">GENERAR</span>
                        </>
                    )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                    <button className="rounded border border-slate-800 bg-slate-900 py-2 text-xs text-slate-400 hover:bg-slate-800">
                        Guardar Positivo
                    </button>
                    <button className="rounded border border-slate-800 bg-slate-900 py-2 text-xs text-slate-400 hover:bg-slate-800">
                        Guardar Negativo
                    </button>
                    <button className="rounded border border-slate-800 bg-slate-900 py-2 text-xs text-slate-400 hover:bg-slate-800">
                        Cargar Positivo
                    </button>
                    <button className="rounded border border-slate-800 bg-slate-900 py-2 text-xs text-slate-400 hover:bg-slate-800">
                        Cargar Negativo
                    </button>
                </div>
            </div>
        </div>
    );
}
