export const QUALITY_TAGS =
  "masterpiece, best quality, absurdres, nsfw, rating_explicit";
export const QUALITY_SET = new Set(
  QUALITY_TAGS.split(",").map((s) => s.trim().toLowerCase())
);

export function splitPrompt(prompt: string): string[] {
  return prompt
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

  // Helper para buscar coincidencia
  const findMatch = (list: string[]) => {
    return tokens.find((t) => {
      const low = t.toLowerCase();
      return list.some((r) => {
        const rLow = r.toLowerCase();
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
  }
): {
  lighting?: string;
  camera?: string;
  expression?: string;
  hairstyle?: string;
} {
  const tokens = splitPrompt(prompt);
  const result: {
    lighting?: string;
    camera?: string;
    expression?: string;
    hairstyle?: string;
  } = {};

  if (!resources) return result;

  const findMatch = (list: string[]) => {
    return tokens.find((t) => {
      const low = t.toLowerCase();
      return list.some((r) => {
        const rLow = r.toLowerCase();
        return low === rLow || (rLow.length > 3 && low.includes(rLow));
      });
    });
  };

  if (resources.lighting) result.lighting = findMatch(resources.lighting);
  if (resources.camera) result.camera = findMatch(resources.camera);
  if (resources.expressions) result.expression = findMatch(resources.expressions);
  if (resources.hairstyles) result.hairstyle = findMatch(resources.hairstyles);

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
 * Requiere las listas de recursos (knownResources) para identificar qué borrar.
 */
export function rebuildPromptWithTriplet(
  currentPrompt: string,
  newValues: { outfit?: string; pose?: string; location?: string },
  knownResources?: { outfits: string[]; poses: string[]; locations: string[] }
): string {
  let tokens = splitPrompt(currentPrompt);

  const replaceOrAdd = (newValue: string | undefined, resourceList: string[]) => {
    if (!newValue) return;
    const newValClean = newValue.trim();
    if (!newValClean) return;

    // Lógica de Limpieza Fuzzy (Coincidencia Parcial)
    if (resourceList && resourceList.length > 0) {
      tokens = tokens.filter((t) => {
        const lowToken = t.toLowerCase();

        // 1. Si es EXACTAMENTE el nuevo valor, mantenlo (evita borrar y re-agregar innecesariamente)
        if (lowToken === newValClean.toLowerCase()) return true;

        // 2. Chequear si el token actual es "parte de" o "contiene" un recurso conocido.
        // Esto elimina variaciones como "standing pose" si la lista tiene "standing".
        const isResource = resourceList.some(r => {
          const rLow = r.toLowerCase();
          // Match si uno contiene al otro.
          // Filtramos rLow.length > 2 para evitar que recursos cortos como "in" borren todo.
          return (rLow.length > 2 && lowToken.includes(rLow)) || (lowToken.length > 2 && rLow.includes(lowToken));
        });

        // Si es un recurso viejo, DEVUELVE FALSE para borrarlo del array.
        return !isResource;
      });
    }

    // Añadir el nuevo valor al final
    tokens.push(newValClean);
  };

  if (knownResources) {
    replaceOrAdd(newValues.outfit, knownResources.outfits);
    replaceOrAdd(newValues.pose, knownResources.poses);
    replaceOrAdd(newValues.location, knownResources.locations);
  } else {
    // Fallback si no hay recursos (solo añade)
    if (newValues.outfit) tokens.push(newValues.outfit);
    if (newValues.pose) tokens.push(newValues.pose);
    if (newValues.location) tokens.push(newValues.location);
  }

  return tokens.join(", ");
}

export function rebuildPromptWithExtras(
  prompt: string,
  extras: Record<string, string | undefined>
): string {
  const tokens = splitPrompt(prompt);
  Object.values(extras).forEach((v) => {
    if (v && !tokens.includes(v)) tokens.push(v);
  });
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
    activeCharacter,
    techConfigByCharacter,
    globalCheckpoint,
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
  const tokens = splitPrompt(prompt).map((t) => t.toLowerCase());
  if (tokens.includes("rating_explicit") || tokens.includes("nsfw") || tokens.includes("explicit")) {
    return { label: "NSFW" };
  }
  if (tokens.includes("rating_questionable") || tokens.some((t) => t.includes("ecchi"))) {
    return { label: "ECCHI" };
  }
  return { label: "SFW" };
}
