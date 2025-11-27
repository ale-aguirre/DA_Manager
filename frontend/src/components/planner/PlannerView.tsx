"use client";
import React from "react";
import { Trash2, Play, Radar, Search, Cog } from "lucide-react";
import type { PlannerJob } from "../../types/planner";
import {
  magicFixPrompt,
  getPlannerResources,
  postPlannerAnalyze,
  getReforgeCheckpoints,
  postReforgeSetCheckpoint,
  getReforgeOptions,
  postPlannerDraft,
  getLocalLoraInfo,
  getReforgeVAEs,
  getReforgeUpscalers,
  getLocalLoras,
} from "../../lib/api";
import { useRouter } from "next/navigation";
import type { ResourceMeta } from "../../types/planner";
import PromptsEditor from "./PromptsEditor";
import TechnicalModelPanel from "./TechnicalModelPanel";
import ProductionQueue from "./ProductionQueue";
import ControlPanel from "./ControlPanel";
import {
  QUALITY_SET,
  splitPrompt,
  extractTriplet,
  extractExtras,
  rebuildPromptWithExtras,
  rebuildPromptWithTriplet,
  mergeNegative,
  handleSetCheckpoint,
  handleRefreshTech,
  refreshUpscalersHelper,
  refreshVaesHelper,
  refreshCheckpointsHelper,
  mergePositive,
} from "../../helpers/planner";

