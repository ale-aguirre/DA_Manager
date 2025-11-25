"use client";
import React from "react";
import {
  Wand2,
  Trash2,
  RefreshCw,
  Play,
  Radar,
  Search,
  Cog,
  Camera,
  ChevronDown,
  ChevronUp,
  Bot,
  Loader2,
  Brain,
  User,
  Shirt,
  MapPin,
  Zap,
  Save,
  Shuffle,
  Plus,
  CheckCircle,
} from "lucide-react";
import type { PlannerJob } from "../../types/planner";
import {
  magicFixPrompt,
  getPlannerResources,
  postPlannerAnalyze,
  getReforgeCheckpoints,
  postReforgeSetCheckpoint,
  getLocalLoras,
  getReforgeVAEs,
  getReforgeOptions,
  postPlannerDraft,
  getLocalLoraInfo,
  getReforgeUpscalers,
  postReforgeRefresh,
} from "../../lib/api";
import { useRouter } from "next/navigation";
import type { ResourceMeta } from "../../lib/api";

// Palabras de calidad para detectar el segmento final del prompt
const QUALITY_SET = new Set([
  "masterpiece",
  "best quality",
  "absurdres",
  "nsfw",
]);

// Estándar de oro para Negative Prompt (Anime)
// Nota: NO incluir "nsfw" aquí para no bloquear contenidos NSFW cuando la intensidad lo requiera.
const DEFAULT_NEGATIVE_ANIME =
  "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name";

