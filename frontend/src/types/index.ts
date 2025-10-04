/**
 * TypeScript interfaces for Level waveform visualizer
 */

export interface ClusterPeak {
  id: number;
  x: number;              // 0-1 position along waveform
  amplitude: number;      // Current height (adjustable)
  originalAmplitude: number;
  label: string;          // Gemini-generated description
  weight: number;         // Sampling weight
  color: string;          // Hex color for visualization
  sampleCount: number;    // Number of data points in cluster
  samples: string[];      // Representative samples for tooltip
}

export interface WaveformData {
  peaks: ClusterPeak[];
  totalPoints: number;
  metrics: {
    giniCoefficient: number;
    flatnessScore: number;
    avgAmplitude: number;
  };
}

// API types
export interface AdjustmentRequest {
  adjustments: Array<{
    id: number;
    amplitude: number;
  }>;
}

export interface UploadResponse {
  dataset_id: string;
  total_points: number;
  num_clusters: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  response: string;
}
