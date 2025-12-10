
"use client";

import React, { useState } from "react";
import { Trash2, Play, Cog, AlertCircle } from "lucide-react";
import { usePlannerContext } from "../../context/PlannerContext";
import { TranslationProvider, useTranslation } from "../../hooks/useTranslation";
import PlannerLayout from "./layout/PlannerLayout";
import JobQueue from "./jobs/JobQueue";
import ControlPanel from "./ControlPanel";
import AIStatusBadge from "./AIStatusBadge";
import { postPlannerExecuteV2, ResourceMeta, postPlannerDraft, PlannerDraftItem } from "../../lib/api";

function PlannerDashboard() {
  const { t } = useTranslation();
  const {
    jobs,
    setJobs,
    techConfig,
    setTechConfig,
    globalConfig,
    resources,
    loadResources,
    setUiState,
    clearAll,
    uiState, // Destructure uiState
  } = usePlannerContext();

  const [activeCharacter, setActiveCharacter] = useState<string>("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Strategy State
  const [strategyMode, setStrategyMode] = useState<"Random" | "Sequence">("Random");
  const [strategyTheme, setStrategyTheme] = useState<"None" | "Christmas" | "Halloween">("None");

  // Auto-select first character if none selected
  React.useEffect(() => {
    if (!activeCharacter && jobs.length > 0) {
      setActiveCharacter(jobs[0].character_name);
    }
  }, [jobs, activeCharacter]);

  // ... (checkpoints logic omitted for brevity, unchanged)

  // ... (prompt sync logic omitted for brevity, unchanged)

  // --- Actions ---

  const handleRegenerate = async () => {
    if (jobs.length === 0) return;
    setIsRegenerating(true);
    try {
      const resourcesMeta: ResourceMeta[] = [];
      const activeCharacters = new Set(jobs.map(j => j.character_name));

      const groupConfig = Object.entries(techConfig)
        .filter(([char]) => activeCharacters.has(char))
        .map(([char, cfg]) => ({
          character_name: char,
          hires_fix: cfg.hiresFix ?? true,
          denoising_strength: cfg.denoisingStrength ?? 0.35,
          hires_steps: cfg.hiresSteps ?? 10,
          clip_skip: cfg.clipSkip ?? 2,
          upscale_by: cfg.upscaleBy ?? 1.5,
          adetailer: cfg.adetailer ?? true,
          adetailer_model: cfg.adetailerModel || "face_yolov8n.pt",
          upscaler: cfg.upscaler || (resources?.upscalers?.[0] || "R-ESRGAN 4x+"),
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
      window.location.href = "/factory";
    } catch (e) {
      console.error(e);
      setUiState({ toast: { message: "Error al iniciar generación", type: "error" } });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleGenerateDrafts = async () => {
    // Immediate scroll on click
    const workspace = document.getElementById("planner-workspace");
    if (workspace) {
      workspace.scrollIntoView({ behavior: "smooth" });
    }

    const uniqueCharacters = new Set<string>();
    if (activeCharacter) uniqueCharacters.add(activeCharacter);
    jobs.forEach(j => uniqueCharacters.add(j.character_name));

    if (uniqueCharacters.size === 0) return;

    const masterConfig = activeCharacter ? techConfig[activeCharacter] : {};
    const masterBatchCount = masterConfig?.batch_count || 1;

    setUiState({ isLoading: true });
    try {
      // 1. Prepare items to generate (Force regeneration logic)
      const itemsToAdd: PlannerDraftItem[] = [];

      let newJobs = [...jobs];

      for (const charName of Array.from(uniqueCharacters)) {
        if (charName !== activeCharacter) {
          setTechConfig(charName, { batch_count: masterBatchCount });
        }
        newJobs = newJobs.filter(j => j.character_name !== charName);
        itemsToAdd.push({
          character_name: charName,
          trigger_words: [],
          batch_count: masterBatchCount,
          theme: strategyTheme !== "None" ? strategyTheme : undefined,
          // Pass Dynamic Config
          global_positive: globalConfig.positivePrompt,
          global_negative: globalConfig.negativePrompt
        });
      }

      // 2. Call API
      if (itemsToAdd.length > 0) {
        const res = await postPlannerDraft(itemsToAdd, undefined, true);
        if (res.jobs && res.jobs.length > 0) {
          newJobs = [...newJobs, ...res.jobs];
        }
      }

      setJobs(newJobs);
      setUiState({ toast: { message: `Plan creado: ${itemsToAdd.length} personajes, ${masterBatchCount} imgs c/u`, type: "success" } });

    } catch (e) {
      console.error(e);
      setUiState({ toast: { message: "Error creando drafts", type: "error" } });
    } finally {
      setUiState({ isLoading: false });
    }
  };

  // --- Technical Panel Handlers ---
  const handleSetCheckpoint = async (title: string) => {
    if (activeCharacter) {
      setTechConfig(activeCharacter, { checkpoint: title });
      localStorage.setItem("preferred_checkpoint", title);
    }
  };
  const handleSetVae = (value: string) => { if (activeCharacter) setTechConfig(activeCharacter, { vae: value }); };
  const handleSetClipSkip = (value: number) => { if (activeCharacter) setTechConfig(activeCharacter, { clipSkip: value }); };

  return (
    <PlannerLayout>
      <div className="flex h-full flex-col min-w-0 overflow-y-auto bg-slate-950">
        <div className="p-4 space-y-8 max-w-6xl mx-auto w-full">

          {/* 1. Header Area: Control Panel (Strategy/Tech) */}
          <div data-section="section-planner-header" className="space-y-4">
            {/* Main Controls: Strategy & Tech */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <ControlPanel
                activeCharacter={activeCharacter}
                isRegenerating={uiState.isLoading} // Use uiState.isLoading for draft button loader
                onRegenerateDrafts={handleGenerateDrafts}
                reforgeUpscalers={resources?.upscalers || []}
                refreshingUpscalers={false}
                upscalerVersion={0}
                refreshUpscalers={loadResources}
                strategyMode={strategyMode}
                setStrategyMode={setStrategyMode}
                strategyTheme={strategyTheme}
                setStrategyTheme={setStrategyTheme}
                checkpoints={resources?.checkpoints || []}
                vaes={resources?.vaes || []}
                checkpointVersion={0}
                onSetCheckpoint={handleSetCheckpoint}
                onSetVae={handleSetVae}
                onSetClipSkip={handleSetClipSkip}
                onRefreshAll={loadResources}
              />
            </section>

            {/* 2. Workspace: Job Queue */}
            <div data-section="section-planner-workspace" id="planner-workspace" className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                    MESA DE TRABAJO (DRAFTS)
                  </h5>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    {jobs.length}
                  </span>
                </div>
                <AIStatusBadge />
              </div>

              <section className="min-h-[200px]">
                <JobQueue />
              </section>
            </div>

            {/* 3. Production Controls */}
            <div data-section="section-production-controls" className="sticky bottom-4 z-10 mx-auto w-full max-w-2xl">
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating || jobs.length === 0}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 p-4 text-white shadow-2xl transition-all hover:scale-[1.02] hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isRegenerating ? (
                  <>
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span className="font-bold tracking-widest text-lg">PROCESANDO...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-6 w-6 fill-current" />
                    <span className="text-lg font-bold tracking-widest">{t("planner.production_btn")}</span>
                  </>
                )}
                {/* Shine */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
              </button>
            </div>

            {/* Debug Panel */}
            <section className="mt-12 border-t border-slate-800 pt-4">
              <h3 className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debug Zone</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetModal(true)}
                  className="flex items-center gap-2 rounded border border-red-900/30 bg-red-900/10 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20"
                >
                  <Trash2 className="h-3 w-3" /> Reset & Radar
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

        {showPayloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
              {/* ... Payload content same as before ... */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-200">Payload Inspector</h3>
                <button onClick={() => setShowPayloadModal(false)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                  <Trash2 className="h-5 w-5 rotate-45" />
                </button>
              </div>
              <div className="relative max-h-[60vh] overflow-auto rounded-lg border border-slate-900 bg-slate-900/50 p-4">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify({
                    jobs,
                    group_config: Object.entries(techConfig).map(([char, cfg]) => ({ character_name: char, ...cfg }))
                  }, null, 2)}
                </pre>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowPayloadModal(false)} className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">Cerrar</button>
              </div>
            </div>
          </div>
        )}



        {/* Reset Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-[90vw] max-w-md rounded-xl border border-red-900/50 bg-slate-950 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3 text-red-400">
                <AlertCircle className="h-6 w-6" />
                <h3 className="text-lg font-bold">¿Reiniciar Todo?</h3>
              </div>

              <p className="mb-6 text-sm text-zinc-300 leading-relaxed">
                Esta acción eliminará <strong>todos los trabajos actuales</strong> y la configuración del planificador.
                <br /><br />
                Serás redirigido al <strong>Radar</strong> para comenzar una nueva selección.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-zinc-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    clearAll();
                    window.location.href = "/radar";
                  }}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                  Confirmar Reinicio
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </PlannerLayout>
  );
}

export default function PlannerView() {
  return (
    <TranslationProvider>
      <PlannerDashboard />
    </TranslationProvider>
  );
}
