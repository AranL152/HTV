# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**For detailed implementation guidance, see `PLAN.md` which covers:**
- Step-by-step data processing pipeline
- Service-level architecture details
- Component interaction patterns
- API specifications with examples
- Visualization engine implementation
- Performance optimization strategies

This file (CLAUDE.md) covers the high-level stack and structure. Reference PLAN.md for specific implementation details when building features.

## Project Overview

**Level** is a multimodal dataset analysis and bias correction tool. Users upload datasets (CSV, audio, video, images), which are embedded using Snowflake's multimodal embeddings and clustered automatically. Gemini analyzes representative samples from each cluster to generate human-readable descriptions. The clusters are visualized as an interactive 3D topological terrain where each cluster is a "hill" - users can drag hills up or down to adjust their representation in the dataset, effectively rebalancing and debiasing the data in real-time.

**Visual Metaphor**: Your dataset is a landscape. Overrepresented clusters form tall mountains, underrepresented clusters appear as valleys. Drag mountains down to level the terrain and create a balanced dataset.

**Key Innovation**: Multimodal support means this works for any data type - not just text. Upload images, audio clips, videos, or structured data and get the same intuitive visualization and bias correction workflow.

**Focus**: Working demo with CSV initially, designed for future multimodal expansion.

## Technology Stack

### Frontend
- **Framework**: Next.js 15.5.4 (App Router, React 19.1.0)
- **Language**: TypeScript 5.x
- **3D Engine**: Three.js r128+ via @react-three/fiber + @react-three/drei
- **Styling**: Tailwind CSS
- **State**: React hooks (useState, useReducer)
- **API Client**: Native fetch

### Backend
- **Framework**: FastAPI (async, auto docs at /docs)
- **Language**: Python 3.11+
- **ML Stack**:
  - Embeddings: Snowflake Arctic Embed (multimodal - text, images, audio, video)
  - Clustering: DBSCAN (scikit-learn)
  - Dimensionality Reduction: UMAP (embeddings → 2D for terrain positioning)
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
│       │   └── visualize/page.tsx    # 3D terrain map
│       ├── components/
│       │   ├── upload/
│       │   │   └── FileUploader.tsx
│       │   ├── visualization/
│       │   │   ├── TerrainMap.tsx    # Main Three.js scene
│       │   │   ├── Terrain.tsx       # Mesh with displaced vertices
│       │   │   └── Hill.tsx          # Cluster markers
│       │   └── controls/
│       │       ├── DragControls.tsx  # Hill interaction
│       │       ├── MetricsPanel.tsx  # Dataset statistics
│       │       └── ClusterList.tsx   # Sidebar legend
│       ├── hooks/
│       │   ├── useDataset.ts
│       │   ├── useTerrain.ts
│       │   └── useDrag.ts
│       └── types/
│           └── terrain.ts
└── backend/
    ├── main.py                       # FastAPI app (single file OK)
    ├── services/
    │   ├── embedder.py               # Snowflake multimodal embeddings
    │   ├── clusterer.py              # DBSCAN clustering
    │   ├── sampler.py                # Sample representative points
    │   ├── analyzer.py               # Gemini cluster analysis
    │   └── terrain_builder.py        # Height map generation
    └── requirements.txt
```

## Data Pipeline

```
Upload (CSV/Audio/Video/Image) → 
Embed (Snowflake multimodal) → 
Cluster (DBSCAN) → 
Sample Representatives → 
Analyze (Gemini descriptions) → 
Reduce to 2D (UMAP) → 
Build Terrain → 
Visualize → 
Drag Hills (adjust weights) → 
Export Balanced Dataset
```

## API Endpoints

```
POST   /api/upload              # Upload any file type, return dataset_id
GET    /api/status/{id}         # Check processing status
GET    /api/terrain/{id}        # Get terrain data with cluster descriptions
POST   /api/adjust/{id}         # Adjust hill heights (reweight clusters)
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
    # Handle CSV, image, audio, video
    # Process and return dataset_id
    pass

@app.get("/api/terrain/{dataset_id}")
async def get_terrain(dataset_id: str):
    # Return terrain with Gemini-generated descriptions
    pass

@app.post("/api/adjust/{dataset_id}")
async def adjust_weights(dataset_id: str, adjustments: dict):
    # Update cluster weights based on hill heights
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Key Data Types

### TypeScript (Frontend)

```typescript
interface Hill {
  id: number;                    // Cluster ID
  center: [number, number];      // X, Z position on terrain
  height: number;                // Current height (adjustable)
  originalHeight: number;        // Initial height (cluster size)
  radius: number;                // Base radius
  label: string;                 // Gemini-generated description
  weight: number;                // Current weight (0-1, based on height)
  color: string;                 // Visual color
  sampleCount: number;           // Number of data points
  samples: string[];             // Sample data for tooltip
}

interface TerrainData {
  hills: Hill[];
  gridSize: number;              // Resolution (e.g., 100x100)
  heightData: number[][];        // 2D height array
  metrics: {
    totalPoints: number;
    clusterCount: number;
    giniCoefficient: number;     // Distribution inequality
    flatnessScore: number;       // 1 - gini (0 = uneven, 1 = flat)
  };
}
```

