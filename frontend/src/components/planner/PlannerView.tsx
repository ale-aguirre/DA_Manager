/* eslint-disable prefer-const */
"use client";

import React, { useState } from "react";
import { Trash2, Play, Cog } from "lucide-react";
import { usePlannerContext } from "../../context/PlannerContext";
import PlannerLayout from "./layout/PlannerLayout";
import JobQueue from "./jobs/JobQueue";
import ControlPanel from "./ControlPanel";
import TechnicalModelPanel from "./TechnicalModelPanel";
import PromptsEditor from "./PromptsEditor";
import { postPlannerExecuteV2, ResourceMeta } from "../../lib/api";

export default function PlannerView() {
  const {
    jobs,
    setJobs,
    techConfig,
    setTechConfig,
    globalConfig,
    setGlobalConfig,
    resources,
    loadResources,
    setUiState,
    clearAll
  } = usePlannerContext();

  const [activeCharacter, setActiveCharacter] = useState<string>("");
  const [paramTab, setParamTab] = useState<"generation" | "hires" | "adetailer">("generation");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showPayloadModal, setShowPayloadModal] = useState(false);

  // Auto-select first character if none selected
  React.useEffect(() => {
    if (!activeCharacter && jobs.length > 0) {
      setActiveCharacter(jobs[0].character_name);
    }
  }, [jobs, activeCharacter]);

  // --- Checkpoint & Tech Defaults Logic ---
  React.useEffect(() => {
    if (!activeCharacter || !resources?.checkpoints) return;

    const currentConfig = techConfig[activeCharacter] || {};
    let updates: any = {};
    let changed = false;

    // 1. Checkpoint
    if (!currentConfig.checkpoint) {
      // Try from localStorage first
      const savedCkpt = localStorage.getItem("preferred_checkpoint");
      if (savedCkpt && resources.checkpoints.includes(savedCkpt)) {
        updates.checkpoint = savedCkpt;
        changed = true;
      } else {
        // Try preferred default
        const preferred = "waiilustriuousSDXL"; // Partial match check might be needed if extension varies
        const found = resources.checkpoints.find(c => c.includes(preferred));
        if (found) {
          updates.checkpoint = found;
          changed = true;
        } else if (resources.checkpoints.length > 0) {
          updates.checkpoint = resources.checkpoints[0];
          changed = true;
        }
      }
    }

    // 2. VAE
    if (!currentConfig.vae) {
      updates.vae = "Automatic";
      changed = true;
    }

    // 3. Clip Skip
    if (!currentConfig.clipSkip) {
      updates.clipSkip = 2;
      changed = true;
    }

    if (changed) {
      setTechConfig(activeCharacter, updates);
      // If we set a checkpoint, save it as preferred
      if (updates.checkpoint) {
        localStorage.setItem("preferred_checkpoint", updates.checkpoint);
      }
    }
  }, [activeCharacter, resources, techConfig, setTechConfig]);

  // --- Prompt Sync Logic ---
  const prevGlobalPromptRef = React.useRef(globalConfig.positivePrompt || "");

  React.useEffect(() => {
    const newGlobal = (globalConfig.positivePrompt || "").trim();
    const oldGlobal = (prevGlobalPromptRef.current || "").trim();

    if (newGlobal !== oldGlobal) {
      setJobs((prevJobs) =>
        prevJobs.map((job) => {
          let text = job.prompt || "";

          // 1. Remove old global prompt if present
          if (oldGlobal && text.includes(oldGlobal)) {
            // Attempt to remove it cleanly
            text = text.replace(oldGlobal, "");
            // Cleanup double commas and trailing/leading commas
            text = text.replace(/,\s*,/g, ",").replace(/^,/, "").replace(/,$/, "").trim();
          }

          // 2. Append new global prompt
          if (newGlobal) {
            // Check if it's already there to avoid duplication
            if (!text.includes(newGlobal)) {
              text = text ? `${text}, ${newGlobal}` : newGlobal;
            }
          }

          return { ...job, prompt: text };
        })
      );
      prevGlobalPromptRef.current = newGlobal;
    }
  }, [globalConfig.positivePrompt, setJobs]);

  // --- Negative Prompt Sync Logic ---
  const prevGlobalNegativeRef = React.useRef(globalConfig.negativePrompt || "");

  React.useEffect(() => {
    const newGlobal = (globalConfig.negativePrompt || "").trim();
    const oldGlobal = (prevGlobalNegativeRef.current || "").trim();

    if (newGlobal !== oldGlobal) {
      setJobs((prevJobs) =>
        prevJobs.map((job) => {
          let text = job.negative_prompt || "";

          // 1. Remove old global negative if present
          if (oldGlobal && text.includes(oldGlobal)) {
            text = text.replace(oldGlobal, "");
            text = text.replace(/,\s*,/g, ",").replace(/^,/, "").replace(/,$/, "").trim();
          }

          // 2. Append new global negative
          if (newGlobal) {
            if (!text.includes(newGlobal)) {
              text = text ? `${text}, ${newGlobal}` : newGlobal;
            }
          }

          return { ...job, negative_prompt: text };
        })
      );
      prevGlobalNegativeRef.current = newGlobal;
    }
  }, [globalConfig.negativePrompt, setJobs]);

  // --- Actions ---

  const handleRegenerate = async () => {
    if (jobs.length === 0) return;
    setIsRegenerating(true);
    try {
      const resourcesMeta: ResourceMeta[] = [];

      // Get unique character names from current jobs
      const activeCharacters = new Set(jobs.map(j => j.character_name));

      // Only include config for characters that have active jobs
      const groupConfig = Object.entries(techConfig)
        .filter(([char]) => activeCharacters.has(char))
        .map(([char, cfg]) => ({
          character_name: char,
          // Map camelCase to snake_case for backend
          hires_fix: cfg.hiresFix ?? true,
          denoising_strength: cfg.denoisingStrength ?? 0.35,
          hires_steps: cfg.hiresSteps ?? 10,
          clip_skip: cfg.clipSkip ?? 2,
          upscale_by: cfg.upscaleBy ?? 1.5,
          // Direct mapping
          adetailer: cfg.adetailer ?? true,
          adetailer_model: cfg.adetailerModel || "face_yolov8n.pt",
          upscaler: cfg.upscaler || "4x-UltraSharp",
          steps: cfg.steps ?? 28,
          cfg_scale: cfg.cfg ?? 7,
          width: cfg.width ?? 832,
          height: cfg.height ?? 1216,
          sampler: cfg.sampler,
          scheduler: cfg.schedulerType,
          checkpoint: cfg.checkpoint,
          vae: cfg.vae,
          extra_loras: cfg.extraLoras,
          batch_size: cfg.batch_size,
          batch_count: cfg.batch_count,
        }));

      await postPlannerExecuteV2(jobs, resourcesMeta, groupConfig);
      setUiState({ toast: { message: "Generación iniciada", type: "success" } });
      // Redirect to Factory to see progress
      window.location.href = "/factory";
    } catch (e) {
      console.error(e);
      setUiState({ toast: { message: "Error al iniciar generación", type: "error" } });
    } finally {
      setIsRegenerating(false);
    }
  };

  // --- Technical Panel Handlers ---
  const handleSetCheckpoint = async (title: string) => {
    if (activeCharacter) {
      setTechConfig(activeCharacter, { checkpoint: title });
      localStorage.setItem("preferred_checkpoint", title);
    } else {
      // Fallback to global if no character selected (or apply to all?)
      // For now, let's assume it applies to the active character as per the component design
    }
  };

  const handleSetVae = (value: string) => {
    if (activeCharacter) setTechConfig(activeCharacter, { vae: value });
  };

  const handleSetClipSkip = (value: number) => {
    if (activeCharacter) setTechConfig(activeCharacter, { clipSkip: value });
  };

  const handleToggleExtraLora = (loraName: string) => {
    if (!activeCharacter) return;
    const current = techConfig[activeCharacter]?.extraLoras || [];
    const exists = current.includes(loraName);
    const next = exists ? current.filter(l => l !== loraName) : [...current, loraName];
    setTechConfig(activeCharacter, { extraLoras: next });
  };

  return (
    <PlannerLayout>
      <div className="flex h-full flex-col min-w-0 overflow-y-auto bg-slate-950">
        <div className="p-4 space-y-6 max-w-6xl mx-auto w-full">

          {/* 1. Technical Panel */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <TechnicalModelPanel
              activeCharacter={activeCharacter}
              checkpoints={resources?.checkpoints || []}
              vaes={resources?.vaes || []}
              availableLoras={resources?.loras || []}
              checkpointVersion={0}
              techConfigByCharacter={techConfig}
              onSetCheckpoint={handleSetCheckpoint}
              onSetVae={handleSetVae}
              onSetClipSkip={handleSetClipSkip}
              onToggleExtraLora={handleToggleExtraLora}
              onRefreshAll={loadResources}
            />
          </section>

          {/* 2. Global Prompts & Generate Actions */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_200px]">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <PromptsEditor
                basePrompt={globalConfig.positivePrompt || ""}
                negativePrompt={globalConfig.negativePrompt || ""}
                onChangeBase={(v: string) => setGlobalConfig({ positivePrompt: v })}
                onChangeNegative={(v: string) => setGlobalConfig({ negativePrompt: v })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating || jobs.length === 0}
                className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-green-600 p-4 text-green-100 transition-all hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-green-900/20"
              >
                {isRegenerating ? (
                  <>
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
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
                <button className="rounded border border-slate-800 bg-slate-900 py-2 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                  Guardar Positivo
                </button>
                <button className="rounded border border-slate-800 bg-slate-900 py-2 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                  Guardar Negativo
                </button>
                <button className="rounded border border-slate-800 bg-slate-900 py-2 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                  Cargar Positivo
                </button>
                <button className="rounded border border-slate-800 bg-slate-900 py-2 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                  Cargar Negativo
                </button>
              </div>
            </div>
          </section>

          {/* 3. Control Panel (Configuration) */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <ControlPanel
              activeCharacter={activeCharacter}
              paramTab={paramTab}
              setParamTab={setParamTab}
              isRegenerating={isRegenerating}
              onRegenerateDrafts={handleRegenerate}
              reforgeUpscalers={resources?.upscalers || []}
              refreshingUpscalers={false}
              upscalerVersion={0}
              refreshUpscalers={loadResources}
            />
          </section>
          {/* 4. Job Queue */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">Production Queue</h3>
            <JobQueue />
          </section>

          {/* 5. Debug Panel */}
          <section className="mt-8 border-t border-slate-800 pt-4">
            <h3 className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debug Zone</h3>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                className="flex items-center gap-2 rounded border border-red-900/30 bg-red-900/10 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20"
              >
                <Trash2 className="h-3 w-3" /> Reset Cache
              </button>
              <button
                onClick={() => setShowPayloadModal(true)}
                className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
              >
                <Cog className="h-3 w-3" /> Show Payload
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* Payload Modal */}
      {showPayloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-200">Payload Inspector</h3>
              <button
                onClick={() => setShowPayloadModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <Trash2 className="h-5 w-5 rotate-45" /> {/* Close icon substitute */}
              </button>
            </div>
            <div className="relative max-h-[60vh] overflow-auto rounded-lg border border-slate-900 bg-slate-900/50 p-4">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify({
                  jobs,
                  resources_meta: [],
                  group_config: Object.entries(techConfig).map(([char, cfg]) => ({
                    character_name: char,
                    hires_fix: cfg.hiresFix ?? true,
                    denoising_strength: cfg.denoisingStrength ?? 0.35,
                    hires_steps: cfg.hiresSteps ?? 10,
                    clip_skip: cfg.clipSkip ?? 2,
                    upscale_by: cfg.upscaleBy ?? 1.5,
                    adetailer: cfg.adetailer ?? true,
                    adetailer_model: cfg.adetailerModel || "face_yolov8n.pt",
                    upscaler: cfg.upscaler || "4x-UltraSharp",
                    steps: cfg.steps ?? 28,
                    cfg_scale: cfg.cfg ?? 7,
                    width: cfg.width ?? 832,
                    height: cfg.height ?? 1216,
                    sampler: cfg.sampler,
                    scheduler: cfg.schedulerType,
                    checkpoint: cfg.checkpoint,
                    vae: cfg.vae,
                    extra_loras: cfg.extraLoras,
                    batch_size: cfg.batch_size,
                    batch_count: cfg.batch_count,
                  }))
                }, null, 2)}
              </pre>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  const payload = JSON.stringify({
                    jobs,
                    resources_meta: [],
                    group_config: Object.entries(techConfig).map(([char, cfg]) => ({
                      character_name: char,
                      ...cfg
                    }))
                  }, null, 2);
                  navigator.clipboard.writeText(payload);
                  setUiState({ toast: { message: "Copiado al portapapeles", type: "success" } });
                  setShowPayloadModal(false);
                }}
                className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Copiar y Cerrar
              </button>
              <button
                onClick={() => setShowPayloadModal(false)}
                className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </PlannerLayout>
  );
}
