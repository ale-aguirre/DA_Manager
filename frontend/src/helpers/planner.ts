export const QUALITY_TAGS =
  "masterpiece, best quality, absurdres, nsfw, rating_explicit";
export const QUALITY_SET = new Set(
  QUALITY_TAGS.split(",").map((s) => s.trim().toLowerCase())
);

export function splitPrompt(prompt: string): string[] {
  return prompt
    .split(",")
    .map((s) => s.trim())
    .filter((t) => t && t !== "(none)" && t !== "undefined" && t !== "null");
}

export function extractTriplet(
  prompt: string,
  resources?: { outfits: string[]; poses: string[]; locations: string[] }
): {
  outfit?: string;
  pose?: string;
  location?: string;
} {
  const tokens = splitPrompt(prompt);
  const result: { outfit?: string; pose?: string; location?: string } = {};

  if (!resources) return result;

  // Helper para buscar coincidencia y devolver el nombre canónico del recurso
  const findMatch = (list: string[]) => {
    // Buscamos el recurso que coincida con algún token
    return list.find((r) => {
      const rLow = r.toLowerCase();
      return tokens.some((t) => {
        const low = t.toLowerCase();
        // Match exacto o contenido si es lo suficientemente largo
        return low === rLow || (rLow.length > 3 && low.includes(rLow));
      });
    });
  };

  if (resources.outfits) result.outfit = findMatch(resources.outfits);
  if (resources.poses) result.pose = findMatch(resources.poses);
  if (resources.locations) result.location = findMatch(resources.locations);

  return result;
}

export function extractExtras(
  prompt: string,
  resources?: {
    lighting?: string[];
    camera?: string[];
    expressions?: string[];
    hairstyles?: string[];
    artists?: string[];
  }
): {
  lighting?: string;
  camera?: string;
  expression?: string;
  hairstyle?: string;
  artist?: string;
} {
  const tokens = splitPrompt(prompt);
  const result: {
    lighting?: string;
    camera?: string;
    expression?: string;
    hairstyle?: string;
    artist?: string;
  } = {};

  if (!resources) return result;

  const findMatch = (list: string[]) => {
    return list.find((r) => {
      const rLow = r.toLowerCase();
      return tokens.some((t) => {
        const low = t.toLowerCase();
        return low === rLow || (rLow.length > 3 && low.includes(rLow));
      });
    });
  };

  if (resources.lighting) result.lighting = findMatch(resources.lighting);
  if (resources.camera) result.camera = findMatch(resources.camera);
  if (resources.expressions) result.expression = findMatch(resources.expressions);
  if (resources.hairstyles) result.hairstyle = findMatch(resources.hairstyles);
  if (resources.artists) result.artist = findMatch(resources.artists);

  return result;
}

export function mergePositive(
  preset: string | undefined,
  userBase: string,
  scene: string
): string {
  const p = preset ? preset.trim() : "";
  const u = userBase ? userBase.trim() : "";
  const s = scene ? scene.trim() : "";
  // Unir filtrando vacíos
  return [p, u, s].filter(Boolean).join(", ");
}

export function mergeNegative(
  preset: string | undefined,
  userNeg: string | undefined
): string {
  const p = preset ? preset.trim() : "";
  const u = userNeg ? userNeg.trim() : "";
  if (p && u) return `${p}, ${u}`;
  return p || u || "";
}

// --- NUEVA LÓGICA ROBUSTA ---

/**
 * Reconstruye el prompt reemplazando inteligentemente los elementos del triplete.
 * Requiere las listas de recursos para identificar qué borrar.
 */
// En src/helpers/planner.ts

/**
 * Reconstruye el prompt reemplazando inteligentemente los elementos del triplete.
 * Requiere las listas de recursos para identificar qué borrar.
 */

