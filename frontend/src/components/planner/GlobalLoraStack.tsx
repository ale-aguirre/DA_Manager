"use client";

import React, { useState } from "react";
import { usePlannerContext } from "../../context/PlannerContext";

export function GlobalLoraStack() {
    const { globalLoras, removeGlobalLora } = usePlannerContext();
    const [isExpanded, setIsExpanded] = useState(true);

    if (globalLoras.length === 0 && !isExpanded) return null;

    return (
        <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🌍</span>
                    <h3 className="text-sm font-semibold text-white">
                        Global LoRA Stack
                    </h3>
                    <span className="text-xs text-slate-400">
                        ({globalLoras.length})
                    </span>
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                >
                    {isExpanded ? "Collapse" : "Expand"}
                </button>
            </div>

            {/* Description */}
            {isExpanded && (
                <>
                    <p className="text-xs text-slate-400 mb-3">
                        Applied to <span className="text-blue-400 font-semibold">ALL</span>{" "}
                        job cards at <span className="text-yellow-400">0.6 weight</span>
                    </p>

                    {/* LoRA Tags */}
                    {globalLoras.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {globalLoras.map((lora) => (
                                <div
                                    key={lora}
                                    className="group flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md border border-slate-600 transition-all"
                                >
                                    <span className="text-sm text-white truncate max-w-xs">
                                        {lora.replace(".safetensors", "")}
                                    </span>
                                    <button
                                        onClick={() => removeGlobalLora(lora)}
                                        className="text-slate-400 hover:text-red-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove from global stack"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-700 rounded">
                            No global LoRAs added yet
                        </div>
                    )}

                    {/* Add Button Placeholder */}
                    <button
                        className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={() => {
                            // TODO: Open LoRA selector modal
                            alert("LoRA selector modal - To be implemented");
                        }}
                    >
                        + Add Global LoRA
                    </button>
                </>
            )}
        </div>
    );
}
