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

## What We're Building

Level is an interactive dataset rebalancing tool. Upload a CSV (multimodal support planned), and we:

1. Embed the data using Cohere's multimodal embeddings
2. Cluster similar data points together with DBSCAN
3. Analyze each cluster with Gemini to generate human-readable labels
4. Visualize clusters as a waveform - each peak height represents cluster size
5. Interact - drag peaks up/down to adjust how many datapoints to include from each cluster
6. Export the pruned dataset with only selected datapoints

Use Case: Marketing candy to children, but your dataset has mostly adults? Drag the "Adults 35-50" peak down to reduce adults, keep "Children 5-10" at full height, and export a balanced dataset.

## Development Commands

### Backend
```bash
cd backend

# Setup (uses uv for fast package management)
uv venv
source .venv/bin/activate  # or `.venv/Scripts/activate` on Windows
uv pip install -e .

# Environment setup
cp .env.example .env
# Then edit .env with your API keys:
# - GEMINI_API_KEY (required)
# - COHERE_API_KEY (required)

# Run server
python main.py
# or
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Development server (with Turbopack)
npm run dev

# Build
npm run build

# Production
npm start

# Lint
npm run lint
```

### Full Stack
Run both servers concurrently during development:
- Backend: http://localhost:8000
- Frontend: http://localhost:3000

## Tech Stack

**Frontend:** Next.js 15.5.4 (App Router), TypeScript, React 19, Tailwind CSS 4, SVG waveform visualization

**Backend:** FastAPI, Python 3.11+, Cohere embeddings, DBSCAN clustering, UMAP 1D ordering, Gemini API for cluster analysis

**Data Flow:** Upload → Cohere Embed → Cluster → Sample → Gemini Analyze → UMAP Order → Waveform → Adjust Counts (0 to cluster size) → Export Pruned Dataset

## Project Structure

```
/
├── backend/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── config.py            # Environment config with validation
│   ├── services/            # Core processing pipeline
│   │   ├── embedder.py      # Cohere embeddings
│   │   ├── clusterer.py     # DBSCAN + UMAP 1D projection
│   │   ├── analyzer.py      # Gemini cluster descriptions
│   │   └── waveform.py      # Waveform data builder
│   ├── llm/                 # AI features
│   │   ├── balance.py       # Auto-balance suggestions
│   │   ├── chat.py          # Chat responses
│   │   └── prompts.py       # Prompt templates (domain-specific config)
│   ├── utils/
│   │   └── metrics.py       # Gini coefficient, etc.
│   └── pyproject.toml       # Dependencies
│
└── frontend/src/
    ├── app/
    │   ├── page.tsx                 # Landing page
    │   └── visualize/page.tsx       # Main waveform view
    ├── components/
    │   ├── FileUploader.tsx         # CSV upload
    │   ├── Waveform.tsx             # SVG waveform with drag interaction
    │   ├── MetricsPanel.tsx         # Display Gini, flatness, etc.
    │   ├── ClusterDetailModal.tsx   # Show cluster samples
    │   └── ChatBox.tsx              # AI chat interface
    ├── types/
    │   └── index.ts                 # TypeScript interfaces
    └── lib/
```

## Architecture Notes

### Backend Pipeline
The backend processes data synchronously (fast enough for demo) with in-memory storage:
1. **Upload** (`/api/upload`): Receives CSV, generates embeddings, clusters, analyzes with Gemini, builds waveform
2. **Storage**: Datasets stored in `datasets: Dict[str, Dict]` with ID as key
3. **Waveform** (`/api/waveform/{id}`): Returns cached waveform data
4. **Adjust** (`/api/adjust/{id}`): Updates selectedCount per cluster
5. **Export** (`/api/export/{id}`): Generates CSV with only selected datapoints

### Frontend Pages
- **`/`**: Landing page with upload interface
- **`/visualize?id={dataset_id}`**: Main waveform view with draggable peaks, metrics panel, and AI chat

### AI Features
The system includes AI-powered features via Gemini:
- **Cluster descriptions**: Automatically labels each cluster (in `analyzer.py`)
- **Balance suggestions**: AI analyzes waveform and suggests adjustments (in `llm/balance.py`)
- **Chat interface**: Users can ask questions about their data (in `llm/chat.py`)
- **Domain-specific prompts**: `llm/prompts.py` contains hardcoded domain configuration (currently: resumes)

### Environment Configuration
Backend requires API keys in `.env`:
- `GEMINI_API_KEY`: Required for cluster analysis and AI features
- `COHERE_API_KEY`: Required for embeddings
- `ALLOWED_ORIGINS`: CORS config (default: `http://localhost:3000`)

Frontend connects to backend at `http://localhost:8000` (configurable via environment)

## Core Types

```typescript
interface ClusterPeak {
  id: number;
  x: number;                    // Position (0-1) from UMAP projection
  selectedCount: number;        // Current selected datapoints (0 to sampleCount)
  label: string;                // Gemini-generated description
  color: string;                // Hex color
  sampleCount: number;          // Total datapoints in cluster
  samples: string[];            // Representative samples
}

interface WaveformData {
  peaks: ClusterPeak[];
  totalPoints: number;
  metrics: {
    giniCoefficient: number;    // Distribution inequality (0 = equal, 1 = unequal)
    flatnessScore: number;      // How flat the waveform is
    avgAmplitude: number;       // Average selection ratio
  };
}
```

## API Endpoints

```
POST /api/upload              # Upload CSV → dataset_id
GET  /api/waveform/{id}       # Get waveform with Gemini labels
POST /api/adjust/{id}         # Adjust selectedCount per cluster
     Body: { adjustments: [{ id: number, selectedCount: number }] }
GET  /api/export/{id}         # Download CSV with only selected datapoints
POST /api/chat/{id}           # Chat with AI about dataset
     Body: { message: string }
```

## Key Concepts

### Count-Based Pruning
- Each cluster starts with all datapoints selected (`selectedCount = sampleCount`)
- Drag peaks up/down to adjust `selectedCount` (0 to `sampleCount`)
- Export literally prunes the dataset to only include `selectedCount` rows per cluster
- Cannot exceed original cluster size (only reduction allowed)

### Waveform Visualization
- Peak height = `selectedCount` relative to largest cluster
- Smooth cubic Bezier curves connecting peaks
- Drag peaks up/down with mouse
- Display shows "X / Y datapoints" on hover
- SVG-based rendering for smooth animations

### Cluster Ordering
UMAP 1D projects cluster centers so similar clusters are adjacent on the waveform, creating a smooth visual flow.

### AI Balance Suggestions
On upload, the system automatically analyzes the dataset and suggests balance adjustments based on domain-specific rules (see `llm/prompts.py`). Currently configured for resume datasets with bias mitigation.

## Visual Style

Minimalist black & white aesthetic:
- Background: `#000000`
- Text: `#ffffff`
- Borders: `#333333`
- Waveform: White stroke
- Clean, no shadows, simple borders