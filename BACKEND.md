# BACKEND.md

Backend implementation guide for Level waveform visualizer.

## Stack

- FastAPI
- Python 3.11+
- Snowflake Arctic Embed (embeddings)
- DBSCAN (clustering)
- UMAP (1D projection)
- Gemini (cluster descriptions)
- In-memory storage (dict)

## Structure

```
backend/
├── main.py              # FastAPI app + endpoints
├── services/
│   ├── embedder.py      # Snowflake embeddings
│   ├── clusterer.py     # DBSCAN + UMAP 1D
│   ├── analyzer.py      # Gemini descriptions
│   └── waveform.py      # Build waveform data
└── requirements.txt
```

## Pipeline

```
Upload CSV → 
Embed → 
Cluster → 
Sample → 
Analyze (Gemini) → 
Project to 1D → 
Build waveform → 
Return data
```

## Endpoints

```python
POST   /api/upload         # Upload CSV, return dataset_id
GET    /api/waveform/{id}  # Get waveform data
POST   /api/adjust/{id}    # Update peak amplitudes
GET    /api/export/{id}    # Download balanced CSV
```

## Core Services

### embedder.py
```python
model = SentenceTransformer('Snowflake/snowflake-arctic-embed-l')

def generate_embeddings(df: pd.DataFrame) -> np.ndarray:
    texts = df.astype(str).apply(' '.join, axis=1).tolist()
    return model.encode(texts)
```

### clusterer.py
```python
def cluster_data(embeddings: np.ndarray) -> np.ndarray:
    clusterer = DBSCAN(eps=0.5, min_samples=5, metric='cosine')
    return clusterer.fit_predict(embeddings)

def project_to_1d(cluster_centers: np.ndarray) -> np.ndarray:
    umap = UMAP(n_components=1, random_state=42)
    positions = umap.fit_transform(cluster_centers)
    return (positions - positions.min()) / (positions.max() - positions.min())
```

### analyzer.py
```python
def analyze_clusters(df: pd.DataFrame, clusters: np.ndarray) -> Dict[int, str]:
    # Sample 5 rows per cluster
    # Send to Gemini with prompt: "Describe this cluster in 3-5 words"
    # Return {cluster_id: "Short Label"}
```

### waveform.py
```python
def build_waveform(embeddings, clusters, descriptions) -> dict:
    # Calculate cluster centers
    # Project to 1D for x positions
    # Build peaks with amplitude = cluster size
    # Calculate Gini coefficient
    # Return {peaks: [...], metrics: {...}}
```

## Data Storage

```python
# In-memory dict
datasets = {
    'dataset_id': {
        'df': original_dataframe,
        'embeddings': embeddings_array,
        'clusters': cluster_labels,
        'waveform': waveform_data
    }
}
```

## Key Calculations

**Gini Coefficient (inequality measure):**
```python
sorted_amps = sorted(amplitudes)
n = len(sorted_amps)
cumsum = sum((i + 1) * a for i, a in enumerate(sorted_amps))
gini = (2 * cumsum) / (n * sum(sorted_amps)) - (n + 1) / n
```

**Weight from amplitude:**
```python
weight = new_amplitude / original_amplitude
```

## Environment

```bash
# .env
GEMINI_API_KEY=your_key
```

## Requirements

```
fastapi
uvicorn
sentence-transformers
torch
google-generativeai
scikit-learn
umap-learn
pandas
numpy
python-multipart
python-dotenv
```

## Run

```bash
pip install -r requirements.txt
python main.py  # or uvicorn main:app --reload
```

## Keep It Simple

- Process synchronously (fast enough)
- In-memory storage (no DB)
- Single file for endpoints
- Simple error handling
- Ship it