// Helper para normalizar tags (quitar pesos, paréntesis, espacios extras)
function normalizeTag(tag: string): string {
  // 1. Quitar paréntesis y pesos: (tag:1.2) -> tag
  //    También [[tag]] -> tag, {{tag}} -> tag
  let clean = tag.replace(/[(){}[\]]/g, "");
  // Quitar la parte del peso si existe (e.g. ":1.2")
  if (clean.includes(":")) {
    clean = clean.split(":")[0];
  }
  // 2. Normalizar espacios y guiones bajos a un estándar (espacio simple)
  //    red_dress -> red dress
  return clean.replace(/_/g, " ").trim().toLowerCase();
}

/**
 * Chequea si un token (con posible peso/formato) coincide con un target (nombre canónico).
 * target debe estar ya "limpio" (sin _, lowercase).
 */
function isMatch(token: string, target: string): boolean {
  if (!target) return false;
  const tokenNorm = normalizeTag(token);
  const targetNorm = normalizeTag(target);

  // Coincidencia exacta de la base
  if (tokenNorm === targetNorm) return true;

  // Coincidencia parcial robusta (evitar falsos positivos cortos)
  // Si target="dress" y token="red dress", NO es match (queremos especificidad en triplete).
  // Pero si target="red dress" y token="red_dress", SÍ es match.

  // Para recursos definidos (outfits, poses), usualmente buscamos match completo del concepto.
  // Pero a veces el usuario corta el tag.

  // Vamos a ser estrictos: Token NORMALIZADO debe ser IGUAL al target NORMALIZADO
  // O el target debe estar contenido en el token (ej: token "my red dress", target "red dress")
  // PERO, solo si es un "word boundary".

  // Simplificación efectiva:
  // Si normalizamos ambos a espacios, podemos buscar subcadenas.
  return tokenNorm.includes(targetNorm) || targetNorm.includes(tokenNorm);
}


export function rebuildPromptWithTriplet(
  currentPrompt: string,
  newValues: { outfit?: string; pose?: string; location?: string },
  knownResources?: { outfits: string[]; poses: string[]; locations: string[] },
  oldValues?: { outfit?: string; pose?: string; location?: string }
): string {
  let tokens = splitPrompt(currentPrompt);

  const replaceOrAdd = (
    newValue: string | undefined,
    oldValue: string | undefined,
    resourceList: string[] | undefined
  ) => {
    // Si no hay nuevo valor, no hacemos nada (no borramos nada tampoco si no hay reemplazo explícito)
    // EXCEPCIÓN: Si queremos borrar explícitamente, newValue podría ser null? 
    // Por ahora asumimos flujo de "cambio": si cambio outfit, borro el anterior y pongo el nuevo.
    if (!newValue) return;

    const newValClean = newValue.trim();
    const newValNorm = normalizeTag(newValClean);

    // Filter tokens
    tokens = tokens.filter(t => {
      // 1. Si el token es EXACTAMENTE el nuevo valor (idempotencia), lo borramos para volver a agregarlo al final 
      //    (o lo dejamos y no agregamos? Mejor borrar y reagregar para mantener orden lógico o actualizar pesos si cambiaran)
      //    Prefiero borrar todo rastro antiguo para evitar duplicados.
      if (normalizeTag(t) === newValNorm) return false;

      // 2. Si coincide con oldValue (lo que el UI dice que había antes)
      if (oldValue && isMatch(t, oldValue)) return false;

      // 3. Si coincide con algo de la lista de recursos (limpieza preventiva de la categoría)
      if (resourceList) {
        // ¿Es un recurso de esta categoría?
        const match = resourceList.some(r => isMatch(t, r));
        if (match) {
          // CUIDADO: No borrar cosas que coincidan por accidente (ej: "sitting" vs "sitting on chair").
          // isMatch usa includes bidireccional, lo cual es agresivo pero necesario para (red_dress) vs (red dress).
          return false;
        }
      }

      return true;
    });

    // Añadir nuevo valor
    tokens.push(newValClean);
  };

  replaceOrAdd(newValues.outfit, oldValues?.outfit, knownResources?.outfits);
  replaceOrAdd(newValues.pose, oldValues?.pose, knownResources?.poses);
  replaceOrAdd(newValues.location, oldValues?.location, knownResources?.locations);

  return tokens.join(", ");
}

