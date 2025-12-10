"use client";

import React, { useState } from "react";
import { Plus, X, Image } from "lucide-react";
import { usePlannerContext } from "../../context/PlannerContext";
import LoraGalleryModal from "./LoraGalleryModal";

interface LoraStackItem {
    name: string;
    weight: number;
}

interface LoraStackManagerProps {
    activeCharacter: string;
}

export default function LoraStackManager({ activeCharacter }: LoraStackManagerProps) {
    const { techConfig, setTechConfig } = usePlannerContext();
    const [showGallery, setShowGallery] = useState(false);

    // Get current character's extra loras
    const currentConfig = activeCharacter ? techConfig[activeCharacter] : null;
    const extraLoras: string[] = currentConfig?.extraLoras || [];

    // Parse lora strings (format: "name:weight" or just "name")
    const loraStack: LoraStackItem[] = extraLoras.map((lora) => {
        const parts = lora.split(":");
        return {
            name: parts[0],
            weight: parts[1] ? parseFloat(parts[1]) : 0.7,
        };
    });

    const updateLoraWeight = (index: number, newWeight: number) => {
        if (!activeCharacter) return;

        const updated = [...loraStack];
        updated[index].weight = newWeight;

        const loraStrings = updated.map((item) => `${item.name}:${item.weight}`);

        setTechConfig(activeCharacter, {
            extraLoras: loraStrings,
        });
    };

    const removeLora = (index: number) => {
        if (!activeCharacter) return;

        const updated = loraStack.filter((_, i) => i !== index);
        const loraStrings = updated.map((item) => `${item.name}:${item.weight}`);

        setTechConfig(activeCharacter, {
            extraLoras: loraStrings,
        });
    };

    const handleAddLora = (loraName: string) => {
        if (!activeCharacter) return;

        // Check if already exists
        if (loraStack.some((item) => item.name === loraName)) {
            return;
        }

        const newLoraString = `${loraName}:0.7`;
        const updatedLoras = [...extraLoras, newLoraString];

        setTechConfig(activeCharacter, {
            extraLoras: updatedLoras,
        });
    };

    if (!activeCharacter) {
        return (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-8">
                <p className="text-sm text-slate-500">Selecciona un personaje en el Planner para gestionar LoRAs</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                        LoRA Stack Manager
                    </h3>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {loraStack.length} activos
                    </span>
                </div>

                {/* LoRA List */}
                {loraStack.length > 0 ? (
                    <div className="space-y-2">
                        {loraStack.map((item, index) => (
                            <div
                                key={`${item.name}-${index}`}
                                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3 transition-colors hover:border-slate-600"
                            >
                                {/* Icon */}
                                <div className="flex h-10 w-10 items-center justify-center rounded bg-violet-900/30 text-violet-400">
                                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                    <Image className="h-5 w-5" aria-hidden />
                                </div>

                                {/* Name */}
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-200">
                                        {item.name}
                                    </p>
                                    <p className="text-xs text-slate-500">LoRA</p>
                                </div>

                                {/* Weight Slider */}
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-slate-400 whitespace-nowrap">
                                        Weight:
                                    </label>
                                    <input
                                        type="number"
                                        min={0.1}
                                        max={2.0}
                                        step={0.1}
                                        value={item.weight}
                                        onChange={(e) => updateLoraWeight(index, parseFloat(e.target.value))}
                                        className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-right text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                                    />
                                    <input
                                        type="range"
                                        min={0.1}
                                        max={2.0}
                                        step={0.05}
                                        value={item.weight}
                                        onChange={(e) => updateLoraWeight(index, parseFloat(e.target.value))}
                                        className="w-24 h-2 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-violet-500"
                                    />
                                </div>

                                {/* Remove Button */}
                                <button
                                    onClick={() => removeLora(index)}
                                    className="rounded p-1.5 text-red-400 hover:bg-red-900/20 transition-colors"
                                    title="Eliminar LoRA"
                                >
                                    <X className="h-4 w-4" aria-hidden />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-8">
                        <p className="text-sm text-slate-500">No hay LoRAs agregados. Haz click en &quot;Abrir Galería&quot;</p>
                    </div>
                )}

                {/* Add Button */}
                <button
                    onClick={() => setShowGallery(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-300 transition-colors hover:border-violet-500/50 hover:bg-violet-500/20"
                >
                    <Plus className="h-5 w-5" aria-hidden />
                    ABRIR GALERÍA
                </button>
            </div>

            {/* Gallery Modal */}
            {showGallery && (
                <LoraGalleryModal
                    onClose={() => setShowGallery(false)}
                    onSelect={handleAddLora}
                />
            )}
        </>
    );
}
