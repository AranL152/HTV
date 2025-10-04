/**
 * TypeScript interfaces for Level waveform visualizer
 */

export interface ClusterPeak {
  id: number;
  x: number;              // 0-1 position along waveform
  selectedCount: number;  // Number of datapoints selected (0 to sampleCount)
  suggestedCount?: number;  // AI-suggested count for this cluster
  reasoning?: string;     // AI reasoning for suggestion
  label: string;          // Gemini-generated description
  color: string;          // Hex color for visualization
  sampleCount: number;    // Total number of data points in cluster
  samples: string[];      // Representative samples for tooltip
}

export interface WaveformData {
  peaks: ClusterPeak[];
  totalPoints: number;
  metrics: {
    giniCoefficient: number;
    flatnessScore: number;
    avgAmplitude: number;  // Average selection ratio (selectedCount/sampleCount)
  };
  strategy?: string;  // AI strategy description (for suggestions)
}

// API types
export interface AdjustmentRequest {
  adjustments: Array<{
    id: number;
    selectedCount: number;
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
  suggestions?: WaveformData;  // Optional waveform suggestions from chat
}
