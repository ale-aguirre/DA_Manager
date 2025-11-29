import React, { useState } from "react";
import { usePlannerContext } from "../../../context/PlannerContext";
import JobCard from "./JobCard";
import {
    Trash2,
    Download,
    RefreshCw,
    ExternalLink,
    Loader2
} from "lucide-react";
import { getLocalLoras, postDownloadLora, postCivitaiDownloadInfo, getLocalLoraInfo, postPlannerAnalyze } from "../../../lib/api";
import { splitPrompt, QUALITY_SET } from "../../../helpers/planner";

interface CharacterMeta {
    character_name: string;
    image_url?: string;
    download_url?: string;
    trigger_words?: string[];
    modelId?: number;
}

export default function JobQueue() {
    const {
        jobs,
        setJobs,
        metaByCharacter,
        loreByCharacter,
        setLoreByCharacter,
        updateJob,
        setUiState,
        uiState
    } = usePlannerContext();

    // Local state for async operations
    const [opStatus, setOpStatus] = useState<Record<string, string>>({});
    const [loraBusy, setLoraBusy] = useState<Record<string, boolean>>({});
    const [civitaiBusy, setCivitaiBusy] = useState<Record<string, boolean>>({});

    // Group jobs by character
    const jobsByCharacter = React.useMemo(() => {
        const groups: Record<string, { jobs: typeof jobs, indices: number[] }> = {};
        jobs.forEach((job, idx) => {
            if (!groups[job.character_name]) {
                groups[job.character_name] = { jobs: [], indices: [] };
            }
            groups[job.character_name].jobs.push(job);
            groups[job.character_name].indices.push(idx);
        });
        return groups;
    }, [jobs]);

    const handleDeleteCharacter = (character: string) => {
        if (confirm(`¿Borrar todos los jobs de ${character}?`)) {
            setJobs((prev) => prev.filter((j) => j.character_name !== character));
        }
    };



    const downloadLora = async (character: string) => {
        try {
            setLoraBusy((prev) => ({ ...prev, [character]: true }));
            const list = await getLocalLoras();
            const sanitize = (s: string) =>
                s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-.]/g, "");
            const stem = sanitize(character);

            if ((list.files || []).includes(stem)) {
                setOpStatus((prev) => ({ ...prev, [character]: "Ya descargado" }));
                setLoraBusy((prev) => ({ ...prev, [character]: false }));
                return;
            }

            const meta = metaByCharacter[character] as CharacterMeta | undefined;
            const url = meta?.download_url || "";
            if (!url) {
                setOpStatus((prev) => ({ ...prev, [character]: "Sin URL de descarga" }));
                setLoraBusy((prev) => ({ ...prev, [character]: false }));
                return;
            }

            const fname = `${stem}.safetensors`;
            await postDownloadLora(url, fname);

            try {
                await postCivitaiDownloadInfo(stem);
            } catch (e) {
                console.warn("Could not download civitai info:", e);
            }

            setOpStatus((prev) => ({ ...prev, [character]: "Descargado" }));
        } catch (e) {
            console.error(e);
            setOpStatus((prev) => ({ ...prev, [character]: "Error al descargar" }));
        } finally {
            setLoraBusy((prev) => ({ ...prev, [character]: false }));
        }
    };

    const openCivitai = async (character: string) => {
        try {
            setCivitaiBusy((prev) => ({ ...prev, [character]: true }));
            const meta = metaByCharacter[character] as CharacterMeta | undefined;
            let url = meta?.download_url;

            if (!url && meta?.modelId) {
                url = `https://civitai.com/models/${meta.modelId}`;
            }

            if (!url) {
                setOpStatus((prev) => ({ ...prev, [character]: "No URL available" }));
            } else {
                // If it is a download URL, we might want to try to find the model page URL instead if possible,
                // but for now let's just use what we have.
                // If it's a direct download, it might start a download, which is maybe not what "Ver en Civitai" implies.
                // Ideally we want the model page.
                // If we have modelId, prefer constructing the model page URL.
                if (meta?.modelId) {
                    url = `https://civitai.com/models/${meta.modelId}`;
                }
                window.open(url, "_blank");
            }
        } finally {
            setCivitaiBusy((prev) => ({ ...prev, [character]: false }));
        }
    };

    const updatePrompts = async (character: string) => {
        try {
            setOpStatus((prev) => ({ ...prev, [character]: "Actualizando prompts..." }));

            // 1. Get Triggers
            let triggers: string[] = [];
            try {
                const info = await getLocalLoraInfo(character);
                triggers = Array.isArray(info?.trainedWords) ? info.trainedWords : [];
            } catch {
                const meta = metaByCharacter[character] as CharacterMeta | undefined;
                triggers = Array.isArray(meta?.trigger_words)
                    ? (meta!.trigger_words as string[])
                    : [];
            }

            const sanitize = (s: string) => s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-.]/g, "");
            const stem = sanitize(character);
            const loraTag = `<lora:${stem}:0.8>`;
            const cleanTriggers = Array.from(new Set(triggers.map((t) => t.trim()).filter(Boolean)));

            const group = jobsByCharacter[character];
            if (!group) return;

            // 2. Update each job
            for (let i = 0; i < group.jobs.length; i++) {
                const job = group.jobs[i];
                const idx = group.indices[i];

                const tokens = splitPrompt(job.prompt);
                const tokensLower = new Set(tokens.map((t) => t.toLowerCase()));

                const rest: string[] = [];
                const quality: string[] = [];
                const extraLoras: string[] = [];

                for (const t of tokens) {
                    const low = t.toLowerCase();
                    const isCharLora = new RegExp(`^<lora:${stem}(:[0-9.]+)?>$`, "i").test(t);
                    const isAnyLora = /^<lora:[^>]+>$/i.test(t);

                    if (isCharLora) {
                        continue; // Skip character lora, added at start
                    } else if (isAnyLora) {
                        extraLoras.push(t); // Keep extra loras
                    } else if (QUALITY_SET.has(low)) {
                        quality.push(t);
                    } else {
                        rest.push(t);
                    }
                }

                const dedup: string[] = [];
                const seenLower = new Set<string>();
                const pushOne = (x: string) => {
                    const lx = x.toLowerCase();
                    if (seenLower.has(lx)) return;
                    seenLower.add(lx);
                    dedup.push(x);
                };

                // 1) Character Lora
                pushOne(loraTag);

                // 2) Triggers (only if not already in prompt)
                for (const trig of cleanTriggers) {
                    const tl = trig.toLowerCase();
                    if (!tokensLower.has(tl)) pushOne(trig);
                }

                // 3) Rest (Resources + Base Prompt)
                for (const t of rest) pushOne(t);

                // 4) Extra Loras
                for (const l of extraLoras) pushOne(l);

                // 5) Quality
                for (const q of quality) pushOne(q);

                const newPrompt = dedup.join(", ");
                if (newPrompt !== job.prompt) {
                    updateJob(idx, { prompt: newPrompt });
                }
            }
            setOpStatus((prev) => ({ ...prev, [character]: "Prompts actualizados" }));
        } catch (e) {
            console.error(e);
            setOpStatus((prev) => ({ ...prev, [character]: "Error al actualizar prompts" }));
        }
    };

    if (jobs.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/30 text-slate-500">
                <p>No jobs in queue.</p>
                <p className="text-sm">Add a character or analyze a prompt to start.</p>
            </div>
        );
    }

    const findMeta = (charName: string): CharacterMeta | undefined => {
        if (metaByCharacter[charName]) return metaByCharacter[charName] as CharacterMeta;
        const lower = charName.toLowerCase().trim();
        return Object.values(metaByCharacter).find((m) => (m as CharacterMeta).character_name?.toLowerCase().trim() === lower) as CharacterMeta | undefined;
    };

    return (
        <div className="space-y-6 pb-20">
            {Object.entries(jobsByCharacter).map(([character, { jobs: charJobs, indices }]) => {
                const meta = findMeta(character);
                return (
                    <article
                        key={character}
                        className="rounded-lg border border-slate-800 bg-slate-900 p-3"
                    >
                        <header className="pb-2 border-b border-slate-700 mb-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-base md:text-lg font-semibold text-slate-100">
                                    {character}
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-400">{charJobs.length} jobs</span>
                                    <button
                                        onClick={() => handleDeleteCharacter(character)}
                                        className="inline-flex items-center gap-1 rounded-md border border-red-700 bg-red-700/20 px-2 py-1 text-[11px] text-red-100 hover:bg-red-700/30"
                                    >
                                        <Trash2 className="h-3 w-3" /> Borrar personaje
                                    </button>
                                </div>
                            </div>
                            {/* Lore Context */}
                            <div className="mt-2 flex items-stretch gap-2 h-20">
                                <div className="flex-1 min-w-0 h-full flex flex-col">
                                    <label className="text-xs text-slate-400 font-medium mb-1">LORE CONTEXT</label>
                                    <textarea
                                        value={loreByCharacter[character] || ""}
                                        onChange={(e) => setLoreByCharacter(character, e.target.value)}
                                        placeholder="Contexto breve del encargo / personaje..."
                                        className="flex-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 focus:border-violet-500 focus:outline-none resize-none"
                                    />
                                </div>
                                <div className="flex flex-col justify-end h-full pb-0.5">
                                    <button
                                        onClick={async () => {
                                            try {
                                                setUiState({ isLoading: true });
                                                const res = await postPlannerAnalyze(character, []);
                                                if (res.lore) {
                                                    setLoreByCharacter(character, res.lore);
                                                    setUiState({ toast: { message: "Lore analizado", type: "success" } });
                                                } else {
                                                    setUiState({ toast: { message: "No se generó lore", type: "info" } });
                                                }
                                            } catch (e) {
                                                console.error(e);
                                                setUiState({ toast: { message: "Error al analizar", type: "error" } });
                                            } finally {
                                                setUiState({ isLoading: false });
                                            }
                                        }}
                                        disabled={uiState.isLoading}
                                        className="h-10 px-4 rounded-md border border-violet-600 bg-violet-600/20 text-xs font-bold text-violet-100 hover:bg-violet-600/30 transition-colors disabled:opacity-50 flex items-center justify-center"
                                        title="Analizar Lore con IA"
                                    >
                                        {uiState.isLoading ? "..." : "ANALIZAR"}
                                    </button>
                                </div>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {/* Left Column: Image & Actions */}
                            <figure className="lg:col-span-1">
                                {meta?.image_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={meta.image_url}
                                        alt={character}
                                        className="aspect-[3/4] w-full rounded-md object-cover border border-slate-800"
                                    />
                                ) : (
                                    <div className="aspect-[3/4] w-full rounded-md border border-slate-800 bg-slate-800/40 flex items-center justify-center text-xs text-slate-400">
                                        Sin imagen
                                    </div>
                                )}

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => downloadLora(character)}
                                        disabled={loraBusy[character]}
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                                    >
                                        {loraBusy[character] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                        Descargar LoRA
                                    </button>
                                    <button
                                        onClick={() => updatePrompts(character)}
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                                    >
                                        <RefreshCw className="h-3 w-3" /> Actualizar
                                    </button>
                                    <button
                                        onClick={() => openCivitai(character)}
                                        disabled={civitaiBusy[character]}
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                                    >
                                        {civitaiBusy[character] ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                                        Ver en Civitai
                                    </button>
                                </div>
                                {opStatus[character] && (
                                    <div className="mt-1 text-[11px] text-zinc-400">{opStatus[character]}</div>
                                )}
                            </figure>

                            {/* Right Column: Job List */}
                            <div className="lg:col-span-2 space-y-2">
                                {charJobs.map((job, i) => (
                                    <JobCard
                                        key={`${character}-${i}`}
                                        job={job}
                                        index={indices[i]}
                                    />
                                ))}
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
