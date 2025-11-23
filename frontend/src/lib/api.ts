export interface PlannerDraftItem {
  character_name: string;
  trigger_words: string[];
  // Opcionales: control explícito de cantidad por intensidad
  batch_count?: number;
  safe_count?: number;
  ecchi_count?: number;
  nsfw_count?: number;
}

export interface PlannerJob {
  character_name: string;
  prompt: string;
  seed: number;
  // Nuevo: negativo por job para A1111
  negative_prompt?: string;
}

export interface FactoryStatus {
  is_active: boolean;
  current_job_index: number;
  total_jobs: number;
  current_character: string | null;
  last_image_url?: string | null;
  last_image_b64?: string | null;
  logs?: string[];
  current_prompt?: string | null;
  current_negative_prompt?: string | null;
  current_config?: {
    steps?: number;
    cfg?: number;
    batch_size?: number;
    hires_fix?: boolean;
    hr_scale?: number;
    seed?: number;
    checkpoint?: string;
  } | null;
}

const BASE_URL = "http://127.0.0.1:8000";

export interface RecommendedParams {
  cfg: number;
  steps: number;
  sampler: string;
}

export interface ReferenceImage {
  url: string;
  meta: Record<string, any>;
}

export interface PlannerDraftEnriched {
  character: string;
  base_prompt: string;
  recommended_params: RecommendedParams;
  reference_images: ReferenceImage[];
  jobs: PlannerJob[];
}

export interface PlannerDraftResponse {
  jobs: PlannerJob[];
  drafts: PlannerDraftEnriched[];
}

export async function postPlannerDraft(items: PlannerDraftItem[], jobCount?: number): Promise<PlannerDraftResponse> {
  const url = jobCount && jobCount > 0 ? `${BASE_URL}/planner/draft?job_count=${jobCount}` : `${BASE_URL}/planner/draft`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Planner draft failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function magicFixPrompt(prompt: string): Promise<{ outfit: string; pose: string; location: string }> {
  const res = await fetch(`${BASE_URL}/planner/magicfix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MagicFix failed (${res.status}): ${text}`);
  }
  return res.json();
}

export interface ResourceMeta {
  character_name: string;
  download_url?: string;
  filename?: string;
}

export async function postPlannerExecute(jobs: PlannerJob[], resourcesMeta: ResourceMeta[] = []): Promise<{ status: string; total_jobs: number }> {
  const res = await fetch(`${BASE_URL}/planner/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobs, resources_meta: resourcesMeta }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Planner execute failed (${res.status}): ${text}`);
  }
  return res.json();
}

// Nuevo: ejecución v2 con configuración por personaje
export interface GroupConfigItem {
  character_name: string;
  cfg_scale?: number;
  steps?: number;
  hires_fix?: boolean;
  denoising_strength?: number;
  output_path?: string;
  extra_loras?: string[];
  hires_steps?: number;
  batch_size?: number;
  adetailer?: boolean;
  vae?: string;
  clip_skip?: number;
  // Nuevos campos técnicos
  upscale_by?: number;
  upscaler?: string;
  sampler?: string;
  checkpoint?: string;
}

export async function getReforgeProgress(): Promise<any> {
  const res = await fetch(`${BASE_URL}/reforge/progress`);
  if (!res.ok) throw new Error("Error fetching progress");
  return res.json();
}

export async function getLocalLoras(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/local/loras`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Local LoRAs failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data?.files) ? data.files : [];
}

export async function postPlannerExecuteV2(
  jobs: PlannerJob[],
  resourcesMeta: ResourceMeta[] = [],
  groupConfig: GroupConfigItem[] = []
): Promise<{ status: string; total_jobs: number; version: string }> {
  const res = await fetch(`${BASE_URL}/planner/execute_v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobs, resources_meta: resourcesMeta, group_config: groupConfig }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Planner execute v2 failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getFactoryStatus(): Promise<FactoryStatus> {
  const res = await fetch(`${BASE_URL}/factory/status`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Factory status failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function postFactoryStop(): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/factory/stop`, { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Factory stop failed (${res.status}): ${text}`);
  }
  return res.json();
}

export interface PlannerResources {
  outfits: string[];
  poses: string[];
  locations: string[];
  lighting?: string[];
  camera?: string[];
  styles?: string[];
  concepts?: string[];
  expressions?: string[];
  hairstyles?: string[];
  upscalers?: string[];
}

export async function getPlannerResources(): Promise<PlannerResources> {
  const res = await fetch(`${BASE_URL}/planner/resources`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Planner resources failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function postPlannerAnalyze(character_name: string, tags: string[] = []): Promise<{ jobs: PlannerJob[]; lore?: string }> {
  const res = await fetch(`${BASE_URL}/planner/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character_name, tags }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analyze failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getReforgeCheckpoints(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/reforge/checkpoints`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ReForge checkpoints failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data?.titles) ? data.titles : [];
}

export async function postReforgeSetCheckpoint(title: string): Promise<{ status?: string } | any> {
  const res = await fetch(`${BASE_URL}/reforge/checkpoint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Set checkpoint failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getReforgeVAEs(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/reforge/vaes`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ReForge VAEs failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data?.names) ? data.names : [];
}

export interface ReforgeOptionsBrief {
  current_vae: string;
  current_clip_skip: number;
}

export async function getReforgeOptions(): Promise<ReforgeOptionsBrief> {
  const res = await fetch(`${BASE_URL}/reforge/options`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ReForge options failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function postDownloadLora(url: string, filename?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/download-lora`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, filename }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download LoRA failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function postDownloadCheckpoint(url: string, filename?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/download-checkpoint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, filename }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download Checkpoint failed (${res.status}): ${text}`);
  }
  return res.json();
}