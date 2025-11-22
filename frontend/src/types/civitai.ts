export interface CivitaiImage {
  url?: string;
}

export interface CivitaiModelVersion {
  images?: CivitaiImage[];
}

export interface CivitaiModel {
  id: number;
  name: string;
  tags?: string[];
  modelVersions?: CivitaiModelVersion[];
}