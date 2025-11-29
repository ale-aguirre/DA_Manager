/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { PlannerJob, TechConfig, PlannerResources } from "../types/planner";
import { getPlannerResources, magicFixPrompt, getReforgeCheckpoints, getReforgeVAEs, getLocalLoras } from "../lib/api";
import { rebuildPromptWithTriplet } from "../helpers/planner";

// --- Types ---

interface PlannerState {
    jobs: PlannerJob[];
    resources: PlannerResources | null;
    techConfig: Record<string, TechConfig>; // Keyed by character name
    globalConfig: TechConfig; // Fallback/Global settings
    metaByCharacter: Record<string, unknown>;
    loreByCharacter: Record<string, string>;
    uiState: {
        isLoading: boolean;
        activeTab: string;
        toast: { message: string; type: "success" | "error" | "info" } | null;
    };
}

interface PlannerContextType extends PlannerState {
    // Actions
    setJobs: (jobs: PlannerJob[] | ((prev: PlannerJob[]) => PlannerJob[])) => void;
    addJob: (job: PlannerJob) => void;
    removeJob: (index: number) => void;
    updateJob: (index: number, updates: Partial<PlannerJob>) => void;
    setTechConfig: (character: string, config: Partial<TechConfig>) => void;
    setGlobalConfig: (config: Partial<TechConfig>) => void;
    setMetaByCharacter: (character: string, meta: unknown) => void;
    setLoreByCharacter: (character: string, lore: string) => void;
    setUiState: (updates: Partial<PlannerState["uiState"]>) => void;

    // Async Actions
    loadResources: () => Promise<void>;
    magicFixJob: (index: number) => Promise<void>;
    clearAll: () => void;
}

const PlannerContext = createContext<PlannerContextType | null>(null);

// --- Constants ---
const STORAGE_KEYS = {
    JOBS: "planner_jobs",
    TECH: "planner_tech",
    CONFIG: "planner_config",
    CONTEXT: "planner_context", // For UI state if needed
};

// --- Provider ---

