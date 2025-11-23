"use client";
import React from "react";
import { Wand2, Trash2, RefreshCw, Play, Radar, Search, Cog, Camera, Sun, ChevronDown, ChevronUp } from "lucide-react";
import type { PlannerJob } from "../../types/planner";
import { magicFixPrompt, getPlannerResources, postPlannerAnalyze } from "../../lib/api";
import { useRouter } from "next/navigation";
import type { ResourceMeta } from "../../lib/api";

// Palabras de calidad para detectar el segmento final del prompt
const QUALITY_SET = new Set([
  "masterpiece",
  "best quality",
  "absurdres",
  "nsfw",
]);

function splitPrompt(prompt: string): string[] {
  return (prompt || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function extractTriplet(prompt: string): { outfit?: string; pose?: string; location?: string } {
  const tokens = splitPrompt(prompt);
  // Quitar tokens de calidad al final
  const core: string[] = [];
  for (const t of tokens) {
    core.push(t);
  }
  // Remover desde el final las palabras de calidad
  while (core.length > 0) {
    const last = core[core.length - 1].toLowerCase();
    if (QUALITY_SET.has(last)) core.pop();
    else break;
  }
  // Esperamos: [..., outfit, pose, location]
  const n = core.length;
  if (n >= 3) {
    return { outfit: core[n - 3], pose: core[n - 2], location: core[n - 1] };
  }
  return {};
}

function rebuildPromptWithTriplet(original: string, nextTriplet: { outfit?: string; pose?: string; location?: string }): string {
  const tokens = splitPrompt(original);
  const core: string[] = [];
  const quality: string[] = [];
  for (const t of tokens) {
    if (QUALITY_SET.has(t.toLowerCase())) quality.push(t);
    else core.push(t);
  }
  // Asegurar que hay al menos 3 posiciones al final para outfit/pose/location
  while (core.length < 3) core.push("");
  if (nextTriplet.outfit !== undefined) core[core.length - 3] = nextTriplet.outfit;
  if (nextTriplet.pose !== undefined) core[core.length - 2] = nextTriplet.pose;
  if (nextTriplet.location !== undefined) core[core.length - 1] = nextTriplet.location;
  const all = [...core, ...quality];
  return all.join(", ");
}

// Heurística para extraer Lighting y Camera cuando existan en el prompt
function extractExtras(prompt: string): { lighting?: string; camera?: string } {
  const tokens = splitPrompt(prompt);
  const core: string[] = [];
  for (const t of tokens) {
    if (!QUALITY_SET.has(t.toLowerCase())) core.push(t);
  }
  // Ignorar las últimas 3 posiciones (Outfit, Pose, Location)
  const scan = core.slice(0, Math.max(0, core.length - 3));
  const isLighting = (s: string) => {
    const low = s.toLowerCase();
    return [
      "light",
      "lighting",
      "shadow",
      "shadows",
      "glow",
      "ambient",
      "rim light",
      "neon",
      "backlight",
      "backlit",
      "studio light",
    ].some((k) => low.includes(k));
  };
  const isCamera = (s: string) => {
    const low = s.toLowerCase();
    return [
      "angle",
      "shot",
      "lens",
      "close-up",
      "portrait",
      "fov",
      "zoom",
      "fisheye",
      "bokeh",
      "wide angle",
      "low angle",
      "high angle",
    ].some((k) => low.includes(k));
  };
  let lighting: string | undefined;
  let camera: string | undefined;
  for (const t of scan) {
    if (!lighting && isLighting(t)) lighting = t;
    if (!camera && isCamera(t)) camera = t;
    if (lighting && camera) break;
  }
  return { lighting, camera };
}

function rebuildPromptWithExtras(original: string, extras: { lighting?: string; camera?: string }) {
  const tokens = splitPrompt(original);
  const core: string[] = [];
  const quality: string[] = [];
  for (const t of tokens) {
    if (QUALITY_SET.has(t.toLowerCase())) quality.push(t);
    else core.push(t);
  }
  const tail = core.slice(-3);
  const head = core.slice(0, Math.max(0, core.length - 3)).filter((t) => {
    const low = t.toLowerCase();
    const isLight = ["light","lighting","shadow","shadows","glow","ambient","rim light","neon","backlight","backlit","studio light"].some((k) => low.includes(k));
    const isCam = ["angle","shot","lens","close-up","portrait","fov","zoom","fisheye","bokeh","wide angle","low angle","high angle"].some((k) => low.includes(k));
    return !(isLight || isCam);
  });
  const pre: string[] = [];
  if (extras.camera) pre.push(extras.camera);
  if (extras.lighting) pre.push(extras.lighting);
  const nextCore = [...pre, ...head, ...tail];
  return [...nextCore, ...quality].join(", ");
}

export default function PlannerView() {
  const [jobs, setJobs] = React.useState<PlannerJob[]>([]);
const [loading, setLoading] = React.useState(false);
const [error, setError] = React.useState<string | null>(null);
const [resources, setResources] = React.useState<{ outfits: string[]; poses: string[]; locations: string[]; lighting?: string[]; camera?: string[] } | null>(null);
const [selected, setSelected] = React.useState<Set<number>>(new Set());
const [openEditor, setOpenEditor] = React.useState<{ row: number; field: "outfit" | "pose" | "location" } | null>(null);
const [metaByCharacter, setMetaByCharacter] = React.useState<Record<string, { image_url?: string; trigger_words?: string[]; download_url?: string }>>({});
const router = useRouter();
const [loreByCharacter, setLoreByCharacter] = React.useState<Record<string, string>>({});
const [configOpen, setConfigOpen] = React.useState<Record<string, boolean>>({});
const [configByCharacter, setConfigByCharacter] = React.useState<Record<string, { hiresFix: boolean; denoising: number; outputPath: string }>>({});
const [techConfigByCharacter, setTechConfigByCharacter] = React.useState<Record<string, { steps?: number; cfg?: number; sampler?: string; seed?: number; hiresFix?: boolean; upscaleBy?: number }>>({});
const [plannerContext, setPlannerContext] = React.useState<Record<string, { base_prompt?: string; recommended_params?: { cfg: number; steps: number; sampler: string }; reference_images?: Array<{ url: string; meta: Record<string, any> }> }>>({});
const setTechConfig = (character: string | null, partial: Partial<{ steps: number; cfg: number; sampler: string; seed: number; hiresFix: boolean; upscaleBy: number }>) => {
  if (!character) return;
  setTechConfigByCharacter((prev) => ({ ...prev, [character]: { ...prev[character], ...partial } }));
};
const [showDetails, setShowDetails] = React.useState<Set<number>>(new Set());
const [activeCharacter, setActiveCharacter] = React.useState<string | null>(null);

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
    } catch (e) {
      console.error("Failed to load planner_jobs", e);
    }
  }, []);

  React.useEffect(() => {
    // Si no hay lore para el personaje activo, cargarlo automáticamente
    if (!activeCharacter) return;
    const existing = loreByCharacter[activeCharacter];
    if (!existing) {
      analyzeLore(activeCharacter);
    }
  }, [activeCharacter]);

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

  // Cargar lore por personaje desde localStorage
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

  // Cargar perfil/meta por personaje desde localStorage
  React.useEffect(() => {
    try {
      const rawMeta = localStorage.getItem("planner_meta");
      if (!rawMeta) return;
      const parsed = JSON.parse(rawMeta) as any[];
      const map: Record<string, { image_url?: string; trigger_words?: string[]; download_url?: string }> = {};
      parsed.forEach((m: any) => {
        const key = m.character_name || m.name;
        if (!key) return;
        map[key] = {
          image_url: m.image_url,
          trigger_words: m.trigger_words,
          download_url: m.download_url || m.downloadUrl,
        };
      });
      setMetaByCharacter(map);
    } catch (e) {
      console.warn("planner_meta inválido o ausente", e);
    }
  }, []);

  // Cargar contexto enriquecido por personaje
  React.useEffect(() => {
    try {
      const rawCtx = localStorage.getItem("planner_context");
      if (!rawCtx) return;
      const parsed = JSON.parse(rawCtx) as Record<string, any>;
      setPlannerContext(parsed || {});
    } catch (e) {
      console.warn("planner_context inválido o ausente", e);
    }
  }, []);

  // Agrupar jobs por personaje (indices + jobs)
  const perCharacter = React.useMemo(() => {
    const m: Record<string, { indices: number[]; jobs: PlannerJob[] }> = {};
    jobs.forEach((job, idx) => {
      if (!m[job.character_name]) m[job.character_name] = { indices: [], jobs: [] };
      m[job.character_name].indices.push(idx);
      m[job.character_name].jobs.push(job);
    });
    return m;
  }, [jobs]);

  // Establecer personaje activo por defecto cuando lleguen los jobs
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

  const regenerateSeed = (idx: number) => {
    setJobs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], seed: Math.floor(Math.random() * 2_147_483_647) };
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

  const magicFix = async (idx: number) => {
    try {
      setLoading(true);
      const res = await magicFixPrompt(jobs[idx].prompt);
      // Si Magic Fix falla o devuelve vacío, rellenar aleatorio
      const outfit = res?.outfit || (resources ? resources.outfits[Math.floor(Math.random() * resources.outfits.length)] : "");
      const pose = res?.pose || (resources ? resources.poses[Math.floor(Math.random() * resources.poses.length)] : "");
      const location = res?.location || (resources ? resources.locations[Math.floor(Math.random() * resources.locations.length)] : "");
      const next = rebuildPromptWithTriplet(jobs[idx].prompt, { outfit, pose, location });
      updatePrompt(idx, next);
    } catch (e) {
      console.warn("Magic Fix fallo, aplicando relleno aleatorio", e);
      const outfit = resources ? resources.outfits[Math.floor(Math.random() * resources.outfits.length)] : "";
      const pose = resources ? resources.poses[Math.floor(Math.random() * resources.poses.length)] : "";
      const location = resources ? resources.locations[Math.floor(Math.random() * resources.locations.length)] : "";
      const next = rebuildPromptWithTriplet(jobs[idx].prompt, { outfit, pose, location });
      updatePrompt(idx, next);
    } finally {
      setLoading(false);
    }
  };

  const analyzeLore = async (character: string) => {
    try {
      setLoading(true);
      setError(null);
      const tags = metaByCharacter[character]?.trigger_words || [];
      const { jobs: newJobs, lore } = await postPlannerAnalyze(character, tags);
      if (Array.isArray(newJobs) && newJobs.length > 0) {
        setJobs((prev) => {
          const next = [...prev, ...newJobs];
          localStorage.setItem("planner_jobs", JSON.stringify(next));
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
      setSelected(new Set());
    } catch (e: any) {
      setError(e?.message || "Error al analizar lore");
    } finally {
      setLoading(false);
    }
  };

  // Eliminar todos los trabajos de un personaje y limpiar selección
  const deleteCharacter = (character: string) => {
    setJobs((prev) => {
      const next = prev.filter((j) => j.character_name !== character);
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
    setSelected(new Set());
  };

  const ensureTriplet = (prompt: string): string => {
    const t = extractTriplet(prompt);
    const pick = <T extends string>(arr?: T[], def: T = "casual" as T): T => {
      if (!arr || arr.length === 0) return def;
      return arr[Math.floor(Math.random() * arr.length)] as T;
    };
    const outfit = t.outfit && t.outfit.length > 0 ? t.outfit : pick(resources?.outfits, "casual");
    const pose = t.pose && t.pose.length > 0 ? t.pose : pick(resources?.poses, "standing");
    const location = t.location && t.location.length > 0 ? t.location : pick(resources?.locations, "studio");
    return rebuildPromptWithTriplet(prompt, { outfit, pose, location });
  };

  const startProduction = async () => {
    try {
      setLoading(true);
      setError(null);
      const { postPlannerExecute } = await import("../../lib/api");
      // Cargar metadatos desde localStorage y normalizar claves
      let resourcesMeta: ResourceMeta[] = [];
      try {
        const rawMeta = localStorage.getItem("planner_meta");
        if (rawMeta) {
          const parsed = JSON.parse(rawMeta) as any[];
          resourcesMeta = parsed.map((m: any) => ({
            character_name: m.character_name || m.name || "",
            download_url: m.download_url || m.downloadUrl || undefined,
            filename: m.filename || (m.character_name || m.name || "").toLowerCase().replace(/\s+/g, "_"),
          }));
          // Sanitización: no enviar entradas sin character_name o sin download_url
          resourcesMeta = resourcesMeta.filter((m) =>
            typeof m.character_name === "string" && m.character_name.trim().length > 0 &&
            typeof m.download_url === "string" && m.download_url.trim().length > 0
          );
        }
      } catch (e) {
        console.warn("planner_meta inválido o ausente", e);
      }
      // Asegurar que outfit/pose/location no estén vacíos y aplicar seed del panel técnico si existe
      const preparedJobs = jobs.map((j) => {
        const tech = techConfigByCharacter[j.character_name];
        return { ...j, prompt: ensureTriplet(j.prompt), seed: tech?.seed ?? (typeof j.seed === "number" ? j.seed : -1) } as any;
      });
      // Construir group_config por personaje desde Config Avanzada, recomendado y panel técnico
      const groupConfig = Object.keys(perCharacter).map((character) => {
        const conf = configByCharacter[character] ?? { hiresFix: true, denoising: 0.35, outputPath: `OUTPUTS_DIR/${character}/` };
        const rec = plannerContext[character]?.recommended_params;
        const tech = techConfigByCharacter[character] || {};
        return {
          character_name: character,
          hires_fix: tech.hiresFix ?? conf.hiresFix,
          denoising_strength: conf.denoising,
          output_path: conf.outputPath,
          steps: tech.steps ?? rec?.steps,
          cfg_scale: tech.cfg ?? rec?.cfg,
          sampler: tech.sampler ?? rec?.sampler,
          upscale_by: tech.upscaleBy,
        } as any;
      });
      try {
        await postPlannerExecute(preparedJobs, resourcesMeta);
      } catch (err) {
        console.warn("Planner execute falló", err);
        throw err;
      }
      router.push("/factory");
    } catch (e: any) {
      setError(e?.message || "Error iniciando producción");
    } finally {
      setLoading(false);
    }
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

  const toggleSelected = (idx: number) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx);
      else s.add(idx);
      return s;
    });
  };

  const deleteSelected = () => {
    setJobs((prev) => {
      const next = prev.filter((_, i) => !selected.has(i));
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
    setSelected(new Set());
  };

  const regenerateSelectedSeeds = () => {
    setJobs((prev) => {
      const next = prev.map((job, i) => {
        if (!selected.has(i)) return job;
        return { ...job, seed: Math.floor(Math.random() * 2_147_483_647) };
      });
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
  };

  // Controles globales
  const toggleAllDetailsGlobal = () => {
    if (!activeCharacter) return;
    const indices = perCharacter[activeCharacter]?.indices || [];
    setShowDetails((prev) => {
      if (prev.size === indices.length) return new Set();
      const s = new Set<number>();
      for (const idx of indices) {
        if (typeof idx === "number") s.add(idx);
      }
      return s;
    });
  };

  const regenerateAllSeeds = () => {
    if (!activeCharacter) return;
    const indices = perCharacter[activeCharacter]?.indices || [];
    setJobs((prev) => {
      const next = [...prev];
      for (const idx of indices) {
        if (typeof idx === "number") next[idx] = { ...next[idx], seed: Math.floor(Math.random() * 2_147_483_647) };
      }
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
  };

  const openQuickEdit = (row: number, field: "outfit" | "pose" | "location") => {
    setOpenEditor({ row, field });
  };

  const applyQuickEdit = (row: number, field: "outfit" | "pose" | "location", value: string) => {
    // Aplicar cambio y rellenar automáticamente cualquier otro campo vacío para evitar "(vacío)"
    const provisional = rebuildPromptWithTriplet(jobs[row].prompt, { [field]: value });
    const ensured = ensureTriplet(provisional);
    updatePrompt(row, ensured);
    setOpenEditor(null);
  };

  const applyExtrasEdit = (row: number, field: "lighting" | "camera", value: string) => {
    const currentExtras = extractExtras(jobs[row].prompt);
    const nextExtras = { ...currentExtras, [field]: value || undefined };
    const next = rebuildPromptWithExtras(jobs[row].prompt, nextExtras);
    updatePrompt(row, next);
  };

  const handleDeleteJob = (character: string, localIndex: number) => {
    const idx = perCharacter[character]?.indices[localIndex];
    if (typeof idx === "number") deleteRow(idx);
  };

  const getIntensity = (prompt: string): { label: "Safe" | "Ecchi" | "NSFW"; className: string } => {
    const low = (prompt || "").toLowerCase();
    if (low.includes("rating_explicit") || low.includes("nsfw")) return { label: "NSFW", className: "bg-red-600/30 border-red-600" };
    if (low.includes("rating_questionable") || low.includes("cleavage")) return { label: "Ecchi", className: "bg-orange-600/30 border-orange-600" };
    return { label: "Safe", className: "bg-emerald-600/30 border-emerald-600" };
  };

  const setIntensity = (idx: number, nextLabel: "Safe" | "Ecchi" | "NSFW") => {
    // Remover tags de rating existentes y aplicar nuevos según la intensidad
    const tokens = splitPrompt(jobs[idx].prompt);
    const core: string[] = [];
    const quality: string[] = [];
    for (const t of tokens) {
      if (QUALITY_SET.has(t.toLowerCase())) quality.push(t);
      else core.push(t);
    }
    const isRating = (s: string) => {
      const low = s.toLowerCase();
      return low === "rating_safe" || low === "rating_questionable" || low === "rating_explicit" || low === "explicit" || low === "nsfw";
    };
    const coreFiltered = core.filter((t) => !isRating(t));
    const qualityFiltered = quality.filter((t) => t.toLowerCase() !== "nsfw");
    let newRatings: string[] = [];
    if (nextLabel === "Safe") newRatings = ["rating_safe"];
    if (nextLabel === "Ecchi") newRatings = ["rating_questionable", "cleavage"];
    if (nextLabel === "NSFW") newRatings = ["rating_explicit", "nsfw", "explicit"];
    const nextTokens = [...newRatings, ...coreFiltered, ...qualityFiltered];
    updatePrompt(idx, nextTokens.join(", "));
  };

  const toggleDetails = (idx: number) => {
    setShowDetails((prev) => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx);
      else s.add(idx);
      return s;
    });
  };

  const copyParams = async (meta: Record<string, any>) => {
    try {
      const lines = [
        meta?.Prompt ? `Prompt: ${meta.Prompt}` : meta?.prompt ? `Prompt: ${meta.prompt}` : undefined,
        meta?.negativePrompt ? `Negative: ${meta.negativePrompt}` : undefined,
        meta?.Steps !== undefined ? `Steps: ${meta.Steps}` : undefined,
        meta?.["CFG scale"] !== undefined ? `CFG: ${meta["CFG scale"]}` : undefined,
        meta?.Sampler ? `Sampler: ${meta.Sampler}` : undefined,
        meta?.Seed !== undefined ? `Seed: ${meta.Seed}` : undefined,
      ].filter(Boolean) as string[];
      const text = lines.join("\n");
      await navigator.clipboard?.writeText(text);
      alert("Parámetros copiados al portapapeles");
    } catch (e) {
      console.warn("No se pudieron copiar parámetros", e);
    }
  };

  const cloneStyle = (character: string, meta: Record<string, any>) => {
    const base = plannerContext[character]?.base_prompt || jobs.find((j) => j.character_name === character)?.prompt || "";
    const extras = extractExtras((meta?.prompt as string) || (meta?.Prompt as string) || "");
    // Elegir outfit/pose/location aleatoriamente
    const outfit = resources ? resources.outfits[Math.floor(Math.random() * resources.outfits.length)] : "";
    const pose = resources ? resources.poses[Math.floor(Math.random() * resources.poses.length)] : "";
    const location = resources ? resources.locations[Math.floor(Math.random() * resources.locations.length)] : "";
    // Construir prompt mezclando base + extras + tripleta
    const pre = [base];
    if (extras.camera) pre.push(extras.camera);
    if (extras.lighting) pre.push(extras.lighting);
    const prompt = rebuildPromptWithTriplet(pre.join(", "), { outfit, pose, location });
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const newJob: PlannerJob = { character_name: character, prompt, seed };
    setJobs((prev) => {
      const next = [...prev, newJob];
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
  };

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/20">
            <Radar className="h-8 w-8 text-violet-400" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">Plan vacío</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Aún no hay jobs generados. Usa el analizador de lore para construir un plan.
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
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
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

      <div className="space-y-6">
        {activeCharacter ? (
          <>
            {/* Sección Superior (Contexto & Config) */}
            <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden">
              <div className="p-4">
                <div className="grid grid-cols-12 gap-6 items-start">
                  {/* Col 1-3: Perfil */}
                  <div className="col-span-12 md:col-span-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                      {metaByCharacter[activeCharacter]?.image_url ? (
                        <img src={metaByCharacter[activeCharacter]!.image_url!} alt={activeCharacter} className="aspect-[2/3] w-full rounded-lg object-cover shadow-lg" />
                      ) : (
                        <div className="aspect-[2/3] w-full rounded-lg border border-slate-800 bg-slate-800/40 flex items-center justify-center text-xs text-slate-400">Sin imagen</div>
                      )}
                      <h2 className="mt-3 text-lg font-bold text-slate-100">{activeCharacter}</h2>
                      <button
                        onClick={() => deleteCharacter(activeCharacter)}
                        className="mt-3 w-full rounded-md border border-red-700 bg-red-700/20 px-3 py-2 text-sm font-medium text-red-100 hover:bg-red-700/30"
                      >
                        <Trash2 className="mr-2 inline-block h-4 w-4" /> Eliminar Personaje
                      </button>
                    </div>
                  </div>

                  {/* Col 4-12: Lore, Prompt Base, Config Técnica */}
                  <div className="col-span-12 md:col-span-9">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                      {/* Lore Context */}
                      <div>
                        <label className="text-xs uppercase tracking-wide text-slate-400">Lore Context</label>
                        <div className="mt-1 flex gap-2">
                          <textarea
                            value={loreByCharacter[activeCharacter] || ""}
                            onChange={(e) => setLoreByCharacter((prev) => { const next = { ...prev, [activeCharacter]: e.target.value }; localStorage.setItem("planner_lore", JSON.stringify(next)); return next; })}
                            className="h-20 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
                          />
                          <button onClick={() => analyzeLore(activeCharacter)} className="inline-flex items-center gap-2 rounded-md border border-indigo-700 bg-indigo-700/20 px-3 py-2 text-indigo-100 hover:bg-indigo-700/30">
                            <Search className="h-4 w-4" /> Analizar
                          </button>
                        </div>
                      </div>

                      {/* Prompt Base */}
                      <div className="mt-4">
                        <label className="text-xs uppercase tracking-wide text-slate-400">Prompt Base</label>
                        <textarea
                          value={plannerContext[activeCharacter]?.base_prompt || "(sin base_prompt)"}
                          readOnly
                          className="h-20 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
                        />
                      </div>

                      {/* Config A1111 */}
                      <div className="mt-4">
                        <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Config A1111 (Técnica)</div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          <div className="rounded-md border border-slate-700 bg-slate-950 p-3">
                            <label className="text-xs text-slate-400">Steps <span className="ml-1 font-mono text-[11px] text-slate-300">{techConfigByCharacter[activeCharacter]?.steps ?? plannerContext[activeCharacter]?.recommended_params?.steps ?? 30}</span></label>
                            <input type="range" min={1} max={60} value={techConfigByCharacter[activeCharacter]?.steps ?? plannerContext[activeCharacter]?.recommended_params?.steps ?? 30} onChange={(e) => setTechConfig(activeCharacter, { steps: Number(e.target.value) })} className="mt-2 w-full accent-blue-500" />
                          </div>
                          <div className="rounded-md border border-slate-700 bg-slate-950 p-3">
                            <label className="text-xs text-slate-400">CFG <span className="ml-1 font-mono text-[11px] text-slate-300">{techConfigByCharacter[activeCharacter]?.cfg ?? plannerContext[activeCharacter]?.recommended_params?.cfg ?? 7}</span></label>
                            <input type="range" min={1} max={20} step={0.5} value={techConfigByCharacter[activeCharacter]?.cfg ?? plannerContext[activeCharacter]?.recommended_params?.cfg ?? 7} onChange={(e) => setTechConfig(activeCharacter, { cfg: Number(e.target.value) })} className="mt-2 w-full accent-blue-500" />
                          </div>
                          <div className="rounded-md border border-slate-700 bg-slate-950 p-3">
                            <label className="text-xs text-slate-400">Sampler</label>
                            <select value={techConfigByCharacter[activeCharacter]?.sampler ?? plannerContext[activeCharacter]?.recommended_params?.sampler ?? "Euler a"} onChange={(e) => setTechConfig(activeCharacter, { sampler: e.target.value })} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-200">
                              <option>Euler a</option>
                              <option>Euler</option>
                              <option>DDIM</option>
                              <option>DPM++ 2M Karras</option>
                            </select>
                          </div>
                          <div className="rounded-md border border-slate-700 bg-slate-950 p-3">
                            <label className="text-xs text-slate-400">Seed</label>
                            <input type="number" value={techConfigByCharacter[activeCharacter]?.seed ?? -1} onChange={(e) => setTechConfig(activeCharacter, { seed: Number(e.target.value) })} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-200" />
                          </div>
                          <div className="rounded-md border border-slate-700 bg-slate-950 p-3">
                            <label className="text-xs text-slate-400">Hires Fix</label>
                            <div className="mt-2">
                              <input type="checkbox" checked={techConfigByCharacter[activeCharacter]?.hiresFix ?? (configByCharacter[activeCharacter]?.hiresFix ?? true)} onChange={(e) => setTechConfig(activeCharacter, { hiresFix: e.target.checked })} className="accent-blue-500" />
                            </div>
                          </div>
                          <div className="rounded-md border border-slate-700 bg-slate-950 p-3">
                            <label className="text-xs text-slate-400">Upscale by</label>
                            <select value={techConfigByCharacter[activeCharacter]?.upscaleBy ?? 1.5} onChange={(e) => setTechConfig(activeCharacter, { upscaleBy: Number(e.target.value) })} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-200">
                              <option value={1.0}>1.0x</option>
                              <option value={1.5}>1.5x</option>
                              <option value={2.0}>2.0x</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Sección Inferior: Cola de Producción */}
            <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden">
              <div className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-100">Cola de Producción (10 Jobs)</div>
                  <div className="flex items-center gap-2">
                    <button onClick={toggleAllDetailsGlobal} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">Expandir/Colapsar Todos</button>
                    <button onClick={regenerateAllSeeds} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"><RefreshCw className="h-3 w-3 inline" /> Regenerar Todas las Seeds</button>
                  </div>
                </div>
                <ul className="space-y-3">
                  {perCharacter[activeCharacter]?.jobs.slice(0, 10).map((job, i) => {
                    const idx = perCharacter[activeCharacter]!.indices[i];
                    const triplet = extractTriplet(job.prompt);
                    const intensity = getIntensity(job.prompt);
                    return (
                      <li key={`${activeCharacter}-${i}`} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                        {/* Header */}
                        <div onClick={() => toggleDetails(idx)} className="flex items-center justify-between border-b border-slate-700 pb-2 cursor-pointer">
                          {/* Zona Izquierda: Título */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">Job #{i + 1}</span>
                          </div>
                          {/* Zona Centro: Selector Intensidad (no colapsa) */}
                          <div className="flex items-center">
                            <select value={intensity.label} onClick={(e) => e.stopPropagation()} onChange={(e) => setIntensity(idx, e.target.value as any)} className={`rounded px-2 py-0.5 text-xs text-white ${intensity.className.replace("/30", "")}`}>
                              <option value="Safe">Safe</option>
                              <option value="Ecchi">Ecchi</option>
                              <option value="NSFW">NSFW</option>
                            </select>
                          </div>
                          {/* Zona Derecha: Acciones */}
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(activeCharacter, i); }} className="rounded-md border border-red-700 bg-red-700/20 px-2 py-1 text-xs text-red-100 hover:bg-red-700/30">
                              <Trash2 className="h-3 w-3" aria-hidden />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); toggleDetails(idx); }} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">
                              {showDetails.has(idx) ? (<ChevronUp className="h-3 w-3" aria-hidden />) : (<ChevronDown className="h-3 w-3" aria-hidden />)}
                            </button>
                          </div>
                        </div>

                        {/* Body: selectores */}
                        <div className="pt-3">
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            <div>
                              <label className="text-xs text-slate-400">Outfit</label>
                              <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200" value={triplet.outfit || ""} onChange={(e) => applyQuickEdit(idx, "outfit", e.target.value)}>
                                <option value="">(vacío)</option>
                                {resources && resources.outfits.map((o) => (<option key={o} value={o}>{o}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Pose</label>
                              <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200" value={triplet.pose || ""} onChange={(e) => applyQuickEdit(idx, "pose", e.target.value)}>
                                <option value="">(vacío)</option>
                                {resources && resources.poses.map((p) => (<option key={p} value={p}>{p}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Location</label>
                              <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200" value={triplet.location || ""} onChange={(e) => applyQuickEdit(idx, "location", e.target.value)}>
                                <option value="">(vacío)</option>
                                {resources && resources.locations.map((l) => (<option key={l} value={l}>{l}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Lighting</label>
                              <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200" value={extractExtras(job.prompt).lighting || ""} onChange={(e) => applyExtrasEdit(idx, "lighting", e.target.value)}>
                                <option value="">(vacío)</option>
                                {resources && resources.lighting?.map((it) => (<option key={it} value={it}>{it}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400">Camera</label>
                              <select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200" value={extractExtras(job.prompt).camera || ""} onChange={(e) => applyExtrasEdit(idx, "camera", e.target.value)}>
                                <option value="">(vacío)</option>
                                {resources && resources.camera?.map((it) => (<option key={it} value={it}>{it}</option>))}
                              </select>
                            </div>
                          </div>

                          {/* Footer acciones */}
                          <div className="mt-3 flex items-center justify-end gap-2">
                            <button onClick={() => magicFix(idx)} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-indigo-700 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-900/40 disabled:opacity-60">
                              <Wand2 className="h-4 w-4" /> <span>Magic Fix</span>
                            </button>
                            <button onClick={() => { const ensured = ensureTriplet(jobs[idx].prompt); updatePrompt(idx, ensured); }} className="inline-flex items-center gap-2 rounded-md border border-emerald-700 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40">
                              <Cog className="h-4 w-4" /> <span>Aplicar</span>
                            </button>
                            <button onClick={() => regenerateSeed(idx)} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                              <RefreshCw className="h-4 w-4" /> <span>Regenerar</span>
                            </button>
                            <button onClick={() => toggleDetails(idx)} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                              <Camera className="h-4 w-4" /> <span>Ver Prompt</span>
                            </button>
                          </div>

                          {/* Área Expandible */}
                          {showDetails.has(idx) && (
                            <div className="mt-3 rounded-md border border-slate-700 bg-slate-800/40 p-2 text-sm text-slate-200">
                              {job.prompt}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-300">Selecciona un personaje</div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-0 right-0 mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-3 backdrop-blur">
            <span className="text-sm text-zinc-300">{selected.size} seleccionadas</span>
            <div className="flex items-center gap-2">
              <button
                onClick={deleteSelected}
                className="inline-flex items-center gap-2 rounded-md border border-red-600 bg-red-600/20 px-3 py-1.5 text-xs text-red-100 hover:bg-red-600/30 cursor-pointer transition-all"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Eliminar seleccionadas
              </button>
              <button
                onClick={regenerateSelectedSeeds}
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-slate-800 cursor-pointer transition-all"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Regenerar Seed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}