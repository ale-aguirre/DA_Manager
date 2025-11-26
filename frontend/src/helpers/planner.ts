export const QUALITY_SET = new Set(["masterpiece", "best quality", "absurdres", "nsfw"]);

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
  if (nextTriplet.outfit !== undefined) core[core.length - 3] = nextTriplet.outfit as string;
  if (nextTriplet.pose !== undefined) core[core.length - 2] = nextTriplet.pose as string;
  if (nextTriplet.location !== undefined) core[core.length - 1] = nextTriplet.location as string;
  const all = [...core, ...quality];
  return all.join(", ");
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
import { getReforgeUpscalers, getReforgeVAEs, getReforgeCheckpoints } from "../lib/api";

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
