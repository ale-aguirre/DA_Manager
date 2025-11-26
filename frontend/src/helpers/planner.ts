export const QUALITY_SET = new Set(["masterpiece", "best quality", "amazing quality", "absurdres", "nsfw"]);

export const DEFAULT_NEGATIVE_ANIME =
  "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name";

export function splitPrompt(prompt: string): string[] {
  return (prompt || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function extractTriplet(prompt: string): {
  outfit?: string;
  pose?: string;
  location?: string;
} {
  const tokens = splitPrompt(prompt);
  const core: string[] = [];
  for (const t of tokens) {
    core.push(t);
  }
  while (core.length > 0) {
    const last = core[core.length - 1].toLowerCase();
    if (QUALITY_SET.has(last)) core.pop();
    else break;
  }
  const n = core.length;
  if (n >= 3) {
    return { outfit: core[n - 3], pose: core[n - 2], location: core[n - 1] };
  }
  return {};
}

export function rebuildPromptWithTriplet(
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
  while (core.length < 3) core.push("");
  const tail = core.slice(-3);
  const prev = { outfit: tail[0], pose: tail[1], location: tail[2] };
  const head = core
    .slice(0, Math.max(0, core.length - 3))
    .filter((t) => {
      const low = t.toLowerCase();
      const rmPrev =
        low === String(prev.outfit || "").toLowerCase() ||
        low === String(prev.pose || "").toLowerCase() ||
        low === String(prev.location || "").toLowerCase();
      const rmNext =
        low === String(nextTriplet.outfit || "").toLowerCase() ||
        low === String(nextTriplet.pose || "").toLowerCase() ||
        low === String(nextTriplet.location || "").toLowerCase();
      return !(rmPrev || rmNext);
    });
  const outfit =
    nextTriplet.outfit !== undefined ? (nextTriplet.outfit as string) : prev.outfit;
  const pose = nextTriplet.pose !== undefined ? (nextTriplet.pose as string) : prev.pose;
  const location =
    nextTriplet.location !== undefined ? (nextTriplet.location as string) : prev.location;
  const nextCore = [...head, outfit, pose, location];
  return [...nextCore, ...quality].join(", ");
}

export function extractExtras(prompt: string): {
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
  const isExpression = (s: string) => EXPRESSION_HINTS.includes(s.toLowerCase());
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

export function rebuildPromptWithExtras(
  original: string,
  extras: { lighting?: string; camera?: string; expression?: string; hairstyle?: string }
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
  const current = extractExtras(original);
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
    const matchCurrent =
      low === String(current.lighting || "").toLowerCase() ||
      low === String(current.camera || "").toLowerCase() ||
      low === String(current.expression || "").toLowerCase() ||
      low === String(current.hairstyle || "").toLowerCase();
    const matchNext =
      low === String(extras.lighting || "").toLowerCase() ||
      low === String(extras.camera || "").toLowerCase() ||
      low === String(extras.expression || "").toLowerCase() ||
      low === String(extras.hairstyle || "").toLowerCase();
    return !(isLight || isCam || isExpr || isHair || matchCurrent || matchNext);
  });
  const pre: string[] = [];
  if (extras.camera) pre.push(extras.camera);
  if (extras.expression) pre.push(extras.expression);
  if (extras.hairstyle) pre.push(extras.hairstyle);
  if (extras.lighting) pre.push(extras.lighting);
  const nextCore = [...pre, ...head, ...tail];
  return [...nextCore, ...quality].join(", ");
}

export function getIntensity(
  prompt: string
): { label: "SFW" | "ECCHI" | "NSFW"; className: string } {
  const low = (prompt || "").toLowerCase();
  if (low.includes("rating_explicit") || low.includes("nsfw"))
    return { label: "NSFW", className: "bg-red-600 text-white border-red-700" };
  if (low.includes("rating_questionable") || low.includes("cleavage"))
    return {
      label: "ECCHI",
      className: "bg-yellow-500 text-black border-yellow-600",
    };
  return { label: "SFW", className: "bg-green-600 text-white border-green-700" };
}

export function mergePositive(
  preset?: string,
  base?: string,
  body?: string
): string {
  const tokens = [preset || "", base || "", body || ""].flatMap((s) =>
    splitPrompt(s)
  );
  const seen = new Set<string>();
  const core: string[] = [];
  const quality: string[] = [];
  for (const t of tokens) {
    const norm = t.trim();
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (QUALITY_SET.has(norm.toLowerCase())) quality.push(norm);
    else core.push(norm);
  }
  return [...core, ...quality].join(", ");
}

export function mergeNegative(preset?: string, neg?: string): string {
  const tokens = [preset || "", neg || ""].flatMap((s) => splitPrompt(s));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const norm = t.trim();
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out.join(", ");
}

// Lógica técnica (checkpoint/refresh) trasladada a helpers
import { postReforgeSetCheckpoint, postReforgeRefresh } from "../lib/api";
import { getReforgeUpscalers, getReforgeVAEs, getReforgeCheckpoints, getReforgeOptions } from "../lib/api";

export async function handleSetCheckpoint(
  title: string,
  activeCharacter: string,
  setTechConfig: (character: string, patch: { checkpoint?: string }) => void,
  setGlobalCheckpoint: (title: string) => void
) {
  setTechConfig(activeCharacter, { checkpoint: title });
  try {
    if (title) await postReforgeSetCheckpoint(title);
    setGlobalCheckpoint(title);
    try { localStorage.setItem("planner_checkpoint_global", title); } catch {}
  } catch {}
}

export async function handleRefreshAll(
  activeCharacter: string | null,
  refreshUpscalers: () => Promise<void>,
  refreshVaes: () => Promise<void>,
  refreshCheckpoints: (force: boolean) => Promise<void>
) {
  try { await postReforgeRefresh(); } catch {}
  await refreshUpscalers();
  await refreshVaes();
  if (activeCharacter) await refreshCheckpoints(false);
}

export async function handleRefreshTech(
  activeCharacter: string | null,
  refreshVaes: () => Promise<void>,
  refreshCheckpoints: (force: boolean) => Promise<void>
) {
  try { await postReforgeRefresh(); } catch {}
  await refreshVaes();
  if (activeCharacter) await refreshCheckpoints(false);
}

export async function refreshUpscalersHelper(
  activeCharacter: string | null,
  setReforgeUpscalers: (names: string[]) => void,
  setUpscalerVersion: (updater: (v: number) => number) => void,
  techConfigByCharacter: Record<string, { upscaler?: string }>,
  setTechConfig: (character: string, patch: { upscaler?: string }) => void,
  setToastMessage: (msg: string) => void,
  setRefreshingUpscalers?: (v: boolean) => void
) {
  try {
    setRefreshingUpscalers?.(true);
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
  } catch {
    setToastMessage("❌ Error al actualizar Upscalers");
  } finally {
    setRefreshingUpscalers?.(false);
  }
}

export async function refreshVaesHelper(
  setVaes: (names: string[]) => void
) {
  try {
    const names = await getReforgeVAEs();
    setVaes(Array.isArray(names) ? names : []);
  } catch {
    /* noop */
  }
}

export async function refreshCheckpointsHelper(
  activeCharacter: string | null,
  setCheckpoints: (names: string[]) => void,
  setCheckpointVersion: (updater: (v: number) => number) => void,
  techConfigByCharacter: Record<string, { checkpoint?: string }>,
  setTechConfig: (character: string, patch: { checkpoint?: string }) => void,
  setToastMessage: (msg: string) => void
) {
  try {
    setCheckpoints([]);
    setCheckpointVersion((v) => v + 1);
    try { await postReforgeRefresh(); } catch {}
    await new Promise((r) => setTimeout(r, 2000));
    const cps = await getReforgeCheckpoints();
    setCheckpoints(cps);
    if (activeCharacter) {
      const current = techConfigByCharacter[activeCharacter]?.checkpoint ?? "";
      if (!current) {
        const first = cps && cps.length > 0 ? cps[0] : "";
        if (first) {
          setTechConfig(activeCharacter, { checkpoint: first });
          try { await postReforgeSetCheckpoint(first); } catch {}
        }
      } else if (!cps.includes(current)) {
        const first = cps && cps.length > 0 ? cps[0] : "";
        if (first) setTechConfig(activeCharacter, { checkpoint: first });
      }
    }
    setCheckpointVersion((v) => v + 1);
  } catch (e) {
    console.warn("Refresh checkpoints falló", e);
    setToastMessage("❌ Error al actualizar checkpoints");
  }
}

export async function initTechBootstrap(
  setReforgeOptionsState: (opts: { current_vae: string; current_clip_skip: number } | null) => void,
  setVaes: (names: string[]) => void,
  setReforgeUpscalers: (names: string[]) => void,
  setCheckpoints: (names: string[]) => void,
  activeCharacter: string | null,
  techConfigByCharacter: Record<string, { checkpoint?: string }>,
  setTechConfig: (character: string, patch: { checkpoint?: string }) => void,
  globalCheckpoint: string | null
) {
  try {
    const [opts, upNames, vaeNames, cpsRaw] = await Promise.all([
      getReforgeOptions().catch(() => ({ current_vae: "Automatic", current_clip_skip: 1 })),
      getReforgeUpscalers().catch(() => []),
      getReforgeVAEs().catch(() => []),
      getReforgeCheckpoints().catch(() => []),
    ]);
    setReforgeOptionsState(opts || null);
    const upList = Array.isArray(upNames) ? Array.from(new Set([...upNames, "Latent"])) : ["Latent"];
    setReforgeUpscalers(upList);
    setVaes(Array.isArray(vaeNames) ? vaeNames : []);
    const cps: string[] = Array.isArray(cpsRaw) ? (cpsRaw as string[]) : [];
    setCheckpoints(cps);
    if (activeCharacter) {
      const current = techConfigByCharacter[activeCharacter]?.checkpoint ?? "";
      const fallback = globalCheckpoint && cps.includes(globalCheckpoint)
        ? globalCheckpoint
        : (cps.length > 0 ? cps[0] : "");
      if (!current && fallback) {
        setTechConfig(activeCharacter, { checkpoint: fallback });
        try { await postReforgeSetCheckpoint(fallback); } catch {}
      }
    }
  } catch (e) {
    console.warn("initTechBootstrap error", e);
  }
}

// Puro: computa listas normalizadas y sugerencia de checkpoint sin efectos
export function computeTechBootstrap(params: {
  activeCharacter: string | null;
  techConfigByCharacter: Record<string, { checkpoint?: string }>;
  globalCheckpoint: string | null;
  options?: { current_vae: string; current_clip_skip: number } | null;
  upscalers?: string[];
  vaes?: string[];
  checkpoints?: string[];
}) {
  const opts = params.options || null;
  const upList = Array.isArray(params.upscalers) ? Array.from(new Set([...(params.upscalers || []), "Latent"])) : ["Latent"];
  const vaeList = Array.isArray(params.vaes) ? params.vaes! : [];
  const cps: string[] = Array.isArray(params.checkpoints) ? (params.checkpoints as string[]) : [];
  let suggestedCheckpoint: string | undefined;
  if (params.activeCharacter) {
    const current = params.techConfigByCharacter[params.activeCharacter]?.checkpoint ?? "";
    const fallback = params.globalCheckpoint && cps.includes(params.globalCheckpoint)
      ? params.globalCheckpoint
      : (cps.length > 0 ? cps[0] : "");
    if (!current && fallback) suggestedCheckpoint = fallback;
  }
  return {
    options: opts,
    upscalers: upList,
    vaes: vaeList,
    checkpoints: cps,
    suggestedCheckpoint,
  };
}

// Puro: arma payload de draft según metadatos y configuración
export function buildDraftPayload(input: {
  metaByCharacter: Record<string, { trigger_words?: string[] }>;
  activeCharacter: string | null;
  techConfigByCharacter: Record<string, { batch_count?: number }>;
  allowExtra: boolean;
}): { items: { character_name: string; trigger_words: string[]; batch_count?: number }[]; jobCount: number; allowExtraLoras: boolean } {
  const characterNames = Object.keys(input.metaByCharacter);
  const baseCharacter = input.activeCharacter || characterNames[0] || null;
  const count = baseCharacter ? (input.techConfigByCharacter[baseCharacter]?.batch_count ?? 10) : 10;
  const items = characterNames.map((name) => ({
    character_name: name,
    trigger_words: input.metaByCharacter[name]?.trigger_words || [name],
    batch_count: count,
  }));
  return { items, jobCount: count, allowExtraLoras: input.allowExtra };
}

// Puro: construye prompt final a partir de triplet y extras
export function constructFinalPrompt(core: string[], extras: { camera?: string; expression?: string; hairstyle?: string; lighting?: string }, quality: string[] = []) {
  const pre: string[] = [];
  if (extras.camera) pre.push(extras.camera);
  if (extras.expression) pre.push(extras.expression);
  if (extras.hairstyle) pre.push(extras.hairstyle);
  if (extras.lighting) pre.push(extras.lighting);
  const nextCore = [...pre, ...core];
  return [...nextCore, ...quality].join(', ');
}
