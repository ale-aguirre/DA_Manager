export interface PlannerDraftItem {
  character_name: string;
  trigger_words: string[];
}

export interface PlannerJob {
  character_name: string;
  prompt: string;
  seed: number;
}