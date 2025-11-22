export interface CivitaiImage {
  url: string;
  type: "image" | "video";
  nsfwLevel?: string;
}

export interface CivitaiFile {
  downloadUrl?: string;
  sizeKB?: number;
  type?: string;
  format?: string;
}

export interface CivitaiModelVersion {
  images?: CivitaiImage[];
  files?: CivitaiFile[];
  // Optional convenience if API ever exposes direct field
  downloadUrl?: string;
}

export interface CivitaiStats {
  downloadCount?: number;
  thumbsUpCount?: number;
  ratingCount?: number;
  rating?: number;
}

export interface CivitaiModel {
  id: number;
  name: string;
  createdAt?: string;
  tags?: string[];
  stats?: CivitaiStats;
  images?: CivitaiImage[];
  modelVersions?: CivitaiModelVersion[];
  // Indicador local
  local_exists?: boolean;
  // Categoría IA (backend)
  ai_category?: "Character" | "Pose" | "Clothing" | "Style" | "Concept";
}