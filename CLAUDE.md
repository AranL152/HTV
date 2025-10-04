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

## Project Overview

**Level** is a dataset analysis and bias correction tool. Users upload a CSV dataset, which gets embedded using Snowflake embeddings and clustered automatically. Gemini analyzes representative samples from each cluster to generate human-readable descriptions. The clusters are visualized as an interactive 2D waveform where each cluster appears as a peak or valley - users can drag segments up or down to adjust their representation in the dataset, effectively rebalancing and debiasing the data in real-time.

**Visual Metaphor**: Your dataset is a waveform. Overrepresented clusters form tall peaks, underrepresented clusters appear as valleys. Drag peaks down or valleys up to level the wave and create a balanced dataset.

**Goal**: Ship a working CSV demo for the hackathon.

## Technology Stack

### Frontend
- **Framework**: Next.js 15.5.4 (App Router, React 19.1.0)
- **Language**: TypeScript 5.x
- **Visualization**: SVG-based waveform (D3.js optional) or Canvas
- **Styling**: Tailwind CSS
- **State**: React hooks (useState, useReducer)
- **API Client**: Native fetch

### Backend
- **Framework**: FastAPI (async, auto docs at /docs)
- **Language**: Python 3.11+
- **ML Stack**:
  - Embeddings: Snowflake Arctic Embed
  - Clustering: DBSCAN (scikit-learn)
  - Cluster Ordering: UMAP 1D projection (arranges similar clusters adjacently)
  - Cluster Analysis: Google Gemini API (generates cluster descriptions from samples)
- **Data**: pandas, numpy
- **Storage**: In-memory dict (no database for hackathon)

## Project Structure

```
level/
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Landing page
│       │   ├── upload/page.tsx       # File upload
│       │   └── visualize/page.tsx    # Waveform visualization
│       ├── components/
│       │   ├── upload/
│       │   │   └── FileUploader.tsx
│       │   ├── visualization/
│       │   │   ├── Waveform.tsx      # Main SVG/Canvas waveform
│       │   │   ├── ClusterPeak.tsx   # Individual draggable peaks
│       │   │   └── WaveformPath.tsx  # Smooth curve rendering
│       │   └── controls/
│       │       ├── DragControls.tsx  # Peak drag interaction
│       │       ├── MetricsPanel.tsx  # Dataset statistics
│       │       └── ClusterList.tsx   # Sidebar legend
│       ├── hooks/
│       │   ├── useDataset.ts
│       │   ├── useWaveform.ts
│       │   └── useDrag.ts
│       └── types/
│           └── waveform.ts
└── backend/
    ├── main.py                       # FastAPI app
    ├── services/
    │   ├── embedder.py               # Snowflake multimodal embeddings
    │   ├── clusterer.py              # DBSCAN clustering
    │   ├── sampler.py                # Sample representative points
    │   ├── analyzer.py               # Gemini cluster analysis
    │   └── waveform_builder.py       # 1D projection and waveform data
    └── requirements.txt
```

## Data Pipeline

```
Upload CSV → 
Embed (Snowflake) → 
Cluster (DBSCAN) → 
Sample Representatives → 
Analyze (Gemini descriptions) → 
Arrange (UMAP 1D - similar clusters adjacent) → 
Build Waveform → 
Visualize → 
Drag Peaks (adjust weights) → 
Export Balanced Dataset
```

## API Endpoints

```
POST   /api/upload              # Upload any file type, return dataset_id
GET    /api/status/{id}         # Check processing status
GET    /api/waveform/{id}       # Get waveform data with cluster descriptions
POST   /api/adjust/{id}         # Adjust peak amplitudes (reweight clusters)
GET    /api/export/{id}         # Download rebalanced dataset with weights
```

## FastAPI Structure

```python
# main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI()

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
datasets = {}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    # Handle CSV only
    # Process and return dataset_id
    pass

@app.get("/api/waveform/{dataset_id}")
async def get_waveform(dataset_id: str):
    # Return waveform with Gemini-generated descriptions
    pass

@app.post("/api/adjust/{dataset_id}")
async def adjust_weights(dataset_id: str, adjustments: dict):
    # Update cluster weights based on peak amplitudes
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Key Data Types

### TypeScript (Frontend)

```typescript
interface ClusterPeak {
  id: number;                    // Cluster ID
  x: number;                     // Position along waveform (0-1)
  amplitude: number;             // Current amplitude (adjustable)
  originalAmplitude: number;     // Initial amplitude (cluster size)
  label: string;                 // Gemini-generated description
  weight: number;                // Current weight (0-2, based on amplitude)
  color: string;                 // Visual color
  sampleCount: number;           // Number of data points
  samples: string[];             // Sample data for tooltip
}

interface WaveformData {
  peaks: ClusterPeak[];
  totalPoints: number;
  metrics: {
    giniCoefficient: number;     // Distribution inequality (0-1)
    flatnessScore: number;       // 1 - gini (0 = uneven, 1 = flat)
    avgAmplitude: number;
  };
}
```

### Python (Backend)

```python
from pydantic import BaseModel
from typing import List, Optional

class ClusterPeak(BaseModel):
    id: int
    x: float                     # 0-1 position along wave
    amplitude: float
    original_amplitude: float
    label: str                   # Gemini description
    weight: float                # Sampling weight
    color: str
    sample_count: int
    samples: List[str]           # Representative samples

class WaveformData(BaseModel):
    peaks: List[ClusterPeak]
    total_points: int
    metrics: dict
