"use client";

import React from "react";
import { usePlannerContext } from "../../context/PlannerContext";
import TechnicalModelPanel from "./TechnicalModelPanel";
import PromptsEditor from "./PromptsEditor";

interface TechnicalPanelProps {
    activeCharacter: string;
    checkpoints: string[];
    vaes: string[];
    checkpointVersion: number;
    onSetCheckpoint: (title: string) => Promise<void> | void;
    onSetVae: (value: string) => void;
    onSetClipSkip: (value: number) => void;
    onRefreshAll: () => Promise<void> | void;
}

export default function TechnicalPanel(props: TechnicalPanelProps) {
    const { techConfig, globalConfig, setGlobalConfig } = usePlannerContext();

    const {
        activeCharacter,
        checkpoints,
        vaes,
        checkpointVersion,
        onSetCheckpoint,
        onSetVae,
        onSetClipSkip,
        onRefreshAll,
    } = props;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Model Core */}
            <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Model Core
                </h3>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <TechnicalModelPanel
                        activeCharacter={activeCharacter}
                        checkpoints={checkpoints}
                        vaes={vaes}
                        checkpointVersion={checkpointVersion}
                        techConfigByCharacter={techConfig}
                        globalConfig={globalConfig}
                        onSetCheckpoint={onSetCheckpoint}
                        onSetVae={onSetVae}
                        onSetClipSkip={onSetClipSkip}
                        onRefreshAll={onRefreshAll}
                    />
                </div>
            </section>

            {/* Separator */}
            <div className="border-t border-slate-800" />

            {/* Global Prompts */}
            <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Global Prompts
                </h3>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <PromptsEditor
                        basePrompt={globalConfig.positivePrompt || ""}
                        negativePrompt={globalConfig.negativePrompt || ""}
                        onChangeBase={(v: string) => setGlobalConfig({ positivePrompt: v })}
                        onChangeNegative={(v: string) => setGlobalConfig({ negativePrompt: v })}
                    />
                </div>
            </section>
        </div>
    );
}