export function rebuildPromptWithExtras(
  prompt: string,
  newExtras: {
    lighting?: string;
    camera?: string;
    expression?: string;
    hairstyle?: string;
    artist?: string;
  },
  resources?: {
    lighting?: string[];
    camera?: string[];
    expressions?: string[];
    hairstyles?: string[];
    artists?: string[];
  },
  oldExtras?: {
    lighting?: string;
    camera?: string;
    expression?: string;
    hairstyle?: string;
    artist?: string;
  }
): string {
  let tokens = splitPrompt(prompt);

  const replaceOrAdd = (
    newValue: string | undefined,
    oldValue: string | undefined,
    resourceList: string[] | undefined
  ) => {
    if (!newValue) return;
    const newValClean = newValue.trim();
    const newValNorm = normalizeTag(newValClean);

    tokens = tokens.filter(t => {
      if (normalizeTag(t) === newValNorm) return false;
      if (oldValue && isMatch(t, oldValue)) return false;
      if (resourceList) {
        if (resourceList.some(r => isMatch(t, r))) return false;
      }
      return true;
    });

    tokens.push(newValClean);
  };

  replaceOrAdd(newExtras.lighting, oldExtras?.lighting, resources?.lighting);
  replaceOrAdd(newExtras.camera, oldExtras?.camera, resources?.camera);
  replaceOrAdd(newExtras.expression, oldExtras?.expression, resources?.expressions);
  replaceOrAdd(newExtras.hairstyle, oldExtras?.hairstyle, resources?.hairstyles);
  replaceOrAdd(newExtras.artist, oldExtras?.artist, resources?.artists);

  return tokens.join(", ");
}

// Helpers técnicos (tipados)
type SetState<T> = (value: T | ((prev: T) => T)) => void;

export const handleSetCheckpoint = async (
  title: string,
  activeCharacter: string,
  setTechConfig: (character: string, partial: Partial<{ checkpoint: string }>) => void,
  setGlobalCheckpoint: (title: string) => void
) => {
  if (!title) return;
  setTechConfig(activeCharacter, { checkpoint: title });
  setGlobalCheckpoint(title);
  try {
    localStorage.setItem("planner_checkpoint_global", title);
    // Import dinámico para evitar ciclos si es necesario, o asumiendo que se pasa la función
    const { postReforgeSetCheckpoint } = await import("../lib/api");
    await postReforgeSetCheckpoint(title);
  } catch (e) {
    console.error(e);
  }
};

export const handleRefreshTech = async (
  activeCharacter: string | null,
  refreshVaes: () => void | Promise<void>,
  refreshCheckpoints: () => void | Promise<void>
) => {
  try {
    const { postReforgeRefresh } = await import("../lib/api");
    await postReforgeRefresh();
    await refreshVaes();
    await refreshCheckpoints();
  } catch { }
};

export const refreshUpscalersHelper = async (
  activeCharacter: string | null,
  setReforgeUpscalers: (list: string[]) => void,
  setUpscalerVersion: SetState<number>,
  techConfigByCharacter: Record<string, { upscaler?: string }>,
  setTechConfig: (character: string, partial: Partial<{ upscaler: string }>) => void,
  toast: (msg: string) => void,
  setRefreshing: (v: boolean) => void
) => {
  setRefreshing(true);
  try {
    const { getReforgeUpscalers } = await import("../lib/api");
    const list = await getReforgeUpscalers();
    setReforgeUpscalers(list);
    setUpscalerVersion((v: number) => v + 1);
    toast("Upscalers actualizados");
    if (activeCharacter && list.length > 0) {
      const current = techConfigByCharacter[activeCharacter]?.upscaler;
      if (!current || !list.includes(current)) {
        // Preferencias inteligentes
        const preferred =
          list.find((u) => u.includes("4x_NMKD-Siax_200k")) ||
          list.find((u) => u.includes("R-ESRGAN 4x+")) ||
          list[0];
        setTechConfig(activeCharacter, { upscaler: preferred });
      }
    }
  } catch {
    toast("Error al actualizar upscalers");
  } finally {
    setRefreshing(false);
  }
};

