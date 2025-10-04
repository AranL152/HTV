from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, List
import pandas as pd
import io
import uuid

from services.embedder import generate_embeddings
from services.clusterer import cluster_data
from services.analyzer import analyze_clusters
from services.waveform import build_waveform

app = FastAPI(title="Level API", version="1.0.0")

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
datasets = {}


class AdjustmentRequest(BaseModel):
    adjustments: List[Dict[str, float]]  # [{"id": cluster_id, "amplitude": new_amplitude}, ...]


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload CSV file and process through full pipeline.
    Returns dataset_id for subsequent requests.
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    # Read CSV
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    # Generate unique dataset ID
    dataset_id = str(uuid.uuid4())

    # Process pipeline
    try:
        # 1. Generate embeddings
        embeddings = generate_embeddings(df)

        # 2. Cluster data
        clusters = cluster_data(embeddings)

        # 3. Analyze clusters with Gemini
        descriptions = analyze_clusters(df, clusters)

        # 4. Build waveform
        waveform_data = build_waveform(embeddings, clusters, descriptions)

        # Store everything
        datasets[dataset_id] = {
            'df': df,
            'embeddings': embeddings,
            'clusters': clusters,
            'waveform': waveform_data
        }

        return {
            "dataset_id": dataset_id,
            "total_points": waveform_data["total_points"],
            "num_clusters": len(waveform_data["peaks"])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.get("/api/waveform/{dataset_id}")
async def get_waveform(dataset_id: str):
    """
    Get waveform data for a dataset.
    """
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return datasets[dataset_id]['waveform']


@app.post("/api/adjust/{dataset_id}")
async def adjust_weights(dataset_id: str, request: AdjustmentRequest):
    """
    Adjust peak amplitudes and recalculate metrics.
    """
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    waveform = datasets[dataset_id]['waveform']

    # Update amplitudes and weights
    for adjustment in request.adjustments:
        cluster_id = adjustment['id']
        new_amplitude = adjustment['amplitude']

        # Find peak and update
        for peak in waveform['peaks']:
            if peak['id'] == cluster_id:
                peak['amplitude'] = new_amplitude
                peak['weight'] = new_amplitude / peak['original_amplitude']
                break

    # Recalculate metrics
    amplitudes = [peak['amplitude'] for peak in waveform['peaks']]
    gini = _calculate_gini_coefficient(amplitudes)

    waveform['metrics'] = {
        "gini_coefficient": float(gini),
        "flatness_score": float(1 - gini),
        "avg_amplitude": float(sum(amplitudes) / len(amplitudes))
    }

    return waveform


@app.get("/api/export/{dataset_id}")
async def export_dataset(dataset_id: str):
    """
    Export dataset with weight column.
    """
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = datasets[dataset_id]['df'].copy()
    clusters = datasets[dataset_id]['clusters']
    waveform = datasets[dataset_id]['waveform']

    # Create weight mapping
    weight_map = {peak['id']: peak['weight'] for peak in waveform['peaks']}

    # Add weight column
    df['weight'] = [weight_map.get(cluster_id, 1.0) for cluster_id in clusters]

    # Convert to CSV
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=balanced_{dataset_id}.csv"}
    )


def _calculate_gini_coefficient(amplitudes: List[float]) -> float:
    """Calculate Gini coefficient for amplitude distribution."""
    if not amplitudes:
        return 0.0

    sorted_amps = sorted(amplitudes)
    n = len(sorted_amps)
    cumsum = sum((i + 1) * a for i, a in enumerate(sorted_amps))
    total = sum(sorted_amps)

    if total == 0:
        return 0.0

    return (2 * cumsum) / (n * total) - (n + 1) / n


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
