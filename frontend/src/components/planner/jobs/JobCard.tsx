"use client";

import React, { useState } from "react";
import {
    Camera, ChevronDown, ChevronUp, Loader2, MapPin,
    Shirt, Sparkles, Trash2, User, Zap, Lock, Unlock
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
        return job[field] || (job.ai_meta && job.ai_meta[field]) || "";
    };

    const handleMagicFix = async () => {
        setLocalLoading(true);
        await magicFixJob(index);
        setLocalLoading(false);
    };

    const toggleLock = (field: string) => {
        const currentLocks = new Set(job.locked_fields || []);
        if (currentLocks.has(field)) {
            currentLocks.delete(field);
        } else {
            currentLocks.add(field);
        }
        updateJob(index, { locked_fields: Array.from(currentLocks) });
    };

    const isLocked = (field: string) => (job.locked_fields || []).includes(field);

    const renderSelect = (label: string, icon: React.ReactNode, field: keyof PlannerJob, options: string[] = []) => {
        const locked = isLocked(field as string);
        return (
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                        {icon} {label}
                    </label>
                    <button
                        onClick={() => toggleLock(field as string)}
                        className="text-slate-500 hover:text-slate-300"
                        title={locked ? "Unlock" : "Lock"}
                    >
                        {locked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 opacity-50" />}
                    </button>
                </div>
                <select
                    className={`w-full rounded border px-2 py-1 text-xs text-slate-200 ${locked ? "border-amber-900/50 bg-amber-950/20 text-amber-200/70" : "border-slate-700 bg-slate-950"
                        }`}
                    value={getValue(field)}
                    onChange={(e) => updateJob(index, { [field]: e.target.value } as any)}
                    disabled={locked}
                >
                    <option value="">(Empty)</option>
                    {/* Dynamic Options + Resource List */}
                    {[
                        ...(getValue(field) && !(options || []).includes(getValue(field))
                            ? [getValue(field)] : []),
                        ...(options || [])
                    ].map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        );
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
                        {renderSelect("Outfit", <Shirt className="h-3 w-3" />, "outfit", resources?.outfits)}
                        {renderSelect("Pose", <User className="h-3 w-3" />, "pose", resources?.poses)}
                        {renderSelect("Location", <MapPin className="h-3 w-3" />, "location", resources?.locations)}
                        {renderSelect("Lighting", <Zap className="h-3 w-3" />, "lighting", resources?.lighting)}
                        {renderSelect("Camera", <Camera className="h-3 w-3" />, "camera", resources?.camera)}
                        {renderSelect("Expression", <User className="h-3 w-3" />, "expression", resources?.expressions)}
                        {renderSelect("Hairstyle", <Sparkles className="h-3 w-3" />, "hairstyle", resources?.hairstyles)}
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