export const refreshVaesHelper = async (setVaes: (list: string[]) => void) => {
  try {
    const { getReforgeVAEs } = await import("../lib/api");
    const list = await getReforgeVAEs();
    setVaes(list);
  } catch { }
};

export const refreshCheckpointsHelper = async (
  activeCharacter: string | null,
  setCheckpoints: (list: string[]) => void,
  setCheckpointVersion: SetState<number>,
  techConfigByCharacter: Record<string, { checkpoint?: string }>,
  setTechConfig: (character: string, partial: Partial<{ checkpoint: string }>) => void,
  toast: (msg: string) => void
) => {
  try {
    const { getReforgeCheckpoints } = await import("../lib/api");
    const list = await getReforgeCheckpoints();
    setCheckpoints(list);
    setCheckpointVersion((v: number) => v + 1);
    toast("Checkpoints actualizados");
  } catch {
    toast("Error al actualizar checkpoints");
  }
};

type BootstrapParams = {
  activeCharacter?: string | null;
  techConfigByCharacter?: Record<string, unknown>;
  globalCheckpoint?: string | null;
  options?: { current_vae: string; current_clip_skip: number } | null;
  upscalers?: string[];
  vaes?: string[];
  checkpoints?: string[];
};

export const computeTechBootstrap = (params: BootstrapParams): {
  options: { current_vae: string; current_clip_skip: number } | null;
  upscalers: string[];
  vaes: string[];
  checkpoints: string[];
} => {
  // Lógica pura de inicialización
  const {
    options,
    upscalers,
    vaes,
    checkpoints,
  } = params;

  // Retorna el nuevo estado calculado
  return {
    options: options ?? null,
    upscalers: upscalers ?? [],
    vaes: vaes ?? [],
    checkpoints: checkpoints ?? [],
  };
};

// Intensidad por tags básicos
export function getIntensity(prompt: string): { label: "SFW" | "ECCHI" | "NSFW" } {
  // Usar normalización para detectar
  const tokens = splitPrompt(prompt);
  const normalized = tokens.map(normalizeTag);

  if (normalized.some(t => t.includes("rating explicit") || t.includes("nsfw") || t === "explicit")) {
    return { label: "NSFW" };
  }
  if (normalized.some(t => t.includes("rating questionable") || t.includes("ecchi") || t.includes("suggestive"))) {
    return { label: "ECCHI" };
  }
  return { label: "SFW" };
}

export function updateIntensityTags(prompt: string, newIntensity: "SFW" | "ECCHI" | "NSFW"): string {
  let tokens = splitPrompt(prompt);

  // 1. Define Tag Sets
  const sfwTags = ["rating_safe", "safe", "rating safe"];
  const ecchiTags = ["rating_questionable", "questionable", "suggestive", "cleavage", "rating questionable"];
  const nsfwTags = ["rating_explicit", "explicit", "nsfw", "rating explicit"];

  // Also remove literal labels if they exist (Sanitization)
  const labels = ["sfw", "ecchi", "nsfw"];

  const allToRemove = [...sfwTags, ...ecchiTags, ...nsfwTags, ...labels];

  // 2. Remove ALL intensity tags first to start clean using robust matching
  tokens = tokens.filter(t => {
    return !allToRemove.some(r => isMatch(t, r));
  });

  // 3. Inject correct tags based on new mode
  if (newIntensity === "SFW") {
    // Inject rating_safe at start (after LoRA/Trigger usually, but start of tags)
    // We append to ensure it's present.
    tokens.push("rating_safe");
  } else if (newIntensity === "ECCHI") {
    tokens.push("rating_questionable");
    tokens.push("cleavage");
  } else if (newIntensity === "NSFW") {
    tokens.push("rating_explicit");
    tokens.push("nsfw");
  }

  return tokens.join(", ");
}