export default function PlannerView() {
  const [jobs, setJobs] = React.useState<PlannerJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [activeCharacter, setActiveCharacter] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState<Set<number>>(new Set());
  const [resources, setResources] = React.useState<{
    outfits: string[];
    poses: string[];
    locations: string[];
    lighting?: string[];
    camera?: string[];
    expressions?: string[];
    hairstyles?: string[];
    upscalers?: string[];
  } | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [metaByCharacter, setMetaByCharacter] = React.useState<
    Record<
      string,
      { image_url?: string; trigger_words?: string[]; download_url?: string }
    >
  >({});
  const [aiReasoningByCharacter, setAiReasoningByCharacter] = React.useState<
    Record<string, string>
  >({});
  const [aiReasoningByJob, setAiReasoningByJob] = React.useState<
    Record<number, string>
  >({});
  const router = useRouter();
  const [loreByCharacter, setLoreByCharacter] = React.useState<
    Record<string, string>
  >({});

  const [allowExtraLorasByCharacter] = React.useState<Record<string, boolean>>(
    () => {
      try {
        const raw = localStorage.getItem("planner_allow_extra_loras");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  );
  const [intensityBusy, setIntensityBusy] = React.useState<Set<number>>(
    new Set()
  );
  const [configByCharacter, setConfigByCharacter] = React.useState<
    Record<string, { hiresFix: boolean; denoising: number; outputPath: string }>
  >({});
  const [techConfigByCharacter, setTechConfigByCharacter] = React.useState<
    Record<
      string,
      {
        steps?: number;
        cfg?: number;
        sampler?: string;
        schedulerType?: string;
        seed?: number;
        hiresFix?: boolean;
        upscaleBy?: number;
        upscaler?: string;
        checkpoint?: string;
        extraLoras?: string[];
        extraLorasWeighted?: { name: string; weight: number }[];
        hiresSteps?: number;
        batch_size?: number;
        batch_count?: number;
        adetailer?: boolean;
        adetailerModel?: string;
        vae?: string;
        clipSkip?: number;
        negativePrompt?: string;
        width?: number;
        height?: number;
      }
    >
  >({});
  const [plannerContext, setPlannerContext] = React.useState<
    Record<
      string,
      {
        base_prompt?: string;
        recommended_params?: { cfg: number; steps: number; sampler: string };
        reference_images?: Array<{
          url: string;
          meta: Record<string, unknown>;
        }>;
      }
    >
  >({});
  const [checkpoints, setCheckpoints] = React.useState<string[]>([]);
  const [checkpointVersion, setCheckpointVersion] = React.useState(0);

  const [reforgeUpscalers, setReforgeUpscalers] = React.useState<string[]>([]);
  const [refreshingUpscalers, setRefreshingUpscalers] = React.useState(false);
  const [upscalerVersion, setUpscalerVersion] = React.useState(0);
  const [vaes, setVaes] = React.useState<string[]>([]);
  const [globalCheckpoint, setGlobalCheckpoint] = React.useState<string | null>(
    null
  );
  const [localLoras, setLocalLoras] = React.useState<string[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const API_BASE =
          process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

        const res = await fetch(`${API_BASE}/local/loras`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.files)) {
            setLocalLoras(data.files);
          }
        }
      } catch (e) {
        console.warn("❌ Planner: Excepción cargando LoRAs locales:", e);
      }
    })();
  }, []);

  const [reforgeOptions, setReforgeOptionsState] = React.useState<{
    current_vae: string;
    current_clip_skip: number;
  } | null>(null);
  const [paramTab, setParamTab] = React.useState<
    "generation" | "hires" | "adetailer"
  >("generation");

  const [presetFiles, setPresetFiles] = React.useState<string[]>([]);
  const [openPresetMenu, setOpenPresetMenu] = React.useState<
    null | "pos" | "neg"
  >(null);
  const [savePresetKind, setSavePresetKind] = React.useState<
    null | "pos" | "neg"
  >(null);
  const [savePresetName, setSavePresetName] = React.useState("");
  const [savingPreset, setSavingPreset] = React.useState(false);

  const [dryRunOpen, setDryRunOpen] = React.useState(false);
  const [dryRunPayload, setDryRunPayload] = React.useState<string>("");

  const stripLoraTags = (text: string) => text.replace(/<lora:[^>]+>(?::[\d.]+)?/gi, "").replace(/,\s*,/g, ",").trim();

  const onRegenerateDrafts = async () => {
    const characterNames = Object.keys(metaByCharacter);
    if (characterNames.length === 0) return;
    const count =
      techConfigByCharacter[activeCharacter || characterNames[0]]
        ?.batch_count ?? 1;
    const allowExtra =
      allowExtraLorasByCharacter[activeCharacter || characterNames[0]] ?? true;
    const payload = characterNames.map((name) => ({
      character_name: name,
      trigger_words: metaByCharacter[name]?.trigger_words || [name],
      batch_count: count,
    }));
    try {
      setIsRegenerating(true);
      const res = await postPlannerDraft(payload, count, allowExtra);
      setJobs((prev) => {
        const blocked = new Set(payload.map((p) => p.character_name));
        const others = prev.filter((j) => !blocked.has(j.character_name));
        const next = [...others, ...res.jobs];
        try {
          localStorage.setItem("planner_jobs", JSON.stringify(next));
        } catch { }
        return next;
      });
      try {
        const draftsList: unknown[] = Array.isArray(res.drafts)
          ? (res.drafts as unknown[])
          : [];
        setPlannerContext((prev) => {
          const next = { ...prev } as typeof prev;
          draftsList.forEach((d) => {
            const item = d as {
              character?: string;
              base_prompt?: string;
              recommended_params?: {
                cfg: number;
                steps: number;
                sampler: string;
              };
              reference_images?: Array<{
                url: string;
                meta: Record<string, unknown>;
              }>;
            };
            const key = item.character;
            if (key) {
              next[key] = {
                base_prompt: stripLoraTags(item.base_prompt || ""),
                recommended_params: item.recommended_params,
                reference_images: item.reference_images,
              } as {
                base_prompt?: string;
                recommended_params?: {
                  cfg: number;
                  steps: number;
                  sampler: string;
                };
                reference_images?: Array<{
                  url: string;
                  meta: Record<string, unknown>;
                }>;
              };
            }
          });
          try {
            localStorage.setItem("planner_context", JSON.stringify(next));
          } catch { }
          return next;
        });
      } catch {
        void 0;
      }
    } catch (e) {
      console.error("Regeneración fallida", e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const setTechConfig = (
    character: string | null,
    partial: Partial<{
      steps: number;
      cfg: number;
      sampler: string;
      schedulerType: string;
      seed: number;
      hiresFix: boolean;
      upscaleBy: number;
      upscaler: string;
      checkpoint: string;
      extraLoras: string[];
      extraLorasWeighted: { name: string; weight: number }[];
      hiresSteps: number;
      batch_size: number;
      batch_count: number;
      adetailer: boolean;
      adetailerModel: string;
      vae: string;
      clipSkip: number;
      negativePrompt: string;
      width: number;
      height: number;
    }>
  ) => {
    if (!character) return;
    setTechConfigByCharacter((prev) => {
      const next = { ...prev, [character]: { ...prev[character], ...partial } };
      try {
        localStorage.setItem("planner_tech", JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  };

  // --- VIGILANTE DE SINCRONIZACIÓN GLOBAL ---
  // Cuando el usuario escribe en el Prompt Global, actualizamos todos los jobs en tiempo real.
  React.useEffect(() => {
    if (!activeCharacter) return;

    const globalPrompt = plannerContext[activeCharacter]?.base_prompt || "";

    setJobs(prevJobs => {
      // Solo actualizamos los jobs del personaje activo
      const updated = prevJobs.map(job => {
        if (job.character_name !== activeCharacter) return job;

        // Desarmamos el prompt actual para preservar la escena
        const triplet = extractTriplet(job.prompt, resources || undefined);
        const extras = extractExtras(job.prompt, resources || undefined);

        const sanitize = (s: string) => s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/g, "");
        const loraTag = `<lora:${sanitize(job.character_name)}:0.8>`;

        // Rescatar trigger del prompt actual (asumimos que es el segundo elemento si existe)
        // O mejor, usar el mismo trigger que ya tiene el job si podemos detectarlo.
        // Simplificación: Usar el nombre simple si no tenemos info a mano.
        const trigger = metaByCharacter[job.character_name]?.trigger_words?.[0] || job.character_name.split(" - ")[0];

        const scenePart = [triplet.outfit, triplet.pose, triplet.location].filter(Boolean).join(", ");
        const extrasPart = [extras.lighting, extras.camera, extras.expression].filter(Boolean).join(", ");
        const newPrompt = [loraTag, trigger, globalPrompt, scenePart, extrasPart]
          .map(s => s.trim())
          .filter(Boolean)
          .join(", ");

        return { ...job, prompt: newPrompt };
      });

      // Solo actualizamos si hubo cambios reales para evitar render infinite loops
      const hasChanged = JSON.stringify(updated) !== JSON.stringify(prevJobs);
      return hasChanged ? updated : prevJobs;
    });

  }, [plannerContext, activeCharacter, resources, metaByCharacter]); // Dependencias: Contexto (Global) y Personaje

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("planner_checkpoint_global");
      setGlobalCheckpoint(raw && raw.trim() ? raw : null);
    } catch {
      void 0;
    }
  }, []);

  const refreshPresets = async () => {
    try {
      const { files } = await (await import("../../lib/api")).getPresetFiles();
      setPresetFiles(files);
    } catch {
      setPresetFiles([]);
    }
  };



  React.useEffect(() => {
    // Abrir prompt por defecto para todos los jobs existentes
    const s = new Set<number>();
    for (let i = 0; i < jobs.length; i++) s.add(i);
    setShowDetails(s);
  }, [jobs.length]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("planner_jobs");
      if (raw) {
        const parsed = JSON.parse(raw) as PlannerJob[];
        setJobs(parsed);
      }
    } catch {
      console.error("Failed to load planner_jobs");
    }
  }, []);

  // Aplicar defaults
  React.useEffect(() => {
    if (!activeCharacter) return;
    const tech = techConfigByCharacter[activeCharacter] || {};
    let preset: Record<string, unknown> | null = null;
    try {
      const raw = localStorage.getItem("planner_preset_global");
      if (raw) preset = JSON.parse(raw);
    } catch {
      void 0;
    }
    const patchTech: Partial<{
      steps: number;
      cfg: number;
      negativePrompt: string;
      batch_size: number;
      batch_count: number;
      hiresFix: boolean;
      adetailer: boolean;
      upscaleBy: number;
      hiresSteps: number;
      upscaler: string;
      width: number;
      height: number;
    }> = {};
    const neg = (tech.negativePrompt ?? "").trim();
    if (!neg) {
      const presetNeg =
        preset &&
          typeof preset.negativePrompt === "string" &&
          preset.negativePrompt.trim()
          ? preset.negativePrompt.trim()
          : "bad quality, worst quality, worst detail, sketch, censor";
      patchTech.negativePrompt = presetNeg;
    }
    if (typeof tech.steps !== "number") {
      patchTech.steps =
        preset && typeof preset.steps === "number" ? preset.steps : 30;
    }
    if (typeof tech.cfg !== "number") {
      patchTech.cfg = preset && typeof preset.cfg === "number" ? preset.cfg : 7;
    }
    if (typeof tech.batch_size !== "number") {
      patchTech.batch_size =
        preset && typeof preset.batch_size === "number" ? preset.batch_size : 1;
    }
    if (typeof tech.batch_count !== "number") {
      patchTech.batch_count =
        preset && typeof preset.batch_count === "number"
          ? preset.batch_count
          : 1;
    }
    if (typeof tech.hiresFix !== "boolean") {
      patchTech.hiresFix =
        preset && typeof preset.hiresFix === "boolean" ? preset.hiresFix : true;
    }
    if (typeof tech.adetailer !== "boolean") {
      patchTech.adetailer =
        preset && typeof preset.adetailer === "boolean"
          ? preset.adetailer
          : true;
    }
    if (typeof tech.upscaleBy !== "number") {
      const p = preset as { upscaleBy?: number } | null;
      patchTech.upscaleBy =
        typeof p?.upscaleBy === "number" ? p!.upscaleBy! : 1.5;
    }
    if (typeof tech.hiresSteps !== "number") {
      const p = preset as { hiresSteps?: number } | null;
      patchTech.hiresSteps =
        typeof p?.hiresSteps === "number" ? p!.hiresSteps! : 10;
    }
    if (typeof tech.width !== "number") {
      patchTech.width = 832;
    }
    if (typeof tech.height !== "number") {
      patchTech.height = 1216;
    }
    if ((tech.upscaler ?? "").trim().length === 0) {
      patchTech.upscaler =
        preset && typeof preset.upscaler === "string" ? preset.upscaler : "";
    }
    if (Object.keys(patchTech).length > 0) {
      setTechConfig(activeCharacter, patchTech);
    }
    // Denoise vive en planner_config, no en tech
    const cfg = configByCharacter[activeCharacter] || {};
    if (typeof cfg.denoising !== "number") {
      const nextDenoise =
        preset && typeof preset.denoising === "number"
          ? preset.denoising
          : 0.35;
      setConfigByCharacter((prev) => {
        const next = {
          ...prev,
          [activeCharacter]: {
            ...(prev[activeCharacter] || {
              hiresFix: true,
              denoising: 0.35,
              outputPath: `OUTPUTS_DIR/{Character}/`,
            }),
            denoising: nextDenoise,
          },
        };
        try {
          localStorage.setItem("planner_config", JSON.stringify(next));
        } catch {
          void 0;
        }
        return next;
      });
    }
  }, [activeCharacter, configByCharacter, techConfigByCharacter]);

  // Cargar configuración técnica (incluye Prompt Negativo) desde localStorage
  React.useEffect(() => {
    try {
      const rawTech = localStorage.getItem("planner_tech");
      if (!rawTech) return;
      const parsed = JSON.parse(rawTech) as Record<
        string,
        {
          steps?: number;
          cfg?: number;
          sampler?: string;
          seed?: number;
          hiresFix?: boolean;
          upscaleBy?: number;
          upscaler?: string;
          checkpoint?: string;
          extraLoras?: string[];
          hiresSteps?: number;
          batch_size?: number;
          batch_count?: number;
          adetailer?: boolean;
          vae?: string;
          clipSkip?: number;
          negativePrompt?: string;
        }
      >;
      if (parsed && typeof parsed === "object") {
        setTechConfigByCharacter(parsed);
      }
    } catch (e) {
      console.warn("planner_tech inválido o ausente", e);
    }
  }, []);

  // Carga inicial técnica: sólo una vez
  React.useEffect(() => {
    (async () => {
      try {
        const [opts, upNames, vaeNames, cps] = await Promise.all([
          getReforgeOptions().catch(() => ({
            current_vae: "Automatic",
            current_clip_skip: 1,
          })),
          getReforgeUpscalers().catch(() => []),
          getReforgeVAEs().catch(() => []),
          getReforgeCheckpoints().catch(() => []),
          getLocalLoras().catch(() => ({ files: [] })),
        ]);
        const { computeTechBootstrap } = await import("../../helpers/planner");
        const computed = computeTechBootstrap({
          activeCharacter: null,
          techConfigByCharacter,
          globalCheckpoint: null,
          options: opts || null,
          upscalers: Array.isArray(upNames) ? upNames : [],
          vaes: Array.isArray(vaeNames) ? vaeNames : [],
          checkpoints: Array.isArray(cps) ? cps : [],
        });
        setReforgeOptionsState(computed.options);
        setReforgeUpscalers(computed.upscalers);
        setVaes(computed.vaes);
        setCheckpoints(computed.checkpoints);
        try {
          const lr = await getLocalLoras();
          setLocalLoras(Array.isArray(lr?.files) ? lr.files : []);
        } catch { }
      } catch (e) {
        console.warn("Bootstrap técnico falló", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoselección de checkpoint
  const autoselectOnceRef = React.useRef<Record<string, boolean>>({});
  React.useEffect(() => {
    if (!activeCharacter) return;
    if (autoselectOnceRef.current[activeCharacter]) return;
    const current = techConfigByCharacter[activeCharacter]?.checkpoint ?? "";
    if (current) return;
    const fallback =
      globalCheckpoint && checkpoints.includes(globalCheckpoint)
        ? globalCheckpoint
        : checkpoints.length > 0
          ? checkpoints[0]
          : "";
    if (!fallback) return;
    setTechConfig(activeCharacter, { checkpoint: fallback });
    (async () => {
      try {
        await postReforgeSetCheckpoint(fallback);
      } catch { }
    })();
    autoselectOnceRef.current[activeCharacter] = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharacter, globalCheckpoint, checkpoints]);

  const refreshUpscalers = async () =>
    refreshUpscalersHelper(
      activeCharacter ?? null,
      setReforgeUpscalers,
      setUpscalerVersion,
      techConfigByCharacter,
      setTechConfig,
      (msg) => {
        setToast({ message: msg });
        setTimeout(() => setToast(null), 2500);
      },
      (v) => setRefreshingUpscalers(v)
    );

  const refreshVaes = async () => refreshVaesHelper(setVaes);

  React.useEffect(() => {
    // Si no hay lore para el personaje activo, cargarlo automáticamente
    if (!activeCharacter) return;
    const existing = loreByCharacter[activeCharacter];
    if (!existing) {
      analyzeLore(activeCharacter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharacter, loreByCharacter]);

  // Auto-ajuste de Clip Skip
  React.useEffect(() => {
    if (!activeCharacter) return;
    const tech = techConfigByCharacter[activeCharacter] || {};
    const ckpt = (tech.checkpoint || "").toLowerCase();
    const clipSet = typeof tech.clipSkip === "number";
    if (!clipSet && (ckpt.includes("pony") || ckpt.includes("anime"))) {
      setTechConfig(activeCharacter, { clipSkip: 2 });
    }
  }, [activeCharacter, techConfigByCharacter]);

  React.useEffect(() => {
    // Cargar recursos para edición rápida
    (async () => {
      try {
        const data = await getPlannerResources();
        setResources(data);
      } catch (e) {
        console.warn("No se pudieron cargar recursos del planner:", e);
      }
    })();
  }, []);

  const refreshCheckpoints = async () =>
    refreshCheckpointsHelper(
      activeCharacter ?? null,
      setCheckpoints,
      setCheckpointVersion,
      techConfigByCharacter,
      setTechConfig,
      (msg) => {
        setToast({ message: msg });
        setTimeout(() => setToast(null), 2500);
      }
    );

  // Cargar lore
  React.useEffect(() => {
    try {
      const rawLore = localStorage.getItem("planner_lore");
      if (!rawLore) return;
      const parsed = JSON.parse(rawLore) as Record<string, string>;
      setLoreByCharacter(parsed || {});
    } catch (e) {
      console.warn("planner_lore inválido o ausente", e);
    }
  }, []);

  // Cargar meta
  React.useEffect(() => {
    try {
      const rawMeta = localStorage.getItem("planner_meta");
      if (!rawMeta) return;
      const parsed = JSON.parse(rawMeta) as unknown[];
      const map: Record<
        string,
        { image_url?: string; trigger_words?: string[]; download_url?: string }
      > = {};
      parsed.forEach((m) => {
        const obj = m as {
          character_name?: string;
          name?: string;
          image_url?: string;
          trigger_words?: string[];
          download_url?: string;
          downloadUrl?: string;
        };
        const key = obj.character_name || obj.name;
        if (!key) return;
        map[key] = {
          image_url: obj.image_url,
          trigger_words: obj.trigger_words,
          download_url: obj.download_url || obj.downloadUrl,
        };
      });
      setMetaByCharacter(map);
    } catch (e) {
      console.warn("planner_meta inválido o ausente", e);
    }
  }, []);

  // Cargar contexto
  React.useEffect(() => {
    try {
      const rawCtx = localStorage.getItem("planner_context");
      if (!rawCtx) return;
      const parsed = JSON.parse(rawCtx) as Record<
        string,
        {
          base_prompt?: string;
          recommended_params?: { cfg: number; steps: number; sampler: string };
          reference_images?: Array<{
            url: string;
            meta: Record<string, unknown>;
          }>;
        }
      >;
      setPlannerContext(parsed || {});
    } catch (e) {
      console.warn("planner_context inválido o ausente", e);
    }
  }, []);

  // Agrupar jobs
  const perCharacter = React.useMemo(() => {
    const m: Record<string, { indices: number[]; jobs: PlannerJob[] }> = {};
    jobs.forEach((job, idx) => {
      if (!m[job.character_name])
        m[job.character_name] = { indices: [], jobs: [] };
      m[job.character_name].indices.push(idx);
      m[job.character_name].jobs.push(job);
    });
    return m;
  }, [jobs]);

  // Establecer personaje activo
  React.useEffect(() => {
    const names = Object.keys(perCharacter);
    if (!activeCharacter && names.length > 0) {
      setActiveCharacter(names[0]);
    }
  }, [perCharacter, activeCharacter]);

  const updatePrompt = (idx: number, value: string) => {
    setJobs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], prompt: value };
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
  };

  const deleteRow = (idx: number) => {
    setJobs((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
    setSelected((prev) => {
      const s = new Set(prev);
      s.delete(idx);
      return s;
    });
  };

  // --- FUNCIÓN MAESTRA: ARQUITECTO DE PROMPTS ---
  // --- ARQUITECTO DE PROMPTS V2 (SOPORTE COMPLETO DE RECURSOS) ---
  const reconstructJobPrompt = async (
    characterName: string,
    // Ahora aceptamos tripletas Y extras
    sceneChanges: {
      outfit?: string; pose?: string; location?: string;
      lighting?: string; camera?: string; expression?: string; hairstyle?: string;
    },
    currentPromptForFallback: string = ""
  ): Promise<string> => {

    // 1. IDENTIDAD (LoRA + Trigger)
    const sanitize = (s: string) => s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/g, "");
    const loraTag = `<lora:${sanitize(characterName)}:0.8>`;

    // Trigger logic mejorada
    let firstTrig = "";
    try {
      const info = await getLocalLoraInfo(characterName);
      if (Array.isArray(info?.trainedWords) && info.trainedWords.length > 0) {
        firstTrig = info.trainedWords[0];
      } else if (metaByCharacter[characterName]?.trigger_words?.length) {
        firstTrig = metaByCharacter[characterName]!.trigger_words![0];
      }
    } catch { }

    // Fallback: Si no hay trigger oficial, limpiar el nombre del archivo
    if (!firstTrig) {
      // 1. Quitar parte después del guion (ej "Personaje - Serie")
      let clean = characterName.split(" - ")[0];
      // 2. Reemplazar guiones bajos por espacios
      clean = clean.replace(/_/g, " ");
      // 3. Quitar parientes y versiones (v1, v2...)
      clean = clean.replace(/\(.*\)/g, "").replace(/v\d+/i, "");
      // 4. Trim
      firstTrig = clean.trim();
    }

    // 2. PROMPT GLOBAL (Estilo/Calidad) - SIEMPRE INYECTADO
    const globalPrompt = plannerContext[characterName]?.base_prompt || "";

    // 3. ESCENA & EXTRAS (La parte variable del Job)
    // Extraemos lo que ya existe para no perder datos si no se pasan en sceneChanges
    // Pasamos resources para una extracción robusta
    const currentTriplet = extractTriplet(currentPromptForFallback, resources || undefined);
    const currentExtras = extractExtras(currentPromptForFallback, resources || undefined);

    // Fusión: Nuevo valor > Valor existente > Vacío
    const outfit = sceneChanges.outfit !== undefined ? sceneChanges.outfit : (currentTriplet.outfit || "");
    const pose = sceneChanges.pose !== undefined ? sceneChanges.pose : (currentTriplet.pose || "");
    const location = sceneChanges.location !== undefined ? sceneChanges.location : (currentTriplet.location || "");

    const lighting = sceneChanges.lighting !== undefined ? sceneChanges.lighting : (currentExtras.lighting || "");
    const camera = sceneChanges.camera !== undefined ? sceneChanges.camera : (currentExtras.camera || "");
    const expression = sceneChanges.expression !== undefined ? sceneChanges.expression : (currentExtras.expression || "");

    // Lógica Hairstyle: Si es "original" o vacío explícito, lo ignoramos.
    let hairstyle = sceneChanges.hairstyle !== undefined ? sceneChanges.hairstyle : (currentExtras.hairstyle || "");
    if (hairstyle.toLowerCase() === "original" || hairstyle.toLowerCase() === "default") hairstyle = "";

    // Construcción de bloques
    const scenePart = [outfit, pose, location].filter(Boolean).join(", ");
    const extrasPart = [lighting, camera, expression, hairstyle].filter(Boolean).join(", ");

    // 5. ENSAMBLAJE FINAL
    // Orden: <LoRA> + Trigger + [GLOBAL] + [ESCENA] + [EXTRAS]
    return [loraTag, firstTrig, globalPrompt, scenePart, extrasPart]
      .map(s => s.trim())
      .filter(Boolean)
      .join(", ");
  };

  // Magic Fix
  // Magic Fix
  const magicFix = async (idx: number) => {
    try {
      setLoading(true);
      setToast({ message: "🔮 Consultando al oráculo..." });

      // Leemos el job actual directamente del estado (por si acaso el índice cambió)
      // Nota: En closures asíncronos, 'jobs' puede ser viejo. Usar callback en setJobs es mejor,
      // pero para lectura necesitamos el valor actual.
      // Asumiremos que 'jobs[idx]' es correcto por ahora.
      const currentJob = jobs[idx];

      const res = await magicFixPrompt(currentJob.prompt);

      // Aplicamos el cambio
      const newScene = { outfit: res.outfit, pose: res.pose, location: res.location };
      const newPrompt = await reconstructJobPrompt(currentJob.character_name, newScene, currentJob.prompt);

      updatePrompt(idx, newPrompt);

      const msg = res.ai_reasoning || "✨ Destino alterado";
      setAiReasoningByJob(prev => ({ ...prev, [idx]: msg }));
      setToast({ message: msg });
      setTimeout(() => setToast(null), 2000);

    } catch (e) {
      console.error(e);
      setToast({ message: "Error al alterar destino" });
    } finally {
      setLoading(false);
    }
  };

  async function analyzeLore(character: string) {
    try {
      setLoading(true);
      setError(null);
      setToast({ message: "🧠 La IA está creando escenarios..." });
      const tags = metaByCharacter[character]?.trigger_words || [];
      const batchCount = techConfigByCharacter[character]?.batch_count ?? 1;

      const { jobs: rawJobs, lore, ai_reasoning } = await postPlannerAnalyze(character, tags, batchCount);

      if (Array.isArray(rawJobs) && rawJobs.length > 0) {
        // Normalizar jobs entrantes: Inyectar Global Prompt y Estructura Correcta
        const normalizedJobs = await Promise.all(rawJobs.map(async (j) => {
          const triplet = extractTriplet(j.prompt, resources || undefined);
          const cleanPrompt = await reconstructJobPrompt(j.character_name, triplet, j.prompt);
          return { ...j, prompt: cleanPrompt };
        }));

        setJobs((prev) => {
          // Reemplazar jobs viejos de este personaje con los nuevos normalizados
          const others = prev.filter(j => j.character_name !== character);
          const next = [...others, ...normalizedJobs];
          try { localStorage.setItem("planner_jobs", JSON.stringify(next)); } catch { }
          return next;
        });
      }

      if (lore) {
        setLoreByCharacter((prev) => {
          const next = { ...prev, [character]: lore };
          localStorage.setItem("planner_lore", JSON.stringify(next));
          return next;
        });
      }
      if (ai_reasoning) {
        setAiReasoningByCharacter((prev) => ({ ...prev, [character]: ai_reasoning }));
        setToast({ message: ai_reasoning });
        setTimeout(() => setToast(null), 3500);
      }
      setSelected(new Set());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Error al analizar lore");
    } finally {
      setLoading(false);
    }
  }

  const deleteCharacter = (character: string) => {
    setJobs((prev) => {
      const next = prev.filter((j) => j.character_name !== character);
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
    setSelected(new Set());
  };

  const ensureTriplet = (prompt: string): string => {
    const t = extractTriplet(prompt, resources || undefined);
    const pick = <T extends string>(def: T, arr?: T[]): T => {
      if (!arr || arr.length === 0) return def;
      return arr[Math.floor(Math.random() * arr.length)] as T;
    };
    const outfit =
      t.outfit && t.outfit.length > 0
        ? t.outfit
        : pick("casual", resources?.outfits);
    const pose =
      t.pose && t.pose.length > 0 ? t.pose : pick("standing", resources?.poses);
    const location =
      t.location && t.location.length > 0
        ? t.location
        : pick("studio", resources?.locations);
    return rebuildPromptWithTriplet(
      prompt,
      { outfit, pose, location },
      resources
        ? {
          outfits: resources.outfits,
          poses: resources.poses,
          locations: resources.locations,
        }
        : undefined
    );
  };

  const handleReset = () => {
    const ok = window.confirm("¿Borrar todo el plan actual y limpiar caché?");
    if (!ok) return;
    try {
      localStorage.removeItem("planner_jobs");
      localStorage.removeItem("planner_meta");
      localStorage.removeItem("planner_lore");
      localStorage.removeItem("planner_config");
    } catch (e) {
      console.warn("No se pudo limpiar localStorage", e);
    }
    setJobs([]);
    setSelected(new Set());
    setMetaByCharacter({});
    setLoreByCharacter({});
    setPlannerContext({});
    setConfigByCharacter({});
    setTechConfigByCharacter({});
    setActiveCharacter(null);
    const goRadar = window.confirm("¿Ir al Radar para empezar de cero?");
    if (goRadar) router.push("/radar");
  };

  const deleteSelected = () => {
    setJobs((prev) => {
      const next = prev.filter((_, i) => !selected.has(i));
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
    setSelected(new Set());
  };

  // === LÓGICA DE PRODUCCIÓN ===
  const startProduction = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Recursos Meta (Igual que antes)
      let resourcesMeta: ResourceMeta[] = [];
      try {
        const rawMeta = localStorage.getItem("planner_meta");
        if (rawMeta) resourcesMeta = JSON.parse(rawMeta); // Simplificado para brevedad
      } catch { }

      // 2. Preparar Jobs (Solo inyección final de LoRAs Extra)
      const preparedJobs: PlannerJob[] = jobs.map(j => {
        const tech = techConfigByCharacter[j.character_name] || {};

        // El prompt en la tarjeta (j.prompt) YA TIENE: LoRA Char + Trigger + Global + Escena + Calidad
        // Solo necesitamos inyectar los Extra LoRAs antes de la calidad final.

        // Estrategia segura: Partir por "masterpiece" para insertar antes
        const parts = j.prompt.split("masterpiece");
        const mainPart = parts[0];
        const qualityPart = "masterpiece" + (parts[1] || "");

        const extraLorasString = (tech.extraLoras || []).map(l => `<lora:${l}:0.7>`).join(", ");

        // Reconstruir con el ingrediente final
        const finalPrompt = [mainPart, extraLorasString, qualityPart]
          .map(s => s?.trim())
          .filter(Boolean)
          .join(", ");

        // Negativo
        let presetNeg = "bad quality, worst quality, sketch, censor";
        try {
          const p = JSON.parse(localStorage.getItem("planner_preset_global") || "{}");
          if (p.negativePrompt) presetNeg = p.negativePrompt;
        } catch { }

        return {
          ...j,
          prompt: finalPrompt,
          seed: tech.seed ?? -1,
          negative_prompt: mergeNegative(presetNeg, tech.negativePrompt)
        };
      });

      // 3. Configuración de Grupo (Igual que antes)
      const groupConfig = Object.keys(perCharacter).map((character) => {
        const tech = techConfigByCharacter[character] || {};
        const conf = configByCharacter[character] || {};
        return {
          character_name: character,
          hires_fix: tech.hiresFix ?? true,
          denoising_strength: conf.denoising ?? 0.35,
          output_path: conf.outputPath ?? `OUTPUTS_DIR/{Character}/`,
          steps: tech.steps ?? 30,
          cfg_scale: tech.cfg ?? 7,
          sampler: tech.sampler,
          upscale_by: tech.upscaleBy,
          upscaler: tech.upscaler,
          checkpoint: tech.checkpoint,
          width: tech.width ?? 832,
          height: tech.height ?? 1216,
          adetailer_model: (tech.adetailer ?? true) ? (tech.adetailerModel || "face_yolov8n.pt") : undefined,
          extra_loras: tech.extraLoras || [],
          hires_steps: tech.hiresSteps,
          batch_size: tech.batch_size ?? 1,
          adetailer: tech.adetailer ?? true,
          vae: tech.vae,
          clip_skip: tech.clipSkip,
        };
      });

      const { postPlannerExecuteV2 } = await import("../../lib/api");
      await postPlannerExecuteV2(preparedJobs, resourcesMeta, groupConfig);
      router.push("/factory");

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Error iniciando producción");
    } finally {
      setLoading(false);
    }
  };

  // Helpers de UI
  const applyQuickEdit = async (
    row: number,
    field: "outfit" | "pose" | "location",
    value: string
  ) => {
    const job = jobs[row];
    // Extraer estado actual
    const currentTriplet = extractTriplet(job.prompt, resources || undefined);

    // Crear nueva escena con el cambio aplicado
    const newScene = {
      outfit: currentTriplet.outfit,
      pose: currentTriplet.pose,
      location: currentTriplet.location,
      [field]: value // Sobrescribir el campo cambiado
    };

    // Reconstruir todo
    const newPrompt = await reconstructJobPrompt(
      job.character_name,
      newScene,
      job.prompt
    );

    updatePrompt(row, newPrompt);
  };

  const applyExtrasEdit = async (
    row: number,
    field: "lighting" | "camera" | "expression" | "hairstyle",
    value: string
  ) => {
    const job = jobs[row];
    // Pasamos el cambio específico al arquitecto
    const newPrompt = await reconstructJobPrompt(
      job.character_name,
      { [field]: value }, // Solo enviamos lo que cambió, el resto se rescata
      job.prompt
    );
    updatePrompt(row, newPrompt);
  };

  const handleDeleteJob = (character: string, localIndex: number) => {
    const idx = perCharacter[character]?.indices[localIndex];
    if (typeof idx === "number") deleteRow(idx);
  };

  const setIntensity = (idx: number, nextLabel: "SFW" | "ECCHI" | "NSFW") => {
    const tokens = splitPrompt(jobs[idx].prompt);
    const core: string[] = [];
    const quality: string[] = [];
    for (const t of tokens) {
      if (QUALITY_SET.has(t.toLowerCase())) quality.push(t);
      else core.push(t);
    }
    const isRating = (s: string) => {
      const low = s.toLowerCase();
      return (
        low === "rating_safe" ||
        low === "rating_questionable" ||
        low === "rating_explicit" ||
        low === "explicit" ||
        low === "nsfw" ||
        low === "safe" ||
        low === "questionable"
      );
    };
    const coreFiltered = core.filter((t) => !isRating(t));
    const qualityFiltered = quality.filter((t) => t.toLowerCase() !== "nsfw");

    let newRatings: string[] = [];
    if (nextLabel === "SFW")
      newRatings = ["rating_safe", "best quality", "masterpiece"];
    if (nextLabel === "ECCHI")
      newRatings = [
        "rating_questionable",
        "cleavage",
        "swimsuit",
        "(ecchi:1.2)",
        "best quality",
        "masterpiece",
      ];
    if (nextLabel === "NSFW")
      newRatings = [
        "rating_explicit",
        "nsfw",
        "nipple",
        "pussy",
        "nude",
        "best quality",
        "masterpiece",
      ];

    const combined = [...newRatings, ...coreFiltered, ...qualityFiltered];
    const unique = Array.from(new Set(combined));
    updatePrompt(idx, unique.join(", "));
  };

  const handleIntensityChange = (
    idx: number,
    nextLabel: "SFW" | "ECCHI" | "NSFW"
  ) => {
    setIntensityBusy((prev) => {
      const s = new Set(prev);
      s.add(idx);
      return s;
    });
    setIntensity(idx, nextLabel);
    setIntensity(idx, "NSFW");
    setTimeout(() => {
      setIntensityBusy((prev) => {
        const s = new Set(prev);
        s.delete(idx);
        return s;
      });
    }, 350);
  };

  const toggleDetails = (idx: number) => {
    setShowDetails((prev) => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx);
      else s.add(idx);
      return s;
    });
  };

  if (jobs.length === 0) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/20">
            <Radar className="h-8 w-8 text-violet-400" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">Plan vacío</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Aún no hay jobs generados. Usa el analizador de lore para construir
            un plan.
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push("/radar")}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-sm text-violet-100 hover:bg-violet-600/30 cursor-pointer transition-all active:scale-95"
            >
              <Search className="h-4 w-4" aria-hidden />
              Ir al Radar para buscar objetivos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Planificador</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-red-700 bg-transparent px-4 py-2 text-sm text-red-100 hover:bg-red-700/10 cursor-pointer transition-all active:scale-95"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Reset Cache/Debug
          </button>
          <button
            onClick={async () => {
              try {
                // Lógica de simulación (Preview)
                // Se ha simplificado el bloque de simulación para mantener consistencia
                setDryRunPayload(
                  JSON.stringify(
                    { status: "Simulación activada", jobs: jobs.length },
                    null,
                    2
                  )
                );
                setDryRunOpen(true);
              } catch {
                void 0;
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-transparent px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/10 cursor-pointer transition-all active:scale-95"
          >
            <Search className="h-4 w-4" aria-hidden />
            Simular Envío
          </button>
          <button
            onClick={startProduction}
            disabled={jobs.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-500 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
          >
            <Play className="h-4 w-4" aria-hidden />
            Iniciar producción
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-visible">
        <div className="p-2">
          <div className="mb-3">
            <div className="section-title">
              <Cog className="section-title__icon" aria-hidden />
              <span>Panel Técnico</span>
              <span className="ml-auto">
                <EngineHealthIndicator />
              </span>
            </div>
          </div>
          <TechnicalModelPanel
            activeCharacter={activeCharacter!}
            checkpoints={checkpoints}
            vaes={vaes}
            reforgeOptions={reforgeOptions}
            checkpointVersion={checkpointVersion}
            techConfigByCharacter={techConfigByCharacter}
            // CONEXIÓN DE DATOS: Lista de LoRAs locales
            availableLoras={localLoras}
            onToggleExtraLora={(loraName) => {
              if (!activeCharacter) return;
              const currentExtras =
                techConfigByCharacter[activeCharacter]?.extraLoras || [];
              let newExtras;
              if (currentExtras.includes(loraName)) {
                newExtras = currentExtras.filter((l) => l !== loraName);
              } else {
                newExtras = [...currentExtras, loraName];
              }
              setTechConfig(activeCharacter, { extraLoras: newExtras });
            }}
            onSetCheckpoint={async (title) =>
              handleSetCheckpoint(
                title,
                activeCharacter!,
                setTechConfig,
                setGlobalCheckpoint
              )
            }
            onSetVae={(value) => setTechConfig(activeCharacter, { vae: value })}
            onSetClipSkip={(value) =>
              setTechConfig(activeCharacter, { clipSkip: value })
            }
            onRefreshAll={async () =>
              handleRefreshTech(
                activeCharacter,
                refreshVaes,
                refreshCheckpoints
              )
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-visible mt-4">
        <div className="p-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-9">
              <PromptsEditor
                basePrompt={plannerContext[activeCharacter!]?.base_prompt || ""}
                negativePrompt={
                  techConfigByCharacter[activeCharacter!]?.negativePrompt ?? ""
                }
                onChangeBase={(v) => {
                  setPlannerContext((prev) => {
                    const next = {
                      ...prev,
                      [activeCharacter!]: {
                        ...(prev[activeCharacter!] || {}),
                        base_prompt: v,
                      },
                    };
                    try {
                      localStorage.setItem(
                        "planner_context",
                        JSON.stringify(next)
                      );
                    } catch { }
                    return next;
                  });
                }}
                onChangeNegative={(v) =>
                  setTechConfig(activeCharacter, { negativePrompt: v })
                }
              />
            </div>
            <div className="col-span-3">
              <button
                onClick={startProduction}
                disabled={jobs.length === 0}
                className="w-full h-32 rounded-lg bg-green-600 text-white text-lg font-semibold hover:bg-green-500 disabled:opacity-60"
              >
                Generar
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setSavePresetKind("pos");
                    setSavePresetName("");
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Guardar Positivo
                </button>
                <button
                  onClick={() => {
                    setSavePresetKind("neg");
                    setSavePresetName("");
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Guardar Negativo
                </button>
              </div>
              {savePresetKind && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
                  <div className="w-[420px] max-w-[90vw] rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                      <div className="text-sm font-medium text-slate-100">
                        {savePresetKind === "pos"
                          ? "Guardar Positivo"
                          : "Guardar Negativo"}
                      </div>
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                        onClick={() => setSavePresetKind(null)}
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      <label className="text-xs text-slate-300">
                        Nombre del preset
                      </label>
                      <input
                        type="text"
                        value={savePresetName}
                        onChange={(e) => setSavePresetName(e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                          onClick={() => setSavePresetKind(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border border-green-600 bg-green-600/20 px-2 py-1 text-xs text-green-100 hover:bg-green-600/30 disabled:opacity-60"
                          disabled={savingPreset || !savePresetName.trim()}
                          onClick={async () => {
                            try {
                              setSavingPreset(true);
                              const api = await import("../../lib/api");
                              const name = savePresetName.trim();
                              let content = "";
                              if (savePresetKind === "pos") {
                                const base =
                                  plannerContext[activeCharacter!]
                                    ?.base_prompt || "";
                                content = stripLoraTags(base);
                              } else {
                                content = String(
                                  techConfigByCharacter[activeCharacter!]
                                    ?.negativePrompt || ""
                                );
                              }
                              await api.postPresetSave(name, content);
                              setToast({ message: `Preset guardado: ${name}` });
                              setTimeout(() => setToast(null), 2500);
                              setSavePresetKind(null);
                              setSavePresetName("");
                            } catch (e: unknown) {
                              const msg =
                                e instanceof Error ? e.message : String(e);
                              setToast({
                                message: msg || "Error guardando preset",
                              });
                              setTimeout(() => setToast(null), 2500);
                            } finally {
                              setSavingPreset(false);
                            }
                          }}
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="relative w-full">
                  <button
                    onClick={async () => {
                      await refreshPresets();
                      setOpenPresetMenu(
                        openPresetMenu === "pos" ? null : "pos"
                      );
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    Cargar Positivo
                  </button>
                  {openPresetMenu === "pos" && (
                    <div className="absolute z-30 top-full mt-2 left-0 w-full rounded border border-slate-700 bg-slate-900 shadow-lg">
                      {presetFiles.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-slate-300">
                          Sin presets .txt
                        </div>
                      ) : (
                        <ul className="max-h-48 overflow-auto">
                          {presetFiles.map((f) => (
                            <li key={f}>
                              <button
                                type="button"
                                className="block w-full text-left px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                                onClick={async () => {
                                  try {
                                    const api = await import("../../lib/api");
                                    let content = await api.getPresetContent(f);
                                    content = stripLoraTags(content);
                                    setPlannerContext((prev) => {
                                      const before =
                                        prev[activeCharacter!] || {};
                                      const base = String(
                                        before.base_prompt || ""
                                      );
                                      const nextBase = mergePositive(
                                        content,
                                        base,
                                        ""
                                      );
                                      const next = {
                                        ...prev,
                                        [activeCharacter!]: {
                                          ...before,
                                          base_prompt: nextBase,
                                        },
                                      };
                                      try {
                                        localStorage.setItem(
                                          "planner_context",
                                          JSON.stringify(next)
                                        );
                                      } catch { }
                                      return next;
                                    });
                                  } catch { }
                                  setOpenPresetMenu(null);
                                }}
                              >
                                {f}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative w-full">
                  <button
                    onClick={async () => {
                      await refreshPresets();
                      setOpenPresetMenu(
                        openPresetMenu === "neg" ? null : "neg"
                      );
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    Cargar Negativo
                  </button>
                  {openPresetMenu === "neg" && (
                    <div className="absolute z-30 top-full mt-2 left-0 w-full rounded border border-slate-700 bg-slate-900 shadow-lg">
                      {presetFiles.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-slate-300">
                          Sin presets .txt
                        </div>
                      ) : (
                        <ul className="max-h-48 overflow-auto">
                          {presetFiles.map((f) => (
                            <li key={f}>
                              <button
                                type="button"
                                className="block w-full text-left px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                                onClick={async () => {
                                  try {
                                    const api = await import("../../lib/api");
                                    const content = await api.getPresetContent(
                                      f
                                    );
                                    setTechConfig(activeCharacter, {
                                      negativePrompt: mergeNegative(
                                        content,
                                        techConfigByCharacter[activeCharacter!]
                                          ?.negativePrompt || ""
                                      ),
                                    });
                                  } catch { }
                                  setOpenPresetMenu(null);
                                }}
                              >
                                {f}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {activeCharacter ? (
          <>
            {/* Sección Superior (Contexto & Config) */}
            <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden">
              <div className="p-3">
                <div className="grid grid-cols-12 gap-4 items-start">
                  <div className="col-span-12 md:col-span-12 md:order-1">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="section-title">
                        <Cog className="section-title__icon" aria-hidden />
                        <span>Panel de Configuración</span>
                      </div>

                      <ControlPanel
                        activeCharacter={activeCharacter!}
                        paramTab={paramTab}
                        setParamTab={setParamTab}
                        techConfigByCharacter={techConfigByCharacter}
                        configByCharacter={configByCharacter}
                        plannerContext={plannerContext}
                        setTechConfig={(character, partial) =>
                          setTechConfig(character, partial)
                        }
                        setConfigByCharacter={
                          setConfigByCharacter as React.Dispatch<
                            React.SetStateAction<
                              Record<
                                string,
                                {
                                  denoising?: number;
                                  hiresFix?: boolean;
                                  outputPath?: string;
                                }
                              >
                            >
                          >
                        }
                        reforgeUpscalers={reforgeUpscalers}
                        refreshingUpscalers={refreshingUpscalers}
                        upscalerVersion={upscalerVersion}
                        refreshUpscalers={refreshUpscalers}
                        isRegenerating={isRegenerating}
                        onRegenerateDrafts={onRegenerateDrafts}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Sección Inferior: Cola de Producción */}
            <section
              className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden mt-6"
              aria-labelledby="production-queue-title"
            >
              <div className="p-3 space-y-3">
                <div className="section-title" id="production-queue-title">
                  <Play className="section-title__icon" aria-hidden />
                  <span>Cola de Producción</span>
                  <span className="ml-auto text-xs text-zinc-400">
                    Personajes: {Object.keys(perCharacter).length} · Jobs:{" "}
                    {jobs.length}
                  </span>
                </div>
                <ProductionQueue
                  perCharacter={perCharacter}
                  resources={resources}
                  metaByCharacter={metaByCharacter}
                  loreByCharacter={loreByCharacter}
                  setLoreByCharacter={setLoreByCharacter}
                  analyzeLore={analyzeLore}
                  applyQuickEdit={applyQuickEdit}
                  applyExtrasEdit={applyExtrasEdit}
                  updatePrompt={updatePrompt}
                  aiReasoningByJob={aiReasoningByJob}
                  aiReasoningByCharacter={aiReasoningByCharacter}
                  magicFix={magicFix}
                  toggleDetails={toggleDetails}
                  showDetails={showDetails}
                  intensityBusy={intensityBusy}
                  handleDeleteJob={handleDeleteJob}
                  handleDeleteCharacter={deleteCharacter}
                  handleIntensityChange={handleIntensityChange}
                  loading={loading}
                />
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-300">
            Selecciona un personaje
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-0 right-0 mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-3">
            <span className="text-sm text-zinc-300">
              {selected.size} seleccionadas
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={deleteSelected}
                className="inline-flex items-center gap-2 rounded-md border border-red-600 bg-red-600/20 px-3 py-1.5 text-xs text-red-100 hover:bg-red-600/30 cursor-pointer transition-all"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Eliminar seleccionadas
              </button>
              <button className="hidden"></button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-40 rounded-md border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-200 shadow">
          {toast.message}
        </div>
      )}
      {dryRunOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-[720px] max-w-[90vw] rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
              <div className="text-sm font-medium text-slate-100">
                Previsualización de Payload
              </div>
              <button
                onClick={() => setDryRunOpen(false)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4">
              <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words max-h-[60vh] overflow-auto">
                {dryRunPayload}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EngineHealthIndicator() {
  const [status, setStatus] = React.useState<"ok" | "error" | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        const API_BASE =
          process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${API_BASE}/reforge/health`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        setStatus(j?.status === "ok" ? "ok" : "error");
      } catch {
        setStatus("error");
      }
    })();
  }, []);
  if (status === null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      {status === "ok" ? (
        <span className="inline-block h-3 w-3 rounded-full bg-green-400" />
      ) : (
        <span className="inline-block h-3 w-3 rounded-full bg-red-400" />
      )}
      {status === "ok" ? "Motor: Online" : "Motor: Offline"}
    </span>
  );
}
