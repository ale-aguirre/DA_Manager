export interface PlannerDraftItem {
  character_name: string;
  trigger_words: string[];
}

export interface PlannerJob {
  character_name: string;
  prompt: string;
  seed: number;
}

export interface FactoryStatus {
  is_active: boolean;
  current_job_index: number;
  total_jobs: number;
  current_character: string | null;
  last_image_url?: string | null;
  last_image_b64?: string | null;
  logs?: string[];
}

const BASE_URL = "http://127.0.0.1:8000";

export async function postPlannerDraft(items: PlannerDraftItem[]): Promise<{ jobs: PlannerJob[] }> {
  const res = await fetch(`${BASE_URL}/planner/draft`, {
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

export async function magicFixPrompt(prompt: string): Promise<{ prompt: string }> {
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
}

export async function getPlannerResources(): Promise<PlannerResources> {
  const res = await fetch(`${BASE_URL}/planner/resources`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Planner resources failed (${res.status}): ${text}`);
  }
  return res.json();
}