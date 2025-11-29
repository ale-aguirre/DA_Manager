export interface PlannerDraftItem {
  character_name: string;
  trigger_words: string[];
}

export interface PlannerJob {
  character_name: string;
  prompt: string;
  seed: number;
  // Opcionales: integración con A1111 y marcado de IA
  negative_prompt?: string;
  ai_meta?: Record<string, unknown>;
  locked_fields?: string[]; // Campos bloqueados (outfit, pose, etc.)
  // Campos explícitos para UI
  outfit?: string;
  pose?: string;
  location?: string;
  lighting?: string;
  camera?: string;
  expression?: string;
  hairstyle?: string;
}

export interface RecommendedParams {
  cfg: number;
  steps: number;
  sampler: string;
}

export interface ReferenceImage {
  url: string;
  meta: Record<string, unknown>;
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

// Configuración técnica por personaje
export interface TechConfig {
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
  positivePrompt?: string;
}

// Metadatos de recursos usados en ejecución
export interface ResourceMeta {
  character_name: string;
  download_url?: string;
  filename?: string;
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
  checkpoints?: string[];
  vaes?: string[];
  loras?: string[];
}