export function PlannerProvider({ children }: { children: React.ReactNode }) {
    // 1. State Initialization
    const [jobs, setJobs] = useState<PlannerJob[]>([]);
    const [techConfig, setTechConfigState] = useState<Record<string, TechConfig>>({});
    const [globalConfig, setGlobalConfigState] = useState<TechConfig>({});
    const [metaByCharacter, setMetaByCharacterState] = useState<Record<string, unknown>>({});
    const [loreByCharacter, setLoreByCharacterState] = useState<Record<string, string>>({});

    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const savedJobs = localStorage.getItem(STORAGE_KEYS.JOBS);
            if (savedJobs) setJobs(JSON.parse(savedJobs));

            const savedTech = localStorage.getItem(STORAGE_KEYS.TECH);
            if (savedTech) setTechConfigState(JSON.parse(savedTech));

            const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
            const defaults = {
                positivePrompt: "masterpiece, best quality, absurdres, highres, 8k, detailed",
                negativePrompt: "low quality, worst quality, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry"
            };

            if (savedConfig) {
                try {
                    const parsed = JSON.parse(savedConfig);
                    setGlobalConfigState({
                        ...parsed,
                        positivePrompt: parsed.positivePrompt || defaults.positivePrompt,
                        negativePrompt: parsed.negativePrompt || defaults.negativePrompt
                    });
                } catch (e) {
                    setGlobalConfigState(defaults);
                }
            } else {
                setGlobalConfigState(defaults);
            }

            const savedMeta = localStorage.getItem("planner_meta");
            if (savedMeta) {
                const parsed = JSON.parse(savedMeta);
                if (Array.isArray(parsed)) {
                    // Convert Array to Record
                    const map: Record<string, unknown> = {};
                    parsed.forEach((item: any) => {
                        if (item.character_name) map[item.character_name] = item;
                    });
                    setMetaByCharacterState(map);
                } else {
                    setMetaByCharacterState(parsed);
                }
            }

            const savedLore = localStorage.getItem("planner_lore");
            if (savedLore) setLoreByCharacterState(JSON.parse(savedLore));
        } catch (e) {
            console.error("Failed to load from storage", e);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    const [resources, setResources] = useState<PlannerResources | null>(null);

    const [uiState, setUiStateState] = useState<PlannerState["uiState"]>({
        isLoading: false,
        activeTab: "queue",
        toast: null,
    });

    // 2. Sync to localStorage
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    }, [jobs, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem(STORAGE_KEYS.TECH, JSON.stringify(techConfig));
    }, [techConfig, isLoaded]);

    // Auto-cleanup: Remove techConfig for characters that no longer have jobs
    useEffect(() => {
        if (!isLoaded) return;
        const activeCharacters = new Set(jobs.map(j => j.character_name));
        const configCharacters = Object.keys(techConfig);

        // Find orphaned configs (configs for characters no longer in jobs)
        const orphaned = configCharacters.filter(char => !activeCharacters.has(char));

        if (orphaned.length > 0) {
            const cleaned = { ...techConfig };
            orphaned.forEach(char => delete cleaned[char]);
            setTechConfigState(cleaned);
        }
    }, [jobs, techConfig, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(globalConfig));
    }, [globalConfig, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem("planner_meta", JSON.stringify(metaByCharacter));
    }, [metaByCharacter, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem("planner_lore", JSON.stringify(loreByCharacter));
    }, [loreByCharacter, isLoaded]);

    // 3. Actions
    const addJob = useCallback((job: PlannerJob) => {
        setJobs((prev) => [...prev, job]);
    }, []);

    const removeJob = useCallback((index: number) => {
        setJobs((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const updateJob = useCallback((index: number, updates: Partial<PlannerJob>) => {
        setJobs((prev) => prev.map((job, i) => (i === index ? { ...job, ...updates } : job)));
    }, []);

    const setTechConfig = useCallback((character: string, config: Partial<TechConfig>) => {
        setTechConfigState((prev) => ({
            ...prev,
            [character]: { ...(prev[character] || {}), ...config },
        }));
    }, []);

    const setGlobalConfig = useCallback((config: Partial<TechConfig>) => {
        setGlobalConfigState((prev) => ({ ...prev, ...config }));
    }, []);

    const setMetaByCharacter = useCallback((character: string, meta: any) => {
        setMetaByCharacterState((prev) => ({
            ...prev,
            [character]: { ...(prev[character] || {}), ...meta }
        }));
    }, []);

    const setLoreByCharacter = useCallback((character: string, lore: string) => {
        setLoreByCharacterState((prev) => ({
            ...prev,
            [character]: lore
        }));
    }, []);

    const setUiState = useCallback((updates: Partial<PlannerState["uiState"]>) => {
        setUiStateState((prev) => ({ ...prev, ...updates }));
    }, []);

    const clearAll = useCallback(() => {
        if (confirm("¿Estás seguro de borrar todo?")) {
            setJobs([]);
            setTechConfigState({});
            setMetaByCharacterState({});
            setLoreByCharacterState({});
            localStorage.removeItem(STORAGE_KEYS.JOBS);
            localStorage.removeItem(STORAGE_KEYS.TECH);
            localStorage.removeItem("planner_meta");
            localStorage.removeItem("planner_lore");
        }
    }, []);

    // 4. Async Actions
    const loadResources = useCallback(async () => {
        try {
            const [res, ckpts, vaes, loras] = await Promise.all([
                getPlannerResources(),
                getReforgeCheckpoints(),
                getReforgeVAEs(),
                getLocalLoras()
            ]);
            setResources({
                ...res,
                checkpoints: ckpts,
                vaes: vaes,
                loras: loras.files
            });
        } catch (e) {
            console.error("Failed to load resources", e);
            setUiState({ toast: { message: "Error cargando recursos", type: "error" } });
        }
    }, [setUiState]);

    const magicFixJob = useCallback(async (index: number) => {
        const job = jobs[index];
        if (!job) return;

        setUiState({ isLoading: true });
        try {
            const fixed = await magicFixPrompt(job.prompt);

            // Rebuild the prompt string using the new values
            // We need the resources to know what to replace, but they are in state.
            // Since we are inside the provider, we have access to 'resources'.
            let newPrompt = rebuildPromptWithTriplet(
                job.prompt,
                { outfit: fixed.outfit, pose: fixed.pose, location: fixed.location },
                resources ? {
                    outfits: resources.outfits,
                    poses: resources.poses,
                    locations: resources.locations
                } : undefined
            );

            // Add extras (lighting, camera, expression, hairstyle)
            // This helper appends them if not present
            const { rebuildPromptWithExtras } = await import("../helpers/planner");
            newPrompt = rebuildPromptWithExtras(newPrompt, {
                lighting: fixed.lighting,
                camera: fixed.camera,
                expression: fixed.expression,
                hairstyle: fixed.hairstyle
            });

            updateJob(index, {
                prompt: newPrompt,
                // Apply fixed values to the job fields so they are visible in UI
                outfit: fixed.outfit,
                pose: fixed.pose,
                location: fixed.location,
                lighting: fixed.lighting,
                camera: fixed.camera,
                expression: fixed.expression,
                hairstyle: fixed.hairstyle,
                // Also store in ai_meta for reference
                ai_meta: {
                    ...job.ai_meta,
                    ...fixed
                }
            });

        } catch (e) {
            console.error("MagicFix failed", e);
            setUiState({ toast: { message: "Error en Magic Fix", type: "error" } });
        } finally {
            setUiState({ isLoading: false });
        }
    }, [jobs, updateJob, setUiState]);

    // Initial Load
    useEffect(() => {
        loadResources();
    }, [loadResources]);

    const value: PlannerContextType = {
        jobs,
        resources,
        techConfig,
        globalConfig,
        metaByCharacter,
        loreByCharacter,
        uiState,
        setJobs,
        addJob,
        removeJob,
        updateJob,
        setTechConfig,
        setGlobalConfig,
        setMetaByCharacter,
        setLoreByCharacter,
        setUiState,
        loadResources,
        magicFixJob,
        clearAll,
    };

    return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlannerContext() {
    const context = useContext(PlannerContext);
    if (!context) {
        throw new Error("usePlannerContext must be used within a PlannerProvider");
    }
    return context;
}
