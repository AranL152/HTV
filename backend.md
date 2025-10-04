# BACKEND.md

Backend implementation guide for Level.

## Overview

The backend is a FastAPI application that processes datasets through a pipeline: embedding → clustering → analysis → terrain generation. It exposes REST endpoints for upload, status checking, terrain retrieval, weight adjustment, and export.

**Core Responsibilities**:
- Parse uploaded CSV files
- Generate embeddings using Snowflake Arctic Embed
- Cluster data with DBSCAN
- Analyze clusters with Gemini API
- Build 3D terrain height maps
- Manage weight adjustments
- Export balanced datasets

## Architecture

```
FastAPI Application (main.py)
    ↓
Services Layer
├── embedder.py        → Snowflake Arctic Embed (text → 768D vectors)
├── clusterer.py       → DBSCAN clustering + statistics
├── sampler.py         → Sample representative points per cluster
├── analyzer.py        → Gemini API (generate cluster descriptions)
└── terrain_builder.py → Height map generation (Gaussian hills)
    ↓
In-Memory Storage (dict)
    ↓
Export / API Responses
```

## Service Responsibilities

### Embedder Service
**Purpose**: Generate embeddings from text data

**Key Functions**:
- `load_model()` - Load Snowflake model once at startup (global cache)
- `embed_texts(texts, batch_size=32)` - Generate embeddings with batching
- Handle OOM errors by reducing batch size

**Technical Details**:
- Uses `sentence-transformers` library
- Model: `Snowflake/snowflake-arctic-embed-l` (768D)
- L2 normalization applied
- Batch size: 32 (CPU) or 64 (GPU)

### Clusterer Service
**Purpose**: Group similar embeddings into clusters

**Key Functions**:
- `cluster_embeddings(embeddings, eps=0.5, min_samples=5)` - Run DBSCAN
- `calculate_cluster_stats(embeddings, labels)` - Get size, centroid, spread
- `compute_gini_coefficient(cluster_sizes)` - Measure distribution inequality
- `estimate_optimal_eps(embeddings)` - Auto-tune DBSCAN parameters

**Technical Details**:
- Uses scikit-learn DBSCAN with cosine distance
- Returns cluster labels, count, noise points
- Calculates per-cluster statistics for terrain generation

### Sampler Service
**Purpose**: Extract representative data points from each cluster

**Key Functions**:
- `sample_cluster(embeddings, data, k=5)` - Get k-nearest to centroid
- `sample_all_clusters(embeddings, labels, data)` - Sample from all clusters

**Technical Details**:
- Uses cosine distance to cluster centroid
- Samples 5-10 most representative points per cluster
- These samples are sent to Gemini for analysis

### Analyzer Service
**Purpose**: Generate human-readable cluster descriptions

**Key Functions**:
- `analyze_cluster(samples, cluster_id)` - Call Gemini for one cluster
- `analyze_all_clusters(cluster_samples)` - Batch analyze with async

**Technical Details**:
- Uses Google Gemini API (`gemini-1.5-flash`)
- Generates 2-4 word labels + brief descriptions
- Handles API failures gracefully (fallback to generic labels)
- Temperature: 0.3, Max tokens: 100

### Terrain Builder Service
**Purpose**: Create 3D height map from cluster data

**Key Functions**:
- `build_terrain(positions_2d, labels, stats, analyses)` - Complete terrain structure
- `add_gaussian_hill(grid, center, height, radius)` - Add single hill
- `generate_color(cluster_id)` - Assign distinct colors

**Technical Details**:
- Creates 100x100 grid (configurable)
- Each cluster becomes a Gaussian hill: `height * exp(-dist² / (2*radius²))`
- Hills blend additively
- Applies Gaussian smoothing for organic appearance
- Normalizes heights to 0-10 range

## Data Processing Pipeline

### Full Flow (main.py)

```python
1. POST /api/upload
   ↓
2. Parse CSV → extract text column
   ↓
3. Generate embeddings (Snowflake)
   ↓
4. Cluster embeddings (DBSCAN)
   ↓
5. Sample representatives from each cluster
   ↓
6. Analyze with Gemini (generate labels)
   ↓
7. Reduce to 2D with UMAP
   ↓
8. Build terrain (Gaussian hills)
   ↓
9. Store in memory with dataset_id
   ↓
10. Return dataset_id to client
```

**Status Updates**: Processing happens async with progress tracking (0-100%)

## API Endpoints

### POST `/api/upload`
- Accept CSV file via multipart/form-data
- Optional: `text_column` parameter
- Validates file size (<50MB) and type
- Returns `dataset_id` immediately
- Starts async processing

