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
Visualize clusters as a waveform - each peak represents a cluster with its label
Interact - drag peaks up/down to control what % of each cluster to include (0-100%)
Export the rebalanced dataset

Use Case: Marketing candy to children, but your dataset has mostly adults? Drag the "Adults 35-50" peak down to 30%, drag "Children 5-10" up to 100%, and export a balanced dataset.
Tech Stack
Frontend: Next.js 15 (App Router), TypeScript, React 19, Tailwind, SVG waveform
Backend: FastAPI, Python 3.11+, Cohere embeddings, DBSCAN clustering, UMAP 1D ordering, Gemini API for cluster analysis
Data Flow: Upload → Cohere Embed → Cluster → Sample → Gemini Analyze → UMAP Order → Waveform → Adjust Amplitudes (0-100%) → Export
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
typescriptinterface ClusterPeak {
  id: number;
  x: number;                    // Position (0-1)
  amplitude: number;            // Current (0-100)
  label: string;                // Gemini description
  sampleCount: number;
  samples: string[];
}

interface WaveformData {
  peaks: ClusterPeak[];
  totalPoints: number;
  includedPoints: number;       // After amplitude adjustments
}
API
POST /api/upload              # Upload dataset → dataset_id
GET  /api/waveform/{id}       # Get waveform with Gemini labels
POST /api/adjust/{id}         # Adjust amplitudes (0-100%)
GET  /api/export/{id}         # Download rebalanced dataset
Key Concepts
Amplitude = Inclusion %:

100% = include all data from cluster
50% = include half
0% = exclude cluster

Waveform: Smooth Bezier curves connecting peaks. Drag peaks up/down with mouse.
Cluster Ordering: UMAP 1D projects cluster centers so similar clusters are adjacent on the waveform.