### Python (Backend)

```python
from pydantic import BaseModel
from typing import List, Optional

class Hill(BaseModel):
    id: int
    center: List[float]          # [x, z]
    height: float
    original_height: float
    radius: float
    label: str                   # Gemini description
    weight: float                # Sampling weight
    color: str
    sample_count: int
    samples: List[str]           # Representative samples

class TerrainData(BaseModel):
    hills: List[Hill]
    grid_size: int
    height_data: List[List[float]]
    metrics: dict
```

## Visualization Specs

### Three.js Terrain (Based on Reference Image)
- **Ground**: Large PlaneGeometry (200x200 units) with vertex displacement
- **Resolution**: 100x100 or 150x150 grid segments for smooth hills
- **Material**: MeshStandardMaterial with:
  - Red base color (#cc0000 to #ff4444 gradient based on height)
  - High metalness (0.6) and low roughness (0.3) for glossy appearance
  - Vertex colors for height-based shading
- **Background**: Dark space with particle stars (white dots)
- **Lighting**: 
  - Directional light from top-right for dramatic shadows
  - Subtle ambient light (0.2 intensity)
- **Camera**: Angled top-down view (45° from vertical)
- **Wireframe Toggle**: Button to show/hide mesh structure

### Hill Generation
```python
# Smooth Gaussian hills blended together
def generate_terrain(hills, grid_size=100):
    terrain = np.zeros((grid_size, grid_size))
    
    for hill in hills:
        cx, cz = hill.center
        height = hill.height
        radius = hill.radius
        
        for x in range(grid_size):
            for z in range(grid_size):
                dist = np.sqrt((x - cx)**2 + (z - cz)**2)
                # Gaussian falloff
                hill_contribution = height * np.exp(-(dist**2) / (2 * radius**2))
                terrain[x, z] += hill_contribution
    
    return terrain
```

### Drag Interaction
- **Click & Hold**: Select hill (glows/highlights)
- **Drag Up/Down**: Adjust height (0-200% of original)
- **Visual Feedback**: 
  - Real-time mesh deformation
  - Height percentage overlay
  - Weight indicator (0-2.0x)
- **Physics**: Smooth interpolation, no sudden jumps
- **Constraints**: Minimum height 0 (flat), maximum 2x original

## Weight Adjustment System

**Core Concept**: Hill height = sampling weight

```python
# When user drags hill to new height
new_weight = new_height / original_height

# Examples:
# - Drag to 50% height → 0.5x weight (sample half as often)
# - Drag to 0% height → 0.0x weight (exclude cluster)
# - Drag to 150% height → 1.5x weight (sample more often)
```

**Export Behavior**:
- Original dataset preserved with added `weight` column
- Downstream ML training uses weights for sampling
- Or: Generate new balanced dataset by resampling with weights

## Development Guidelines

### Frontend
- Use BufferGeometry for terrain (efficient vertex updates)
- Throttle drag events to 60 FPS max
- Smooth height transitions with lerp/tweening
- Error boundaries around Three.js canvas
- Tailwind only for UI components

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
pillow  # For image processing
librosa  # For audio processing (future)
opencv-python  # For video processing (future)
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

## Common Pitfalls

1. **Don't** use `THREE.CapsuleGeometry` (not in r128)
2. **Don't** forget CORS setup in FastAPI
3. **Don't** load Snowflake model multiple times
4. **Don't** update entire terrain mesh on drag (update vertices only)
5. **Don't** make terrain segments too low-res (looks blocky)

## Demo Script

1. **Upload**: CSV of resumes (Amazon hiring data example)
2. **Show**: 3D terrain loads with red mountainous landscape
3. **Identify**: Tallest mountain = "Senior Engineering - Male" (overrepresented)
4. **Drag Down**: Click and pull mountain to 30% height
5. **Observe**: 
   - Weight changes to 0.3x
   - Terrain smooths out
   - Gini coefficient improves
   - Flatness score increases
6. **Adjust**: Drag underrepresented valley up to 150% height
7. **Export**: Download rebalanced dataset with weights

## Future Multimodal Support

**Already designed for**:
- **Images**: Fashion datasets, medical imaging, satellite imagery
- **Audio**: Voice recordings, music analysis, sound classification
- **Video**: Surveillance footage, movie clips, educational content
- **Mixed**: Datasets with multiple modalities

**How it works**:
- Snowflake Arctic Embed handles all modalities
- Gemini analyzes samples regardless of type
- Same terrain visualization works for all data
- Export includes weights for any input type

---

**For implementation details**: See `PLAN.md` for in-depth component architecture and algorithms.