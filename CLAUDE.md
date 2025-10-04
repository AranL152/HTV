# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**For detailed implementation guidance, see `PLAN.md` which covers:**
- Step-by-step data processing pipeline
- Service-level architecture details
- Component interaction patterns
- API specifications with examples
- Waveform rendering implementation
- Performance optimization strategies

This file (CLAUDE.md) covers the high-level stack and structure. Reference PLAN.md for specific implementation details when building features.

What We're Building
Level is an interactive dataset rebalancing tool. Upload a CSV (multimodal support planned), and we:

Embed the data using Cohere's multimodal embeddings
Cluster similar data points together with DBSCAN
Analyze each cluster with Gemini to generate human-readable labels
Visualize clusters as a waveform - each peak height represents cluster size
Interact - drag peaks up/down to adjust how many datapoints to include from each cluster
Export the pruned dataset with only selected datapoints

Use Case: Marketing candy to children, but your dataset has mostly adults? Drag the "Adults 35-50" peak down to reduce adults, keep "Children 5-10" at full height, and export a balanced dataset.
Tech Stack
Frontend: Next.js 15 (App Router), TypeScript, React 19, Tailwind, SVG waveform
Backend: FastAPI, Python 3.11+, Cohere embeddings, DBSCAN clustering, UMAP 1D ordering, Gemini API for cluster analysis
Data Flow: Upload → Cohere Embed → Cluster → Sample → Gemini Analyze → UMAP Order → Waveform → Adjust Counts (0 to cluster size) → Export Pruned Dataset
Project Structure
level/
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Landing
│       │   ├── upload/page.tsx       # Upload
│       │   └── visualize/page.tsx    # Waveform
│       ├── components/
│       │   ├── upload/FileUploader.tsx
│       │   └── visualization/
│       │       ├── Waveform.tsx
│       │       └── ClusterPeak.tsx
│       ├── hooks/
│       │   ├── useDataset.ts
│       │   └── useWaveform.ts
│       └── types/waveform.ts
└── backend/
    ├── main.py
    └── services/
        ├── embedder.py          # Cohere embeddings
        ├── clusterer.py         # DBSCAN
        ├── sampler.py
        ├── analyzer.py          # Gemini
        └── waveform_builder.py  # UMAP 1D ordering
Core Types
```typescript
interface ClusterPeak {
  id: number;
  x: number;                    // Position (0-1)
  selectedCount: number;        // Number of datapoints selected (0 to sampleCount)
  label: string;                // Gemini description
  color: string;                // Hex color
  sampleCount: number;          // Total datapoints in cluster
  samples: string[];            // Representative samples
}

interface WaveformData {
  peaks: ClusterPeak[];
  totalPoints: number;
  metrics: {
    giniCoefficient: number;
    flatnessScore: number;
    avgAmplitude: number;       // Average selection ratio
  };
}
```
API
```
POST /api/upload              # Upload dataset → dataset_id
GET  /api/waveform/{id}       # Get waveform with Gemini labels
POST /api/adjust/{id}         # Adjust selectedCount per cluster
GET  /api/export/{id}         # Download pruned dataset
```

Key Concepts
**Count-Based Pruning:**
- Each cluster starts with all datapoints selected (selectedCount = sampleCount)
- Drag peaks up/down to adjust selectedCount (0 to sampleCount)
- Export literally prunes the dataset to only include selectedCount rows per cluster
- Cannot exceed original cluster size (only reduction allowed)

**Waveform Visualization:**
- Peak height = selectedCount relative to largest cluster
- Smooth Bezier curves connecting peaks
- Drag peaks up/down with mouse
- Display shows "X / Y datapoints" on hover

**Cluster Ordering:** UMAP 1D projects cluster centers so similar clusters are adjacent on the waveform.