### GET `/api/status/{dataset_id}`
- Returns processing status: `processing`, `completed`, `failed`
- Includes progress percentage (0-100)
- Current stage: `embedding`, `clustering`, `analyzing`, `building_terrain`

### GET `/api/terrain/{dataset_id}`
- Returns complete terrain data structure
- Includes: hills, heightData grid, metrics
- Only available when status = `completed`

### POST `/api/adjust/{dataset_id}`
- Request body: `{"adjustments": {cluster_id: new_weight}}`
- Updates cluster weights in storage
- Recalculates Gini coefficient and flatness score
- Returns updated metrics

### GET `/api/export/{dataset_id}`
- Query param: `format=weighted` or `format=resampled`
- `weighted`: Adds `weight` column to original CSV
- `resampled`: Generates new dataset with weighted sampling
- Returns CSV file for download

## Data Storage

### In-Memory Structure

```python
datasets = {
    'dataset_id_123': {
        'status': 'completed',
        'progress': 100,
        'data': pd.DataFrame(...),        # Original CSV
        'texts': [...],                   # Extracted text column
        'embeddings': np.array(...),      # 768D vectors
        'labels': np.array(...),          # Cluster assignments
        'positions_2d': np.array(...),    # UMAP 2D coordinates
        'cluster_stats': [...],           # Size, centroid, spread
        'cluster_analyses': {...},        # Gemini descriptions
        'cluster_weights': {0: 0.5, ...}, # User adjustments
        'terrain': {...},                 # Height map structure
        'created_at': datetime,
        'last_accessed': datetime
    }
}
```

**Cleanup Strategy**:
- Remove datasets older than 24 hours
- Keep max 10 datasets in memory
- LRU eviction based on `last_accessed`

## Key Algorithms

### Gaussian Hill Formula
```python
height(x, z) = max_height * exp(-distance² / (2 * radius²))

where:
- max_height = (cluster_size / max_cluster_size) * 10
- radius = cluster_std * 2
- distance = sqrt((x - center_x)² + (z - center_z)²)
```

### Gini Coefficient
```python
gini = (2 * Σ(i * size_i)) / (n * Σ(sizes)) - (n + 1) / n

Measures inequality:
- 0.0 = perfect equality (flat terrain)
- 1.0 = maximum inequality (single giant mountain)
```

### Weight Application
```python
weight = current_height / original_height

Effective cluster size = original_size * weight
```

## Configuration

### Environment Variables
```bash
GEMINI_API_KEY=required
MAX_UPLOAD_SIZE=52428800  # 50 MB
CORS_ORIGINS=http://localhost:3000
GRID_SIZE=100
DEFAULT_EPS=0.5
```

### Performance Tuning
- Embedding batch size: 32 (CPU) or 64 (GPU)
- UMAP n_neighbors: 15
- DBSCAN eps: 0.5 (auto-estimated per dataset)
- Grid resolution: 100x100 (10,000 vertices)
- Max datasets in memory: 10

## Error Handling

### Common Errors
- **File too large**: HTTP 413, max 50MB
- **Invalid CSV**: HTTP 400, parsing failed
- **Dataset too small**: HTTP 400, min 50 rows
- **Dataset not found**: HTTP 404
- **Processing failed**: Status field shows error message
- **OOM during embedding**: Retry with smaller batch size
- **Gemini API timeout**: Fallback to generic labels

### Graceful Degradation
- Gemini fails → Use "Cluster {id}" labels
- Embedding OOM → Reduce batch size to 8
- Model loading fails → Clear error message

## Deployment

### Requirements
```txt
fastapi>=0.104.0
uvicorn>=0.24.0
sentence-transformers>=2.2.0
torch>=2.0.0
google-generativeai>=0.3.0
scikit-learn>=1.3.0
umap-learn>=0.5.0
pandas>=2.0.0
numpy>=1.24.0
scipy>=1.11.0
python-dotenv>=1.0.0
python-multipart>=0.0.6
```

### Running
```bash
# Development
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Docker
- Base image: `python:3.11-slim`
- Pre-download Snowflake model during build (caching)
- Expose port 8000
- Mount volume for uploads (optional)

## Security

### Input Validation
- File size limit: 50 MB
- File type: CSV only (for MVP)
- Column name sanitization
- Row count limits (50 min, 10,000 recommended max)

### Rate Limiting
- 5 uploads per minute per IP
- Implement with `slowapi`

### CORS
- Allow localhost:3000 for development
- Configure specific origins for production

## Monitoring

### Health Check
```python
GET /health
Returns: {
  'status': 'healthy',
  'datasets_in_memory': 3,
  'model_loaded': True
}
```

### Metrics
- Track processing times
- Count datasets processed
- Monitor memory usage
- Log Gemini API failures

---

**For frontend details, see FRONTEND.md**
**For API contracts, see API.md**