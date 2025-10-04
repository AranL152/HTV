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