function splitPrompt(prompt: string): string[] {
  return (prompt || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function extractTriplet(prompt: string): {
  outfit?: string;
  pose?: string;
  location?: string;
} {
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

function rebuildPromptWithTriplet(
  original: string,
  nextTriplet: { outfit?: string; pose?: string; location?: string }
): string {
  const tokens = splitPrompt(original);
  const core: string[] = [];
  const quality: string[] = [];
  for (const t of tokens) {
    if (QUALITY_SET.has(t.toLowerCase())) quality.push(t);
    else core.push(t);
  }
  // Asegurar que hay al menos 3 posiciones al final para outfit/pose/location
  while (core.length < 3) core.push("");
  if (nextTriplet.outfit !== undefined)
    core[core.length - 3] = nextTriplet.outfit;
  if (nextTriplet.pose !== undefined) core[core.length - 2] = nextTriplet.pose;
  if (nextTriplet.location !== undefined)
    core[core.length - 1] = nextTriplet.location;
  const all = [...core, ...quality];
  return all.join(", ");
}

// Heurística para extraer Lighting y Camera cuando existan en el prompt
function extractExtras(prompt: string): {
  lighting?: string;
  camera?: string;
  expression?: string;
  hairstyle?: string;
} {
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
      "soft lighting",
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
      "front view",
      "cowboy shot",
    ].some((k) => low.includes(k));
  };
  const EXPRESSION_HINTS = [
    "smile",
    "blushing",
    "angry",
    "crying",
    "ahegao",
    "wink",
    "shy",
    "confident",
    "surprised",
    "determined",
    "smug",
    "pout",
    "teary eyes",
    "embarrassed",
    "happy",
  ];
  const HAIRSTYLE_HINTS = [
    "ponytail",
    "twintails",
    "bob cut",
    "long hair",
    "braid",
    "side ponytail",
    "messy hair",
    "bun",
    "short hair",
    "wavy hair",
    "curly hair",
    "straight hair",
    "half up",
    "half down",
  ];
  const isExpression = (s: string) =>
    EXPRESSION_HINTS.includes(s.toLowerCase());
  const isHairstyle = (s: string) => HAIRSTYLE_HINTS.includes(s.toLowerCase());
  let lighting: string | undefined;
  let camera: string | undefined;
  let expression: string | undefined;
  let hairstyle: string | undefined;
  for (const t of scan) {
    if (!lighting && isLighting(t)) lighting = t;
    if (!camera && isCamera(t)) camera = t;
    if (!expression && isExpression(t)) expression = t;
    if (!hairstyle && isHairstyle(t)) hairstyle = t;
    if (lighting && camera && expression && hairstyle) break;
  }
  return { lighting, camera, expression, hairstyle };
}

function rebuildPromptWithExtras(
  original: string,
  extras: {
    lighting?: string;
    camera?: string;
    expression?: string;
    hairstyle?: string;
  }
) {
  const tokens = splitPrompt(original);
  const core: string[] = [];
  const quality: string[] = [];
  for (const t of tokens) {
    if (QUALITY_SET.has(t.toLowerCase())) quality.push(t);
    else core.push(t);
  }
  const EXPRESSION_HINTS = [
    "smile",
    "blushing",
    "angry",
    "crying",
    "ahegao",
    "wink",
    "shy",
    "confident",
    "surprised",
    "determined",
    "smug",
    "pout",
    "teary eyes",
    "embarrassed",
    "happy",
  ];
  const HAIRSTYLE_HINTS = [
    "ponytail",
    "twintails",
    "bob cut",
    "long hair",
    "braid",
    "side ponytail",
    "messy hair",
    "bun",
    "short hair",
    "wavy hair",
    "curly hair",
    "straight hair",
    "half up",
    "half down",
  ];
  const tail = core.slice(-3);
  const head = core.slice(0, Math.max(0, core.length - 3)).filter((t) => {
    const low = t.toLowerCase();
    const isLight = [
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
      "soft lighting",
    ].some((k) => low.includes(k));
    const isCam = [
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
      "front view",
      "cowboy shot",
    ].some((k) => low.includes(k));
    const isExpr = EXPRESSION_HINTS.includes(low);
    const isHair = HAIRSTYLE_HINTS.includes(low);
    return !(isLight || isCam || isExpr || isHair);
  });
  const pre: string[] = [];
  if (extras.camera) pre.push(extras.camera);
  if (extras.expression) pre.push(extras.expression);
  if (extras.hairstyle) pre.push(extras.hairstyle);
  if (extras.lighting) pre.push(extras.lighting);
  const nextCore = [...pre, ...head, ...tail];
  return [...nextCore, ...quality].join(", ");
}

export default function PlannerView() {
  const [jobs, setJobs] = React.useState<PlannerJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
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
  const [openEditor, setOpenEditor] = React.useState<{
    row: number;
    field: "outfit" | "pose" | "location";
  } | null>(null);
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
  const [configOpen, setConfigOpen] = React.useState<Record<string, boolean>>(
    {}
  );
  const [intensityTick, setIntensityTick] = React.useState(0);
  const [allowExtraLorasByCharacter, setAllowExtraLorasByCharacter] =
    React.useState<Record<string, boolean>>(() => {
      try {
        const raw = localStorage.getItem("planner_allow_extra_loras");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    });
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
  const [localLoras, setLocalLoras] = React.useState<string[]>([]);
  const [lorasPath, setLorasPath] = React.useState<string | null>(null);
  const [loraQuery, setLoraQuery] = React.useState<string>("");
  const [vaes, setVaes] = React.useState<string[]>([]);
  const [reforgeUpscalers, setReforgeUpscalers] = React.useState<string[]>([]);
  const [refreshingUpscalers, setRefreshingUpscalers] = React.useState(false);
  const [upscalerVersion, setUpscalerVersion] = React.useState(0);
  const [reforgeOptions, setReforgeOptionsState] = React.useState<{
    current_vae: string;
    current_clip_skip: number;
  } | null>(null);
  const [paramTab, setParamTab] = React.useState<
    "generation" | "hires" | "adetailer"
  >("generation");
  const [rightTab, setRightTab] = React.useState<"personajes" | "helpers">(
    "personajes"
  );
  const [refreshingCheckpoints, setRefreshingCheckpoints] =
    React.useState(false);
  const [dryRunOpen, setDryRunOpen] = React.useState(false);
  const [dryRunPayload, setDryRunPayload] = React.useState<string>("");
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
      } catch {}
      return next;
    });
  };
  const [showDetails, setShowDetails] = React.useState<Set<number>>(new Set());
  const [activeCharacter, setActiveCharacter] = React.useState<string | null>(
    null
  );

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

  // Aplicar defaults (Negative/Steps/CFG y más) y preset global al cambiar de personaje
  React.useEffect(() => {
    if (!activeCharacter) return;
    const tech = techConfigByCharacter[activeCharacter] || {};
    let preset: Record<string, unknown> | null = null;
    try {
      const raw = localStorage.getItem("planner_preset_global");
      if (raw) preset = JSON.parse(raw);
    } catch {}
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
          : DEFAULT_NEGATIVE_ANIME;
      patchTech.negativePrompt = presetNeg;
    }
    if (typeof tech.steps !== "number") {
      patchTech.steps =
        preset && typeof preset.steps === "number" ? preset.steps : 30;
    }
    if (typeof tech.cfg !== "number") {
      patchTech.cfg = preset && typeof preset.cfg === "number" ? preset.cfg : 7;
    }
    // Nuevos campos del preset global
    if (typeof tech.batch_size !== "number") {
      patchTech.batch_size =
        preset && typeof preset.batch_size === "number" ? preset.batch_size : 1;
    }
    if (typeof tech.batch_count !== "number") {
      patchTech.batch_count =
        preset && typeof preset.batch_count === "number"
          ? preset.batch_count
          : 10;
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
              outputPath: `OUTPUTS_DIR/${activeCharacter}/`,
            }),
            denoising: nextDenoise,
          },
        };
        try {
          localStorage.setItem("planner_config", JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [activeCharacter]);

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

  // Cargar VAEs y opciones actuales de ReForge
  React.useEffect(() => {
    (async () => {
      try {
        const [vNames, opts, upNames] = await Promise.all([
          getReforgeVAEs().catch(() => []),
          getReforgeOptions().catch(() => ({
            current_vae: "Automatic",
            current_clip_skip: 1,
          })),
          getReforgeUpscalers().catch(() => []),
        ]);
        setVaes(Array.isArray(vNames) ? vNames : []);
        setReforgeOptionsState(opts || null);
        {
          const list = Array.isArray(upNames)
            ? Array.from(new Set([...upNames, "Latent"]))
            : ["Latent"];
          setReforgeUpscalers(list);
        }
      } catch (e) {
        console.warn("Error cargando VAEs/opciones/upscalers", e);
      }
    })();
  }, []);

  const refreshUpscalers = async () => {
    try {
      setRefreshingUpscalers(true);
      const upNames = await getReforgeUpscalers();
      const list = Array.isArray(upNames)
        ? Array.from(new Set([...upNames, "Latent"]))
        : ["Latent"];
      setReforgeUpscalers(list);
      setUpscalerVersion((v) => v + 1);
      if (activeCharacter) {
        const current = techConfigByCharacter[activeCharacter]?.upscaler ?? "";
        if (current && Array.isArray(upNames) && !upNames.includes(current)) {
          setTechConfig(activeCharacter, { upscaler: "" });
        } else if (current && !Array.isArray(upNames)) {
          setTechConfig(activeCharacter, { upscaler: "" });
        }
      }
    } catch (e) {
      setToast({ message: "❌ Error al actualizar Upscalers" });
      setTimeout(() => setToast(null), 2500);
    } finally {
      setRefreshingUpscalers(false);
    }
  };

  React.useEffect(() => {
    // Si no hay lore para el personaje activo, cargarlo automáticamente
    if (!activeCharacter) return;
    const existing = loreByCharacter[activeCharacter];
    if (!existing) {
      analyzeLore(activeCharacter);
    }
  }, [activeCharacter]);

  // Auto-ajuste de Clip Skip = 2 para checkpoints Anime/Pony si el usuario aún no lo definió
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

  React.useEffect(() => {
    // Cargar checkpoints disponibles
    (async () => {
      try {
        const cps = await getReforgeCheckpoints();
        setCheckpoints(cps);
        if (activeCharacter) {
          const current =
            techConfigByCharacter[activeCharacter]?.checkpoint ?? "";
          const first = cps && cps.length > 0 ? cps[0] : "";
          if (!current && first) {
            setTechConfig(activeCharacter, { checkpoint: first });
            try {
              await postReforgeSetCheckpoint(first);
            } catch {}
          }
        }
      } catch (e) {
        console.warn("No se pudieron cargar checkpoints:", e);
        setToast({ message: "❌ Error: no se pudieron cargar checkpoints" });
        setTimeout(() => setToast(null), 2500);
      }
    })();
  }, []);
  const refreshCheckpoints = async () => {
    try {
      setRefreshingCheckpoints(true);
      setCheckpoints([]);
      setCheckpointVersion((v) => v + 1);
      try {
        await postReforgeRefresh();
      } catch {}
      await new Promise((r) => setTimeout(r, 2000));
      const cps = await getReforgeCheckpoints();
      setCheckpoints(cps);
      if (activeCharacter) {
        const current =
          techConfigByCharacter[activeCharacter]?.checkpoint ?? "";
        if (!current) {
          const first = cps && cps.length > 0 ? cps[0] : "";
          if (first) {
            setTechConfig(activeCharacter, { checkpoint: first });
            try {
              await postReforgeSetCheckpoint(first);
            } catch {}
          }
        } else if (!cps.includes(current)) {
          const first = cps && cps.length > 0 ? cps[0] : "";
          if (first) setTechConfig(activeCharacter, { checkpoint: first });
        }
      }
      setCheckpointVersion((v) => v + 1);
    } catch (e) {
      console.warn("Refresh checkpoints falló", e);
      setToast({ message: "❌ Error al actualizar checkpoints" });
      setTimeout(() => setToast(null), 2500);
    } finally {
      setRefreshingCheckpoints(false);
    }
  };

  React.useEffect(() => {
    // Cargar LoRAs locales
    (async () => {
      try {
        const { files, path } = await getLocalLoras();
        setLocalLoras(files);
        setLorasPath(path || null);
      } catch (e) {
        console.warn("No se pudieron cargar LoRAs locales:", e);
        setToast({ message: "❌ Error: no se pudieron cargar LoRAs locales" });
        setTimeout(() => setToast(null), 2500);
      }
    })();
  }, []);
  const refreshLocalLoras = async () => {
    try {
      setLocalLoras([]);
      const { files, path } = await getLocalLoras();
      setLocalLoras(files);
      setLorasPath(path || null);
    } catch (e) {
      console.warn("Refresh LoRAs falló", e);
      setToast({ message: "❌ Error al actualizar LoRAs" });
      setTimeout(() => setToast(null), 2500);
    }
  };

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

  // Cargar contexto enriquecido por personaje
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

  // Agrupar jobs por personaje (indices + jobs)
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

  // Slider visual personalizado (barra gris con relleno azul). No usa input range.
  // Calcula porcentaje y permite clic para ajustar valor. Reusa para Steps, CFG, Denoise, Hires Steps.
  const SliderBar = ({
    value,
    min,
    max,
    step = 1,
    onChange,
  }: {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (v: number) => void;
  }) => {
    const pct = Math.max(
      0,
      Math.min(100, ((value - min) / Math.max(1, max - min)) * 100)
    );
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const p = Math.max(0, Math.min(1, x / rect.width));
      const raw = min + p * (max - min);
      // Ajuste por step (soporta decimales)
      const scaled = Math.round(raw / step) * step;
      const fixed = Number(scaled.toFixed(2));
      onChange(Math.max(min, Math.min(max, fixed)));
    };
    return (
      <div
        className="mt-2 w-full h-4 bg-slate-700 rounded cursor-pointer"
        onClick={handleClick}
      >
        <div style={{ width: `${pct}%` }} className="h-4 bg-blue-600 rounded" />
      </div>
    );
  };

  const magicFix = async (idx: number) => {
    try {
      setLoading(true);
      setToast({ message: "🧠 La IA está optimizando tu prompt..." });
      const res = await magicFixPrompt(jobs[idx].prompt);
      // Si Magic Fix falla o devuelve vacío, rellenar aleatorio
      const outfit =
        res?.outfit ||
        (resources
          ? resources.outfits[
              Math.floor(Math.random() * resources.outfits.length)
            ]
          : "");
      const pose =
        res?.pose ||
        (resources
          ? resources.poses[Math.floor(Math.random() * resources.poses.length)]
          : "");
      const location =
        res?.location ||
        (resources
          ? resources.locations[
              Math.floor(Math.random() * resources.locations.length)
            ]
          : "");
      const next = rebuildPromptWithTriplet(jobs[idx].prompt, {
        outfit,
        pose,
        location,
      });
      updatePrompt(idx, next);
      try {
        const msg =
          typeof res?.ai_reasoning === "string" &&
          res.ai_reasoning.trim().length > 0
            ? res.ai_reasoning
            : `✨ Prompt mejorado con estilo UserStyles`;
        setAiReasoningByJob((prev) => ({ ...prev, [idx]: msg }));
        setToast({ message: msg });
        setTimeout(() => setToast(null), 3000);
      } catch {}
    } catch (e) {
      console.warn("Magic Fix fallo, aplicando relleno aleatorio", e);
      const outfit = resources
        ? resources.outfits[
            Math.floor(Math.random() * resources.outfits.length)
          ]
        : "";
      const pose = resources
        ? resources.poses[Math.floor(Math.random() * resources.poses.length)]
        : "";
      const location = resources
        ? resources.locations[
            Math.floor(Math.random() * resources.locations.length)
          ]
        : "";
      const next = rebuildPromptWithTriplet(jobs[idx].prompt, {
        outfit,
        pose,
        location,
      });
      updatePrompt(idx, next);
      const msg = "✨ IA: Fallback aplicado con elementos aleatorios.";
      setAiReasoningByJob((prev) => ({ ...prev, [idx]: msg }));
      setToast({ message: msg });
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoading(false);
    }
  };

  const analyzeLore = async (character: string) => {
    try {
      setLoading(true);
      setError(null);
      setToast({ message: "🧠 La IA está optimizando tu prompt..." });
      const tags = metaByCharacter[character]?.trigger_words || [];
      const batchCount = techConfigByCharacter[character]?.batch_count ?? 10;
      const {
        jobs: newJobs,
        lore,
        ai_reasoning,
      } = await postPlannerAnalyze(character, tags, batchCount);
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
      try {
        const msg =
          typeof ai_reasoning === "string" && ai_reasoning.trim().length > 0
            ? ai_reasoning
            : `✨ Prompt mejorado con estilo UserStyles`;
        setAiReasoningByCharacter((prev) => ({ ...prev, [character]: msg }));
        setToast({ message: msg });
        setTimeout(() => setToast(null), 3500);
      } catch {}
      setSelected(new Set());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Error al analizar lore");
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
    const outfit =
      t.outfit && t.outfit.length > 0
        ? t.outfit
        : pick(resources?.outfits, "casual");
    const pose =
      t.pose && t.pose.length > 0 ? t.pose : pick(resources?.poses, "standing");
    const location =
      t.location && t.location.length > 0
        ? t.location
        : pick(resources?.locations, "studio");
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
          const parsed = JSON.parse(rawMeta) as unknown[];
          resourcesMeta = parsed.map((m) => {
            const obj = m as {
              character_name?: string;
              name?: string;
              download_url?: string;
              downloadUrl?: string;
              filename?: string;
            };
            const character = obj.character_name || obj.name || "";
            const download = obj.download_url || obj.downloadUrl || undefined;
            const filename =
              obj.filename || character.toLowerCase().replace(/\s+/g, "_");
            return {
              character_name: character,
              download_url: download,
              filename,
            };
          });
          // Sanitización: no enviar entradas sin character_name o sin download_url
          resourcesMeta = resourcesMeta.filter(
            (m) =>
              typeof m.character_name === "string" &&
              m.character_name.trim().length > 0 &&
              typeof m.download_url === "string" &&
              m.download_url.trim().length > 0
          );
        }
      } catch (e) {
        console.warn("planner_meta inválido o ausente", e);
      }
      // Obtener triggers oficiales desde backend cuando no hay base_prompt
      const preparedJobs: PlannerJob[] = await (async () => {
        const out: PlannerJob[] = [];
        const cache: Record<string, string[]> = {};
        for (const j of jobs) {
          const tech = techConfigByCharacter[j.character_name];
          const base = plannerContext[j.character_name]?.base_prompt || "";
          const bodyPrompt = ensureTriplet(j.prompt);
          const sanitize = (s: string) =>
            s
              .toLowerCase()
              .replace(/\s+/g, "_")
              .replace(/[^a-z0-9_\-]/g, "");
          const loraTag = `<lora:${sanitize(j.character_name)}:0.8>`;
          const qualityEnd = "masterpiece, best quality, absurdres";
          let trigList: string[] = [];
          if (!base || base.trim().length === 0) {
            if (cache[j.character_name]) {
              trigList = cache[j.character_name];
            } else {
              try {
                const info = await getLocalLoraInfo(j.character_name);
                trigList = Array.isArray(info?.trainedWords)
                  ? info.trainedWords
                  : [];
                cache[j.character_name] = trigList;
              } catch {
                trigList =
                  metaByCharacter[j.character_name]?.trigger_words || [];
              }
            }
          }
          const trig = (
            trigList.length > 0 ? trigList : [j.character_name]
          ).join(", ");
          const finalPrompt =
            base && base.trim().length > 0
              ? `${base.trim()}, ${bodyPrompt}`
              : `${loraTag}, ${trig}, ${bodyPrompt}, ${qualityEnd}`;
          out.push({
            ...j,
            prompt: finalPrompt,
            seed: tech?.seed ?? (typeof j.seed === "number" ? j.seed : -1),
            negative_prompt: tech?.negativePrompt,
          });
        }
        return out;
      })();
      // Construir group_config por personaje desde Config Avanzada, recomendado y panel técnico
      const groupConfig: import("../../lib/api").GroupConfigItem[] =
        Object.keys(perCharacter).map((character) => {
          const conf = configByCharacter[character] ?? {
            hiresFix: true,
            denoising: 0.35,
            outputPath: `OUTPUTS_DIR/${character}/`,
          };
          const rec = plannerContext[character]?.recommended_params;
          const tech = techConfigByCharacter[character] || {};
          return {
            character_name: character,
            hires_fix: tech.hiresFix ?? conf.hiresFix ?? true,
            denoising_strength: conf.denoising,
            output_path: conf.outputPath,
            steps: tech.steps ?? rec?.steps ?? 30,
            cfg_scale: tech.cfg ?? rec?.cfg ?? 7,
            sampler: tech.sampler ?? rec?.sampler,
            upscale_by: tech.upscaleBy,
            upscaler: tech.upscaler,
            checkpoint: tech.checkpoint,
            width: typeof tech.width === "number" ? tech.width : 832,
            height: typeof tech.height === "number" ? tech.height : 1216,
            adetailer_model:
              tech.adetailer ?? true ? "face_yolov8n.pt" : undefined,
            extra_loras: tech.extraLoras,
            hires_steps: tech.hiresSteps,
            batch_size: tech.batch_size ?? 1,
            adetailer: tech.adetailer ?? true,
            vae: tech.vae,
            clip_skip: tech.clipSkip,
          };
        });
      try {
        const { postPlannerExecuteV2 } = await import("../../lib/api");
        await postPlannerExecuteV2(preparedJobs, resourcesMeta, groupConfig);
      } catch (err) {
        console.warn("Planner execute v2 falló", err);
        throw err;
      }
      router.push("/factory");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Error iniciando producción");
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

  const deleteSelected = () => {
    setJobs((prev) => {
      const next = prev.filter((_, i) => !selected.has(i));
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
    setSelected(new Set());
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

  

  const applyQuickEdit = (
    row: number,
    field: "outfit" | "pose" | "location",
    value: string
  ) => {
    // Aplicar cambio y rellenar automáticamente cualquier otro campo vacío para evitar "(vacío)"
    const provisional = rebuildPromptWithTriplet(jobs[row].prompt, {
      [field]: value,
    });
    const ensured = ensureTriplet(provisional);
    updatePrompt(row, ensured);
    setOpenEditor(null);
  };

  const applyExtrasEdit = (
    row: number,
    field: "lighting" | "camera" | "expression" | "hairstyle",
    value: string
  ) => {
    const currentExtras = extractExtras(jobs[row].prompt);
    const nextExtras = { ...currentExtras, [field]: value || undefined };
    const next = rebuildPromptWithExtras(jobs[row].prompt, nextExtras);
    updatePrompt(row, next);
  };

  const handleDeleteJob = (character: string, localIndex: number) => {
    const idx = perCharacter[character]?.indices[localIndex];
    if (typeof idx === "number") deleteRow(idx);
  };

  const getIntensity = (
    prompt: string
  ): { label: "SFW" | "ECCHI" | "NSFW"; className: string } => {
    const low = (prompt || "").toLowerCase();
    if (low.includes("rating_explicit") || low.includes("nsfw"))
      return {
        label: "NSFW",
        className: "bg-red-600 text-white border-red-700",
      };
    if (low.includes("rating_questionable") || low.includes("cleavage"))
      return {
        label: "ECCHI",
        className: "bg-yellow-500 text-black border-yellow-600",
      };
    return {
      label: "SFW",
      className: "bg-green-600 text-white border-green-700",
    };
  };

  const IntensitySelector: React.FC<{
    value: "SFW" | "ECCHI" | "NSFW";
    onChange: (v: "SFW" | "ECCHI" | "NSFW") => void;
    stop?: (e: React.MouseEvent) => void;
  }> = ({ value, onChange, stop }) => {
    const [open, setOpen] = React.useState(false);
    const styles: Record<
      "SFW" | "ECCHI" | "NSFW",
      { trigger: string; text: string; hover: string }
    > = {
      SFW: {
        trigger: "bg-green-600 text-white border-green-700",
        text: "text-green-400",
        hover: "hover:bg-green-700/30",
      },
      ECCHI: {
        trigger: "bg-yellow-500 text-black border-yellow-600",
        text: "text-yellow-400",
        hover: "hover:bg-yellow-600/30",
      },
      NSFW: {
        trigger: "bg-red-600 text-white border-red-700",
        text: "text-red-400",
        hover: "hover:bg-red-700/30",
      },
    };
    const st = styles[value];
    return (
      <div className="relative" onClick={(e) => (stop ? stop(e) : undefined)}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border ${st.trigger}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {value}
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
        {open && (
          <div
            className="absolute right-0 z-20 mt-1 w-28 rounded border border-slate-700 bg-slate-900 shadow-lg"
            role="listbox"
          >
            {(["SFW", "ECCHI", "NSFW"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`block w-full text-left px-2 py-1 text-xs ${styles[opt].text} ${styles[opt].hover}`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            ))}
            </div>
      )}
      </div>
    );
  };

  const setIntensity = (idx: number, nextLabel: "SFW" | "ECCHI" | "NSFW") => {
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

    // Unir todo: ratings + core + quality
    // Filtrar duplicados simples
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
    setIntensityTick((x) => x + 1);
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
                let resourcesMeta: ResourceMeta[] = [];
                try {
                  const rawMeta = localStorage.getItem("planner_meta");
                  if (rawMeta) {
                    const parsed = JSON.parse(rawMeta) as unknown[];
                    resourcesMeta = parsed
                      .map((m) => {
                        const obj = m as {
                          character_name?: string;
                          name?: string;
                          download_url?: string;
                          downloadUrl?: string;
                          filename?: string;
                        };
                        const character = obj.character_name || obj.name || "";
                        const download =
                          obj.download_url || obj.downloadUrl || undefined;
                        const filename =
                          obj.filename ||
                          character.toLowerCase().replace(/\s+/g, "_");
                        return {
                          character_name: character,
                          download_url: download,
                          filename,
                        };
                      })
                      .filter(
                        (m) =>
                          typeof m.character_name === "string" &&
                          m.character_name.trim().length > 0 &&
                          typeof m.download_url === "string" &&
                          m.download_url.trim().length > 0
                      );
                  }
                } catch {}
                const preparedJobs: PlannerJob[] = [];
                for (const j of jobs) {
                  const tech = techConfigByCharacter[j.character_name];
                  const base =
                    plannerContext[j.character_name]?.base_prompt || "";
                  const bodyPrompt = ensureTriplet(j.prompt);
                  const sanitize = (s: string) =>
                    s
                      .toLowerCase()
                      .replace(/\s+/g, "_")
                      .replace(/[^a-z0-9_\-]/g, "");
                  const loraTag = `<lora:${sanitize(j.character_name)}:0.8>`;
                  const qualityEnd = "masterpiece, best quality, absurdres";
                  let trigList: string[] = [];
                  if (!base || base.trim().length === 0) {
                    try {
                      const info = await getLocalLoraInfo(j.character_name);
                      trigList = Array.isArray(info?.trainedWords)
                        ? info.trainedWords
                        : [];
                    } catch {
                      trigList =
                        metaByCharacter[j.character_name]?.trigger_words || [];
                    }
                  }
                  const trig = (
                    trigList.length > 0 ? trigList : [j.character_name]
                  ).join(", ");
                  const finalPrompt =
                    base && base.trim().length > 0
                      ? `${base.trim()}, ${bodyPrompt}`
                      : `${loraTag}, ${trig}, ${bodyPrompt}, ${qualityEnd}`;
                  preparedJobs.push({
                    ...j,
                    prompt: finalPrompt,
                    seed:
                      tech?.seed ?? (typeof j.seed === "number" ? j.seed : -1),
                    negative_prompt: tech?.negativePrompt,
                  });
                }
                const groupConfig = Object.keys(perCharacter).map(
                  (character) => {
                    const conf = configByCharacter[character] ?? {
                      hiresFix: true,
                      denoising: 0.35,
                      outputPath: `OUTPUTS_DIR/${character}/`,
                    };
                    const rec = plannerContext[character]?.recommended_params;
                    const tech = techConfigByCharacter[character] || {};
                    return {
                      character_name: character,
                      hires_fix: tech.hiresFix ?? conf.hiresFix ?? true,
                      denoising_strength: conf.denoising,
                      output_path: conf.outputPath,
                      steps: tech.steps ?? rec?.steps ?? 30,
                      cfg_scale: tech.cfg ?? rec?.cfg ?? 7,
                      sampler: tech.sampler ?? rec?.sampler,
                      upscale_by: tech.upscaleBy,
                      upscaler: tech.upscaler,
                      checkpoint: tech.checkpoint,
                      width: typeof tech.width === "number" ? tech.width : 832,
                      height:
                        typeof tech.height === "number" ? tech.height : 1216,
                      adetailer_model:
                        tech.adetailer ?? true ? "face_yolov8n.pt" : undefined,
                      extra_loras: tech.extraLoras,
                      hires_steps: tech.hiresSteps,
                      batch_size: tech.batch_size ?? 1,
                      adetailer: tech.adetailer ?? true,
                      vae: tech.vae,
                      clip_skip: tech.clipSkip,
                    };
                  }
                );
                let outputsPath = "";
                try {
                  const API_BASE =
                    process.env.NEXT_PUBLIC_API_BASE_URL ||
                    "http://127.0.0.1:8000";
                  const res = await fetch(`${API_BASE}/system/outputs-dir`);
                  if (res.ok) {
                    const j = await res.json();
                    outputsPath = j?.path || "";
                  }
                } catch {}
                const sanitize = (s: string) =>
                  s.replace(/[^a-zA-Z0-9_\-\s]/g, "_");
                const expected = groupConfig.map((gc) => {
                  const raw = (gc.output_path || "").trim();
                  const base = outputsPath || "OUTPUTS_DIR";
                  const name = sanitize(gc.character_name);
                  if (raw) {
                    const resolved = raw
                      .replace("OUTPUTS_DIR", base)
                      .replace("{Character}", name);
                    return { character: gc.character_name, path: resolved };
                  }
                  return {
                    character: gc.character_name,
                    path: `${base}/${name}/`,
                  };
                });
                const preview = {
                  jobs: preparedJobs,
                  resources_meta: resourcesMeta,
                  group_config: groupConfig,
                  outputs_dir: outputsPath,
                  expected_save_paths: expected,
                };
                setDryRunPayload(JSON.stringify(preview, null, 2));
                setDryRunOpen(true);
              } catch {}
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

      <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden">
        <div className="p-2">
          <div className="mb-3">
            <div className="section-title">
              <Cog className="section-title__icon" aria-hidden />
              <span>Panel Técnico</span>
              <span className="ml-auto"><EngineHealthIndicator /></span>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-6">
              <label className="text-xs text-slate-300">
                Stable Diffusion Checkpoint
              </label>
              <select
                value={
                  techConfigByCharacter[activeCharacter!]?.checkpoint ?? ""
                }
                onChange={async (e) => {
                  const title = e.target.value;
                  setTechConfig(activeCharacter, { checkpoint: title });
                  try {
                    if (title) await postReforgeSetCheckpoint(title);
                  } catch {}
                }}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                key={`ckpt-${checkpointVersion}`}
              >
                <option value="">(Sin cambio)</option>
                {checkpoints.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-xs text-slate-300">VAE</label>
              <select
                value={
                  techConfigByCharacter[activeCharacter!]?.vae ??
                  reforgeOptions?.current_vae ??
                  "Automatic"
                }
                onChange={(e) =>
                  setTechConfig(activeCharacter, { vae: e.target.value })
                }
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
              >
                <option value="Automatic">Automatic</option>
                {vaes.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-300">Clip Skip</label>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1">
                  {SliderBar({
                    value:
                      techConfigByCharacter[activeCharacter!]?.clipSkip ??
                      reforgeOptions?.current_clip_skip ??
                      1,
                    min: 1,
                    max: 4,
                    step: 1,
                    onChange: (v) =>
                      setTechConfig(activeCharacter, { clipSkip: v }),
                  })}
                </div>
                <input
                  type="number"
                  min={1}
                  max={4}
                  step={1}
                  value={
                    techConfigByCharacter[activeCharacter!]?.clipSkip ??
                    reforgeOptions?.current_clip_skip ??
                    1
                  }
                  onChange={(e) =>
                    setTechConfig(activeCharacter, {
                      clipSkip: Number(e.target.value),
                    })
                  }
                  className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                />
              </div>
            </div>
            <div className="col-span-1 flex items-center justify-end">
              <button
                onClick={async () => {
                  try {
                    await postReforgeRefresh();
                  } catch {}
                  await refreshUpscalers();
                  await refreshCheckpoints();
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                <RefreshCw className="h-3 w-3" /> Actualizar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden">
        <div className="p-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-9">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs text-slate-300">
                    Prompt Positivo
                  </label>
                  <textarea
                    value={plannerContext[activeCharacter!]?.base_prompt || ""}
                    onChange={(e) => {
                      const v = e.target.value;
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
                        } catch {}
                        return next;
                      });
                    }}
                    className="mt-2 h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300">
                    Prompt Negativo
                  </label>
                  <textarea
                    value={
                      techConfigByCharacter[activeCharacter!]?.negativePrompt ??
                      ""
                    }
                    onChange={(e) =>
                      setTechConfig(activeCharacter, {
                        negativePrompt: e.target.value,
                      })
                    }
                    className="mt-2 h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
                  />
                </div>
              </div>
            </div>
            <div className="col-span-3">
              <button
                onClick={startProduction}
                disabled={jobs.length === 0}
                className="w-full h-32 rounded-lg bg-green-600 text-white text-lg font-semibold hover:bg-green-500 disabled:opacity-60"
              >
                Generar
              </button>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    try {
                      localStorage.setItem(
                        "planner_jobs",
                        JSON.stringify(jobs)
                      );
                    } catch {}
                  }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Guardar
                </button>
                <button
                  onClick={() => deleteCharacter(activeCharacter!)}
                  className="rounded-md border border-red-700 bg-red-700/20 px-2 py-1 text-xs text-red-100 hover:bg-red-700/30"
                >
                  Borrar
                </button>
                <button
                  className="hidden"
                />
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

                  {/* Panel izquierdo: Lore Context y configuraciones del sistema */}
                  <div className="col-span-12 md:col-span-7 md:order-1">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="section-title"><Cog className="section-title__icon" aria-hidden /><span>Panel de Configuración</span></div>
                      {/* Lore Context */}
                      <div>
                        <label className="text-xs uppercase tracking-wide text-slate-400">
                          Lore Context
                        </label>
                        <div className="mt-1 flex gap-2">
                          <textarea
                            value={loreByCharacter[activeCharacter] || ""}
                            onChange={(e) =>
                              setLoreByCharacter((prev) => {
                                const next = {
                                  ...prev,
                                  [activeCharacter]: e.target.value,
                                };
                                localStorage.setItem(
                                  "planner_lore",
                                  JSON.stringify(next)
                                );
                                return next;
                              })
                            }
                            className="h-20 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
                          />
                          <button
                            onClick={() => analyzeLore(activeCharacter)}
                            className="inline-flex items-center gap-2 rounded-md border border-indigo-700 bg-indigo-700/20 px-3 py-2 text-indigo-100 hover:bg-indigo-700/30"
                          >
                            <Search className="h-4 w-4" /> Analizar
                          </button>
                          {loading && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-indigo-200">
                              <Brain className="h-4 w-4 animate-pulse" />{" "}
                              Pensando...
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-3">
                            <EngineHealthIndicator />
                          </div>
                        </div>
                        <div className="mb-3 flex items-center gap-2">
                          <button
                            onClick={() => setParamTab("generation")}
                            className={`rounded-md px-3 py-1 text-xs border ${
                              paramTab === "generation"
                                ? "border-slate-600 bg-slate-800 text-slate-100"
                                : "border-slate-700 bg-slate-900 text-slate-300"
                            }`}
                          >
                            Generation
                          </button>
                          <button
                            onClick={() => setParamTab("hires")}
                            className={`rounded-md px-3 py-1 text-xs border ${
                              paramTab === "hires"
                                ? "border-slate-600 bg-slate-800 text-slate-100"
                                : "border-slate-700 bg-slate-900 text-slate-300"
                            }`}
                          >
                            Hires. Fix
                          </button>
                          <button
                            onClick={() => setParamTab("adetailer")}
                            className={`rounded-md px-3 py-1 text-xs border ${
                              paramTab === "adetailer"
                                ? "border-slate-600 bg-slate-800 text-slate-100"
                                : "border-slate-700 bg-slate-900 text-slate-300"
                            }`}
                          >
                            ADetailer
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900 border border-slate-700 rounded-lg">
                          {paramTab === "generation" ? (
                            <div>
                              <div className="col-span-2 grid grid-cols-4 gap-4 items-end">
                                <div className="col-span-2">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs text-slate-300">
                                        Sampling method
                                      </label>
                                      <select
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.sampler ??
                                          plannerContext[activeCharacter]
                                            ?.recommended_params?.sampler ??
                                          "Euler a"
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            sampler: e.target.value,
                                          })
                                        }
                                        className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                                      >
                                        <option>Euler a</option>
                                        <option>Euler</option>
                                        <option>DDIM</option>
                                        <option>DPM++ 2M Karras</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-300">
                                        Schedule type
                                      </label>
                                      <select
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.schedulerType ?? "Automatic"
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            schedulerType: e.target.value,
                                          })
                                        }
                                        className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                                      >
                                        <option>Automatic</option>
                                        <option>Karras</option>
                                        <option>Default</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs text-slate-300">
                                    Steps
                                  </label>
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1">
                                      {SliderBar({
                                        value:
                                          techConfigByCharacter[activeCharacter]
                                            ?.steps ??
                                          plannerContext[activeCharacter]
                                            ?.recommended_params?.steps ??
                                          30,
                                        min: 1,
                                        max: 60,
                                        step: 1,
                                        onChange: (v) =>
                                          setTechConfig(activeCharacter, {
                                            steps: v,
                                          }),
                                      })}
                                    </div>
                                    <input
                                      type="number"
                                      value={
                                        techConfigByCharacter[activeCharacter]
                                          ?.steps ??
                                        plannerContext[activeCharacter]
                                          ?.recommended_params?.steps ??
                                        30
                                      }
                                      onChange={(e) =>
                                        setTechConfig(activeCharacter, {
                                          steps: Number(e.target.value),
                                        })
                                      }
                                      className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs text-slate-300">
                                    CFG
                                  </label>
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1">
                                      {SliderBar({
                                        value:
                                          techConfigByCharacter[activeCharacter]
                                            ?.cfg ??
                                          plannerContext[activeCharacter]
                                            ?.recommended_params?.cfg ??
                                          7,
                                        min: 1,
                                        max: 20,
                                        step: 0.5,
                                        onChange: (v) =>
                                          setTechConfig(activeCharacter, {
                                            cfg: v,
                                          }),
                                      })}
                                    </div>
                                    <input
                                      type="number"
                                      step={0.5}
                                      value={
                                        techConfigByCharacter[activeCharacter]
                                          ?.cfg ??
                                        plannerContext[activeCharacter]
                                          ?.recommended_params?.cfg ??
                                        7
                                      }
                                      onChange={(e) =>
                                        setTechConfig(activeCharacter, {
                                          cfg: Number(e.target.value),
                                        })
                                      }
                                      className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="col-span-2 grid grid-cols-2 gap-4">
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-xs text-slate-300">
                                      Width
                                    </label>
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="flex-1">
                                        {SliderBar({
                                          value:
                                            techConfigByCharacter[
                                              activeCharacter
                                            ]?.width ?? 832,
                                          min: 512,
                                          max: 2048,
                                          step: 8,
                                          onChange: (v) =>
                                            setTechConfig(activeCharacter, {
                                              width: v,
                                            }),
                                        })}
                                      </div>
                                      <input
                                        type="number"
                                        min={512}
                                        max={2048}
                                        step={8}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.width ?? 832
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            width: Number(e.target.value),
                                          })
                                        }
                                        className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-300">
                                      Height
                                    </label>
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="flex-1">
                                        {SliderBar({
                                          value:
                                            techConfigByCharacter[
                                              activeCharacter
                                            ]?.height ?? 1216,
                                          min: 512,
                                          max: 2048,
                                          step: 8,
                                          onChange: (v) =>
                                            setTechConfig(activeCharacter, {
                                              height: v,
                                            }),
                                        })}
                                      </div>
                                      <input
                                        type="number"
                                        min={512}
                                        max={2048}
                                        step={8}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.height ?? 1216
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            height: Number(e.target.value),
                                          })
                                        }
                                        className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-xs text-slate-300">
                                      Batch count
                                    </label>
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        type="range"
                                        min={1}
                                        max={20}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.batch_count ?? 10
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            batch_count: Number(e.target.value),
                                          })
                                        }
                                        className="flex-1"
                                      />
                                      <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.batch_count ?? 10
                                        }
                                        onChange={(e) => {
                                          let v = Number(e.target.value);
                                          if (!Number.isFinite(v)) v = 10;
                                          if (v < 1) v = 1;
                                          if (v > 20) v = 20;
                                          setTechConfig(activeCharacter, {
                                            batch_count: v,
                                          });
                                        }}
                                        className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                      />
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const characterNames = Object.keys(metaByCharacter);
                                          if (characterNames.length === 0) return;
                                          const count =
                                            techConfigByCharacter[
                                              activeCharacter || characterNames[0]
                                            ]?.batch_count ?? 10;
                                          const allowExtra =
                                            allowExtraLorasByCharacter[
                                              activeCharacter || characterNames[0]
                                            ] ?? true;
                                          const payload = characterNames.map((name) => ({
                                            character_name: name,
                                            trigger_words:
                                              metaByCharacter[name]?.trigger_words || [name],
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
                                              } catch {}
                                              return next;
                                            });
                                            try {
                                              const draftsList: unknown[] = Array.isArray(res.drafts) ? (res.drafts as unknown[]) : [];
                                              setPlannerContext((prev) => {
                                                const next = { ...prev };
                                                draftsList.forEach((d) => {
                                                  const item = d as {
                                                    character?: string;
                                                    base_prompt?: string;
                                                    recommended_params?: { cfg: number; steps: number; sampler: string };
                                                    reference_images?: Array<{ url: string; meta: Record<string, unknown> }>;
                                                  };
                                                  const key = item.character;
                                                  if (key) {
                                                    next[key] = {
                                                      base_prompt: item.base_prompt,
                                                      recommended_params: item.recommended_params,
                                                      reference_images: item.reference_images,
                                                    };
                                                  }
                                                });
                                                try {
                                                  localStorage.setItem("planner_context", JSON.stringify(next));
                                                } catch {}
                                                return next;
                                              });
                                            } catch {}
                                          } catch (e) {
                                            console.error("Regeneración fallida", e);
                                          } finally {
                                            setIsRegenerating(false);
                                          }
                                        }}
                                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                                        title="Generar"
                                        disabled={isRegenerating}
                                      >
                                        {isRegenerating ? (
                                          <span className="inline-flex items-center gap-1">
                                            <Loader2 className="h-3 w-3 animate-spin" />{" "}
                                            Generando...
                                          </span>
                                        ) : (
                                          "🔄 Generar"
                                        )}
                                      </button>
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-400">
                                      {techConfigByCharacter[activeCharacter]
                                        ?.batch_count ?? 10}{" "}
                                      jobs planificados
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-300">
                                      Batch size
                                    </label>
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        type="range"
                                        min={1}
                                        max={8}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.batch_size ?? 1
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            batch_size: Number(e.target.value),
                                          })
                                        }
                                        className="flex-1"
                                      />
                                      <input
                                        type="number"
                                        min={1}
                                        max={8}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.batch_size ?? 1
                                        }
                                        onChange={(e) => {
                                          let v = Number(e.target.value);
                                          if (!Number.isFinite(v)) v = 1;
                                          if (v < 1) v = 1;
                                          if (v > 8) v = 8;
                                          setTechConfig(activeCharacter, {
                                            batch_size: v,
                                          });
                                        }}
                                        className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs text-slate-300">
                                  Seed
                                </label>
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    type="number"
                                    placeholder="Random (-1)"
                                    value={
                                      techConfigByCharacter[activeCharacter]
                                        ?.seed ?? -1
                                    }
                                    onChange={(e) =>
                                      setTechConfig(activeCharacter, {
                                        seed: Number(e.target.value),
                                      })
                                    }
                                    className="w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                                  />
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                                    onClick={() =>
                                      setTechConfig(activeCharacter, {
                                        seed: -1,
                                      })
                                    }
                                    aria-label="Seed aleatorio"
                                    title="Seed aleatorio (-1)"
                                  >
                                    <Shuffle className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          {paramTab === "hires" && (
                            <>
                              <div className="col-span-2 flex gap-6 items-center">
                                <label className="flex items-center gap-2 text-slate-300 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={
                                      techConfigByCharacter[activeCharacter]
                                        ?.hiresFix ??
                                      configByCharacter[activeCharacter]
                                        ?.hiresFix ??
                                      true
                                    }
                                    onChange={(e) =>
                                      setTechConfig(activeCharacter, {
                                        hiresFix: e.target.checked,
                                      })
                                    }
                                    className="accent-blue-500"
                                  />
                                  Hires. Fix
                                </label>
                              </div>
                              {(techConfigByCharacter[activeCharacter]
                                ?.hiresFix ??
                                configByCharacter[activeCharacter]?.hiresFix ??
                                true) && (
                                <div className="col-span-2 w-full space-y-2">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="min-w-0">
                                      <label className="text-xs text-slate-300 flex items-center justify-between">
                                        <span>VAE</span>
                                      </label>
                                      <select
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.vae ??
                                          reforgeOptions?.current_vae ??
                                          "Automatic"
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            vae: e.target.value,
                                          })
                                        }
                                        className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                                      >
                                        <option value="Automatic">
                                          Automatic
                                        </option>
                                        {vaes.map((v) => (
                                          <option key={v} value={v}>
                                            {v}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="min-w-0">
                                      <label className="text-xs text-slate-300 flex items-center justify-between">
                                        <span>Upscaler</span>
                                        <button
                                          type="button"
                                          onClick={refreshUpscalers}
                                          disabled={refreshingUpscalers}
                                          className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                                        >
                                          {refreshingUpscalers ? (
                                            <span className="inline-flex items-center gap-1">
                                              <Loader2 className="h-3 w-3 animate-spin" />{" "}
                                              Actualizando
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1">
                                              <RefreshCw className="h-3 w-3" />{" "}
                                              Actualizar
                                            </span>
                                          )}
                                        </button>
                                      </label>
                                      <select
                                        key={`upscaler-${upscalerVersion}`}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.upscaler ?? ""
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            upscaler: e.target.value,
                                          })
                                        }
                                        className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-slate-100"
                                      >
                                        <option value="">(none)</option>
                                        {reforgeUpscalers.map((u) => (
                                          <option key={u} value={u}>
                                            {u}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="min-w-0">
                                      <label className="text-xs text-slate-300 flex items-center justify-between">
                                        <span>Denoise</span>
                                        <input
                                          type="number"
                                          step={0.01}
                                          value={
                                            configByCharacter[activeCharacter]
                                              ?.denoising ?? 0.35
                                          }
                                          onChange={(e) =>
                                            setConfigByCharacter((prev) => {
                                              const next = {
                                                ...prev,
                                                [activeCharacter]: {
                                                  ...(prev[activeCharacter] || {
                                                    hiresFix: true,
                                                    denoising: 0.35,
                                                    outputPath: `OUTPUTS_DIR/${activeCharacter}/`,
                                                  }),
                                                  denoising: Number(
                                                    e.target.value
                                                  ),
                                                },
                                              };
                                              localStorage.setItem(
                                                "planner_config",
                                                JSON.stringify(next)
                                              );
                                              return next;
                                            })
                                          }
                                          className="w-16 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                        />
                                      </label>
                                      {SliderBar({
                                        value:
                                          configByCharacter[activeCharacter]
                                            ?.denoising ?? 0.35,
                                        min: 0,
                                        max: 1,
                                        step: 0.01,
                                        onChange: (v) =>
                                          setConfigByCharacter((prev) => {
                                            const next = {
                                              ...prev,
                                              [activeCharacter]: {
                                                ...(prev[activeCharacter] || {
                                                  hiresFix: true,
                                                  denoising: 0.35,
                                                  outputPath: `OUTPUTS_DIR/${activeCharacter}/`,
                                                }),
                                                denoising: v,
                                              },
                                            };
                                            localStorage.setItem(
                                              "planner_config",
                                              JSON.stringify(next)
                                            );
                                            return next;
                                          }),
                                      })}
                                    </div>
                                    <div className="min-w-0">
                                      <label className="text-xs text-slate-300 flex items-center justify-between">
                                        <span>Upscale By (x)</span>
                                      </label>
                                      <input
                                        type="number"
                                        step={0.05}
                                        min={1}
                                        max={4}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.upscaleBy ?? 1.5
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            upscaleBy: Number(e.target.value),
                                          })
                                        }
                                        className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                      />
                                      {SliderBar({
                                        value:
                                          techConfigByCharacter[activeCharacter]
                                            ?.upscaleBy ?? 1.5,
                                        min: 1,
                                        max: 4,
                                        step: 0.05,
                                        onChange: (v) =>
                                          setTechConfig(activeCharacter, {
                                            upscaleBy: v,
                                          }),
                                      })}
                                    </div>
                                    <div className="min-w-0">
                                      <label className="text-xs text-slate-300 flex items-center justify-between">
                                        <span>Hires Steps</span>
                                      </label>
                                      <input
                                        type="number"
                                        step={1}
                                        min={0}
                                        max={60}
                                        value={
                                          techConfigByCharacter[activeCharacter]
                                            ?.hiresSteps ?? 10
                                        }
                                        onChange={(e) =>
                                          setTechConfig(activeCharacter, {
                                            hiresSteps: Number(e.target.value),
                                          })
                                        }
                                        className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-right text-slate-100"
                                      />
                                      {SliderBar({
                                        value:
                                          techConfigByCharacter[activeCharacter]
                                            ?.hiresSteps ?? 10,
                                        min: 0,
                                        max: 60,
                                        step: 1,
                                        onChange: (v) =>
                                          setTechConfig(activeCharacter, {
                                            hiresSteps: v,
                                          }),
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          {paramTab === "adetailer" && (
                            <div className="col-span-2 flex items-center gap-6">
                              <label className="flex items-center gap-2 text-slate-300 text-sm">
                                <input
                                  type="checkbox"
                                  checked={
                                    techConfigByCharacter[activeCharacter]
                                      ?.adetailer ?? true
                                  }
                                  onChange={(e) =>
                                    setTechConfig(activeCharacter, {
                                      adetailer: e.target.checked,
                                    })
                                  }
                                  className="accent-blue-500"
                                />
                                ADetailer
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Sección Inferior: Cola de Producción */}
            <section className="rounded-xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden mt-6" aria-labelledby="production-queue-title">
              <div className="p-3 space-y-3">
                <div className="section-title" id="production-queue-title">
                  <Play className="section-title__icon" aria-hidden />
                  <span>Cola de Producción</span>
                  <span className="ml-auto text-xs text-zinc-400">Personajes: {Object.keys(perCharacter).length} · Jobs: {jobs.length}</span>
                </div>
                <div className="space-y-3">
                <div className="mt-3 space-y-6" role="list">
                  {Object.keys(perCharacter).map((character) => (
                    <article
                      key={`production-${character}`}
                      id={`production-${character}`}
                      role="listitem"
                      aria-labelledby={`production-title-${character}`}
                      className="rounded-lg border border-slate-800 bg-slate-900 p-3"
                    >
                      <header className="pb-2 border-b border-slate-700">
                        <div className="flex items-center justify-between">
                          <h4 id={`production-title-${character}`} className="text-base md:text-lg font-semibold text-slate-100">{character}</h4>
                          <div className="text-xs text-zinc-400">{perCharacter[character]?.jobs.length ?? 0} jobs</div>
                        </div>
                        <div className="mt-2 flex items-end gap-2">
                          <div className="flex-1 min-w-0">
                            <label className="text-xs text-slate-300">LORE CONTEXT</label>
                            <input
                              type="text"
                              value={loreByCharacter[character] || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setLoreByCharacter((prev) => {
                                  const next = { ...prev, [character]: v };
                                  try {
                                    localStorage.setItem("planner_lore_context", JSON.stringify(next));
                                  } catch {}
                                  return next;
                                });
                              }}
                              placeholder="Contexto breve del encargo / personaje"
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                            />
                          </div>
                          <div>
                            <button
                              onClick={() => analyzeLore(character)}
                              className="rounded-md border border-indigo-700 bg-indigo-700/20 px-3 py-1.5 text-xs text-indigo-100 hover:bg-indigo-700/30"
                            >
                              Analizar
                            </button>
                          </div>
                        </div>
                      </header>
                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <figure className="lg:col-span-1">
                          {metaByCharacter[character]?.image_url ? (
                            <img
                              src={metaByCharacter[character]!.image_url!}
                              alt={character}
                              className="aspect-[3/4] w-full rounded-md object-cover border border-slate-800"
                            />
                          ) : (
                            <div className="aspect-[3/4] w-full rounded-md border border-slate-800 bg-slate-800/40 flex items-center justify-center text-xs text-slate-400">Sin imagen</div>
                          )}
                          <figcaption className="sr-only">Imagen representativa de {character}</figcaption>
                        </figure>
                        <div className="lg:col-span-2">
                          <ul className="space-y-2">
                            {perCharacter[character]?.jobs.map((job, i) => {
                              const idx = perCharacter[character]!.indices[i];
                              const triplet = extractTriplet(job.prompt);
                              const intensity = getIntensity(job.prompt);
                              const topColor =
                                intensity.label === "SFW"
                                  ? "border-green-600"
                                  : intensity.label === "ECCHI"
                                  ? "border-yellow-500"
                                  : "border-red-600";
                              return (
                                <li
                                  key={`${character}-${i}`}
                                  className={`rounded-lg border border-slate-700 bg-slate-900 p-3 border-t-2 ${topColor}`}
                                >
                                  <div
                                    onClick={() => toggleDetails(idx)}
                                    className="flex items-center justify-between border-b border-slate-700 pb-2 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-slate-200">Job #{i + 1}</span>
                                    </div>
                                    <IntensitySelector
                                      value={intensity.label as "SFW" | "ECCHI" | "NSFW"}
                                      onChange={(v) => handleIntensityChange(idx, v)}
                                      stop={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteJob(character, i);
                                        }}
                                        className="rounded-md border border-red-700 bg-red-700/20 px-2 py-1 text-xs text-red-100 hover:bg-red-700/30"
                                      >
                                        <Trash2 className="h-3 w-3" aria-hidden />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleDetails(idx);
                                        }}
                                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                                      >
                                        {showDetails.has(idx) ? (
                                          <ChevronUp className="h-3 w-3" aria-hidden />
                                        ) : (
                                          <ChevronDown className="h-3 w-3" aria-hidden />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  {showDetails.has(idx) && (
                                    <div className="pt-3 relative">
                                      {intensityBusy.has(idx) && (
                                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                          <Loader2 className="h-5 w-5 animate-spin text-slate-200" />
                                        </div>
                                      )}
                                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                      <div>
                                        <label className="text-xs text-slate-400 flex items-center gap-1">
                                          <Shirt className="h-3 w-3 text-slate-400" />
                                          <span>Outfit</span>
                                          {job?.ai_meta?.outfit && (
                                            <span title="Sugerido por IA por coherencia" className="inline-flex items-center text-blue-300">
                                              <Bot className="h-3 w-3" />
                                            </span>
                                          )}
                                        </label>
                                        <select
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                          value={triplet.outfit || ""}
                                          onChange={(e) => applyQuickEdit(idx, "outfit", e.target.value)}
                                        >
                                          <option value="">(vacío)</option>
                                          {resources && resources.outfits.map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-400 flex items-center gap-1">
                                          <User className="h-3 w-3 text-slate-400" /> <span>Pose</span>
                                        </label>
                                        <select
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                          value={triplet.pose || ""}
                                          onChange={(e) => applyQuickEdit(idx, "pose", e.target.value)}
                                        >
                                          <option value="">(vacío)</option>
                                          {resources && resources.poses.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-400 flex items-center gap-1">
                                          <MapPin className="h-3 w-3 text-slate-400" /> <span>Location</span>
                                        </label>
                                        <select
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                          value={triplet.location || ""}
                                          onChange={(e) => applyQuickEdit(idx, "location", e.target.value)}
                                        >
                                          <option value="">(vacío)</option>
                                          {resources && resources.locations.map((l) => (
                                            <option key={l} value={l}>{l}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-400 flex items-center gap-1">
                                          <Zap className="h-3 w-3 text-slate-400" />
                                          <span>Lighting</span>
                                          {job?.ai_meta?.lighting && (
                                            <span title="Sugerido por IA por coherencia" className="inline-flex items-center text-blue-300">
                                              <Bot className="h-3 w-3" />
                                            </span>
                                          )}
                                        </label>
                                        <select
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                          value={extractExtras(job.prompt).lighting || ""}
                                          onChange={(e) => applyExtrasEdit(idx, "lighting", e.target.value)}
                                        >
                                          <option value="">(vacío)</option>
                                          {resources && resources.lighting?.map((it) => (
                                            <option key={it} value={it}>{it}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-400 flex items-center gap-1">
                                          <Camera className="h-3 w-3 text-slate-400" />
                                          <span>Camera</span>
                                          {job?.ai_meta?.camera && (
                                            <span title="Sugerido por IA por coherencia" className="inline-flex items-center text-blue-300">
                                              <Bot className="h-3 w-3" />
                                            </span>
                                          )}
                                        </label>
                                        <select
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                          value={extractExtras(job.prompt).camera || ""}
                                          onChange={(e) => applyExtrasEdit(idx, "camera", e.target.value)}
                                        >
                                          <option value="">(vacío)</option>
                                          {resources && resources.camera?.map((it) => (
                                            <option key={it} value={it}>{it}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-400">Expression</label>
                                        <select
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                          value={extractExtras(job.prompt).expression || ""}
                                          onChange={(e) => applyExtrasEdit(idx, "expression", e.target.value)}
                                        >
                                          <option value="">(vacío)</option>
                                          {resources && resources.expressions?.map((it) => (
                                            <option key={it} value={it}>{it}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-400">Hairstyle</label>
                                        <select
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                          value={extractExtras(job.prompt).hairstyle || ""}
                                          onChange={(e) => applyExtrasEdit(idx, "hairstyle", e.target.value)}
                                        >
                                          <option value="">(Original/Vacío)</option>
                                          {resources && resources.hairstyles?.map((it) => (
                                            <option key={it} value={it}>{it}</option>
                                          ))}
                                        </select>
                                      </div>
                                      </div>
                                      <div className="mt-3 flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => magicFix(idx)}
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 rounded-md border border-indigo-700 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-900/40 disabled:opacity-60"
                                      >
                                        <Wand2 className="h-4 w-4" /> <span>Magic Fix</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          const ensured = ensureTriplet(jobs[idx].prompt);
                                          updatePrompt(idx, ensured);
                                        }}
                                        className="inline-flex items-center gap-2 rounded-md border border-emerald-700 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40"
                                      >
                                        <Cog className="h-4 w-4" /> <span>Aplicar</span>
                                      </button>
                                      <button
                                        onClick={() => toggleDetails(idx)}
                                        className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                                      >
                                        <Camera className="h-4 w-4" /> <span>Ver Prompt</span>
                                      </button>
                                      </div>
                                      <div className="mt-3 rounded-md border border-slate-700 bg-slate-800/40 p-2 text-sm text-slate-200">
                                        <textarea
                                          value={job.prompt}
                                          onChange={(e) => updatePrompt(idx, e.target.value)}
                                          className="h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
                                        />
                                        {aiReasoningByJob[idx] ? (
                                          <p className="mt-1 text-xs text-zinc-400">{aiReasoningByJob[idx]}</p>
                                        ) : aiReasoningByCharacter[character] ? (
                                          <p className="mt-1 text-xs text-zinc-400">{aiReasoningByCharacter[character]}</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
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
              <button
                className="hidden"
              >
                
              </button>
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