```

## Visualization Specs

### SVG Waveform (Recommended for MVP)
```typescript
// Simple, clean, scalable
<svg width={800} height={400}>
  {/* Smooth path through all peaks */}
  <path d={generateSmoothPath(peaks)} />
  
  {/* Draggable peak markers */}
  {peaks.map(peak => (
    <circle 
      cx={peak.x * width} 
      cy={(1 - peak.amplitude) * height}
      r={8}
      draggable
    />
  ))}
  
  {/* Labels */}
  {peaks.map(peak => (
    <text x={peak.x * width} y={...}>
      {peak.label}
    </text>
  ))}
</svg>
```

### Waveform Style: Smooth Curve

Use **cubic Bezier curves** connecting peaks for an audio-like waveform feel:

```typescript
// Generate smooth path through all peaks
function generateSmoothPath(peaks: ClusterPeak[], width: number, height: number): string {
  if (peaks.length === 0) return '';
  
  const points = peaks.map(p => ({
    x: p.x * width,
    y: (1 - p.amplitude) * height
  }));
  
  // Start path
  let path = `M ${points[0].x} ${points[0].y}`;
  
  // Cubic bezier through each point
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Control points for smooth curve
    const cp1x = prev.x + (curr.x - prev.x) / 3;
    const cp1y = prev.y;
    const cp2x = curr.x - (next ? (next.x - curr.x) / 3 : 0);
    const cp2y = curr.y;
    
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }
  
  return path;
}
```

**Visual characteristics:**
- Smooth valleys between clusters
- No sharp corners or discontinuities
- Feels like audio waveform or heart rate monitor
- Professional, polished aesthetic

### Drag Interaction
- **Click & Hold**: Select peak (highlights, shows tooltip)
- **Drag Up/Down**: Adjust amplitude (0-200% of original)
- **Visual Feedback**: 
  - Real-time path smoothing
  - Amplitude percentage overlay
  - Weight indicator (0-2.0x)
- **Constraints**: Minimum amplitude 0 (flat), maximum 2x original

## Weight Adjustment System

**Core Concept**: Peak amplitude = sampling weight

```python
# When user drags peak to new amplitude
new_weight = new_amplitude / original_amplitude

# Examples:
# - Drag to 50% amplitude → 0.5x weight (sample half as often)
# - Drag to 0% amplitude → 0.0x weight (exclude cluster)
# - Drag to 150% amplitude → 1.5x weight (sample more often)
```

**Export Behavior**:
- Original dataset preserved with added `weight` column
- Downstream ML training uses weights for sampling
- Or: Generate new balanced dataset by resampling with weights

## Cluster Ordering Algorithm

```python
# Use UMAP to project embeddings to 1D
# This keeps similar clusters adjacent on the waveform

from umap import UMAP

def order_clusters(cluster_centers):
    """
    Projects cluster centers to 1D and sorts them.
    Similar clusters appear next to each other.
    """
    umap_1d = UMAP(n_components=1, random_state=42)
    positions = umap_1d.fit_transform(cluster_centers)
    
    # Sort clusters by 1D position
    sorted_indices = np.argsort(positions.flatten())
    
    # Normalize to 0-1 range
    normalized_positions = (positions - positions.min()) / (positions.max() - positions.min())
    
    return sorted_indices, normalized_positions
```

## Development Guidelines

### Frontend
- Use SVG for MVP (faster than Canvas, easier to debug)
- Implement smooth drag with requestAnimationFrame
- Show cluster labels on hover (tooltip)
- Add amplitude percentage indicator during drag
- Use Tailwind for all UI components outside waveform

### Backend
- Load Snowflake model once at startup (global cache)
- Batch Gemini API calls (analyze multiple clusters concurrently)
- Use asyncio for parallel processing
- Store original data + weights (never destructive)
- Handle multimodal file types gracefully

## Environment Variables

```bash
# Backend (.env)
GEMINI_API_KEY=your_key

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Required Python Packages

```
fastapi>=0.104.0
uvicorn>=0.24.0
sentence-transformers>=2.2.0
torch>=2.0.0
google-generativeai>=0.3.0
scikit-learn>=1.3.0
umap-learn>=0.5.0
pandas>=2.0.0
numpy>=1.24.0
python-multipart
scipy
```

## Running the App

```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py  # http://localhost:8000

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:3000
```

## Demo Script

1. **Upload**: CSV of customer data (candy sales example)
2. **Show**: Waveform appears with peaks labeled by Gemini:
   - "Children 5-10" (small peak)
   - "Teens 11-17" (medium peak)
   - "Adults 18-34" (large peak)
   - "Adults 35-50" (tallest peak - overrepresented)
   - "Seniors 50+" (medium peak)
3. **Identify**: Tallest peak = "Adults 35-50" (overrepresented for candy sales)
4. **Drag Down**: Click and drag "Adults 35-50" peak to 30% amplitude
5. **Drag Up**: Click and drag "Children 5-10" valley to 150% amplitude
6. **Observe**: 
   - Weights adjust in real-time
   - Waveform smooths out (more level)
   - Gini coefficient improves (0.45 → 0.28)
   - Flatness score increases (0.55 → 0.72)
7. **Export**: Download rebalanced dataset with weights for targeted marketing

## Common Pitfalls

1. **Don't** over-engineer - CSV support is enough for demo
2. **Don't** forget CORS setup in FastAPI
3. **Don't** load Snowflake model multiple times (cache it)
4. **Don't** make waveform update lag - use requestAnimationFrame
5. **Don't** add features that aren't in the demo - ship the core experience