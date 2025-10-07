/**
 * TypeScript interfaces for Level waveform visualizer
 */

// Individual peak structure for each waveform type
export interface WaveformPeak {
  id: number;
  x: number;       // 0-1 position along waveform
  count: number;   // Number of datapoints
  weight: number;  // Weight for this cluster (0.01 to 2.0)
  label: string;   // Gemini-generated description
  color: string;   // Hex color for visualization
  reasoning?: string;  // AI reasoning (for AI waveform only)
}

// Base waveform peak includes sample metadata
export interface BasePeak extends WaveformPeak {
  sampleCount: number;  // Total number of data points in cluster
  samples: string[];    // Representative samples for tooltip
}

// Base waveform structure (immutable, original dataset)
export interface BaseWaveform {
  peaks: BasePeak[];
  totalPoints: number;
}

// User and AI waveforms have simpler structure
export interface Waveform {
  peaks: WaveformPeak[];
  totalPoints: number;
  strategy?: string;  // AI strategy (for AI waveform only)
}

// Response from backend with all three waveforms
export interface AllWaveformsResponse {
  base: BaseWaveform;
  user: Waveform;
  ai: Waveform;
  metrics: {
    giniCoefficient: number;
    flatnessScore: number;
    avgAmplitude: number;
  };
  strategy: string;
}

// Waveform mode
export type WaveformMode = 'count' | 'weight';

// API types
export interface AdjustmentRequest {
  adjustments: Array<{
    id: number;
    count?: number;
    weight?: number;
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
  suggestions?: AllWaveformsResponse;  // Optional waveform suggestions from chat
}
