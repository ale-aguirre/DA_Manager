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
  ai_meta?: Record<string, string>;
}

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