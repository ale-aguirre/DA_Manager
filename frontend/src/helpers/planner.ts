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

export function extractTriplet(prompt: string): {
  outfit?: string;
  pose?: string;
  location?: string;
} {
  // Esta función es heurística y débil, se mantiene por compatibilidad
  return {};
}

export function extractExtras(
  prompt: string
): Record<string, string | undefined> {
  return {};
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
export function rebuildPromptWithTriplet(
  currentPrompt: string,
  newValues: { outfit?: string; pose?: string; location?: string },
  knownResources?: { outfits: string[]; poses: string[]; locations: string[] }
): string {
  let tokens = splitPrompt(currentPrompt);
  const lowerTokens = tokens.map((t) => t.toLowerCase());

  // Helper para reemplazar o añadir
  const replaceOrAdd = (
    newValue: string | undefined,
    resourceList: string[]
  ) => {
    if (!newValue) return;

    const newValClean = newValue.trim();
    if (!newValClean) return;

    // 1. Buscar si ya existe algo de esta categoría en el prompt y eliminarlo
    if (resourceList && resourceList.length > 0) {
      const resourcesSet = new Set(resourceList.map((r) => r.toLowerCase()));
      // Filtramos tokens que NO estén en la lista de recursos (borramos los viejos)
      // PERO no borramos si es exactamente el nuevo (para evitar borrado accidental si re-aplicamos)
      tokens = tokens.filter((t) => {
        const low = t.toLowerCase();
        // Si es el nuevo valor, lo dejamos (o lo quitamos para reordenar, mejor quitarlo para evitar dupe)
        if (low === newValClean.toLowerCase()) return false;
        // Si está en la lista de recursos conocidos, es un "viejo valor", lo quitamos
        if (resourcesSet.has(low)) return false;
        return true;
      });
    }

    // 2. Añadir el nuevo valor.
    // Estrategia de inserción: Intentar mantenerlo antes de los tags de calidad.
    // Simplificación: Añadirlo al final de la sección descriptiva (antes de quality).
    // Por ahora, push al final es seguro si luego se reordena o simplemente se añade.
    tokens.push(newValClean);
  };

  if (knownResources) {
    replaceOrAdd(newValues.outfit, knownResources.outfits);
    replaceOrAdd(newValues.pose, knownResources.poses);
    replaceOrAdd(newValues.location, knownResources.locations);
  } else {
    // Fallback "tonto" si no hay recursos: solo añade (comportamiento legacy)
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
  } catch {}
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
  } catch {}
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
