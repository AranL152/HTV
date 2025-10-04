export interface Hill {
  id: number;
  center: [number, number];
  height: number;
  originalHeight: number;
  radius: number;
  label: string;
  description?: string;
  weight: number;
  color: string;
  sampleCount: number;
  samples?: string[];
}

export interface BiasMetrics {
  totalPoints: number;
  clusterCount: number;
  giniCoefficient: number;
  flatnessScore: number;
}

export interface TerrainData {
  hills: Hill[];
  gridSize: number;
  heightData: number[][];
  metrics: BiasMetrics;
}

export interface UploadResponse {
  dataset_id: string;
  status: string;
  row_count: number;
  columns: string[];
}

export interface StatusResponse {
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  message: string;
}

export interface AdjustResponse {
  success: boolean;
  updated_metrics: BiasMetrics;
  message: string;
}
