export interface CivitaiImage {
  url: string;
  type: "image" | "video";
  nsfwLevel?: string;
}

export interface CivitaiModelVersion {
  images?: CivitaiImage[];
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
  tags?: string[];
  stats?: CivitaiStats;
  images?: CivitaiImage[];
  modelVersions?: CivitaiModelVersion[];
}