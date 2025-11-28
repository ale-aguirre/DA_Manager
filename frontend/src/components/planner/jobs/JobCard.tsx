"use client";

import React, { useState } from "react";
import {
    Bot, Camera, ChevronDown, ChevronUp, Loader2, MapPin,
    Shirt, Sparkles, Trash2, User, Zap
} from "lucide-react";
import { usePlannerContext } from "../../../context/PlannerContext";
import { PlannerJob } from "../../../types/planner";

interface JobCardProps {
    job: PlannerJob;
    index: number;
}

export default function JobCard({ job, index }: JobCardProps) {
    const {
        resources,
        updateJob,
        removeJob,
        magicFixJob,
        uiState
    } = usePlannerContext();

    const [isExpanded, setIsExpanded] = useState(true);
    const [localLoading, setLocalLoading] = useState(false);

    // Helper to safely get value from job or ai_meta
    const getValue = (field: keyof PlannerJob | string) => {
        // @ts-ignore
        return job[field] || (job.ai_meta && job.ai_meta[field]) || "";
    };

    const handleMagicFix = async () => {
        setLocalLoading(true);
        await magicFixJob(index);
        setLocalLoading(false);
    };

    return (
        <article className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition-colors hover:border-slate-700">
            {/* Header */}
            <div
                className="flex cursor-pointer items-center justify-between border-b border-slate-800 pb-2"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">Job #{index + 1}</span>
                    {job.ai_meta && (
                        <span className="rounded bg-violet-900/30 px-1.5 py-0.5 text-[10px] text-violet-300">
                            AI Enhanced
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removeJob(index);
                        }}
                        className="rounded p-1 text-red-400 hover:bg-red-900/20"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
            </div>

            {/* Body */}
            {isExpanded && (
                <div className="relative mt-3 space-y-3">
                    {/* Loading Overlay */}
                    {(uiState.isLoading || localLoading) && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60 backdrop-blur-[1px]">
                            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                        </div>
                    )}

                    {/* Controls Grid */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {/* Outfit */}
                        <div>
                            <label className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                                <Shirt className="h-3 w-3" /> Outfit
                            </label>
                            <select
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                value={getValue("outfit")}
                                onChange={(e) => updateJob(index, { outfit: e.target.value } as any)}
                            >
                                <option value="">(Empty)</option>
                                {/* Dynamic Options + Resource List */}
                                {[
                                    ...(getValue("outfit") && !(resources?.outfits || []).includes(getValue("outfit"))
                                        ? [getValue("outfit")] : []),
                                    ...(resources?.outfits || [])
                                ].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Pose */}
                        <div>
                            <label className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                                <User className="h-3 w-3" /> Pose
                            </label>
                            <select
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                value={getValue("pose")}
                                onChange={(e) => updateJob(index, { pose: e.target.value } as any)}
                            >
                                <option value="">(Empty)</option>
                                {[
                                    ...(getValue("pose") && !(resources?.poses || []).includes(getValue("pose"))
                                        ? [getValue("pose")] : []),
                                    ...(resources?.poses || [])
                                ].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Location */}
                        <div>
                            <label className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                                <MapPin className="h-3 w-3" /> Location
                            </label>
                            <select
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                value={getValue("location")}
                                onChange={(e) => updateJob(index, { location: e.target.value } as any)}
                            >
                                <option value="">(Empty)</option>
                                {[
                                    ...(getValue("location") && !(resources?.locations || []).includes(getValue("location"))
                                        ? [getValue("location")] : []),
                                    ...(resources?.locations || [])
                                ].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Lighting */}
                        <div>
                            <label className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                                <Zap className="h-3 w-3" /> Lighting
                            </label>
                            <select
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                value={getValue("lighting")}
                                onChange={(e) => updateJob(index, { lighting: e.target.value } as any)}
                            >
                                <option value="">(Empty)</option>
                                {resources?.lighting?.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Camera */}
                        <div>
                            <label className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                                <Camera className="h-3 w-3" /> Camera
                            </label>
                            <select
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                value={getValue("camera")}
                                onChange={(e) => updateJob(index, { camera: e.target.value } as any)}
                            >
                                <option value="">(Empty)</option>
                                {resources?.camera?.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Expression */}
                        <div>
                            <label className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                                <Bot className="h-3 w-3" /> Expression
                            </label>
                            <select
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                value={getValue("expression")}
                                onChange={(e) => updateJob(index, { expression: e.target.value } as any)}
                            >
                                <option value="">(Empty)</option>
                                {resources?.expressions?.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Hairstyle */}
                        <div>
                            <label className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                                <Sparkles className="h-3 w-3" /> Hairstyle
                            </label>
                            <select
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                value={getValue("hairstyle")}
                                onChange={(e) => updateJob(index, { hairstyle: e.target.value } as any)}
                            >
                                <option value="">(Empty)</option>
                                {resources?.hairstyles?.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleMagicFix}
                            disabled={uiState.isLoading || localLoading}
                            className="flex items-center gap-1.5 rounded border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            Alter Fate
                        </button>
                    </div>

                    {/* Prompt Editor */}
                    <div>
                        <textarea
                            className="h-24 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
                            value={job.prompt}
                            onChange={(e) => updateJob(index, { prompt: e.target.value })}
                            placeholder="Prompt..."
                        />
                        {!!job.ai_meta?.ai_reasoning && (
                            <p className="mt-1 text-[10px] text-slate-500 italic">
                                {String(job.ai_meta.ai_reasoning)}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
}
