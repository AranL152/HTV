from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List
import pandas as pd
import io
import uuid

from config import Config
from services.embedder import generate_embeddings
from services.clusterer import cluster_data
from services.analyzer import analyze_clusters
from services.waveform import build_waveform
from utils.metrics import calculate_gini_coefficient

app = FastAPI(title="Level API", version="1.0.0")

# CORS configuration from environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
datasets: Dict[str, Dict] = {}

# Constants
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


class AmplitudeAdjustment(BaseModel):
    id: int = Field(..., ge=0)
    amplitude: float = Field(..., ge=0, le=2)


class AdjustmentRequest(BaseModel):
    adjustments: List[AmplitudeAdjustment]


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload CSV file and process through full pipeline.
    Returns dataset_id for subsequent requests.
    """
    # Validate file type
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    # Read CSV
    try:
        contents = await file.read()

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large (max 50MB)")

        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    if len(df) == 0 or len(df) < 5:
        raise HTTPException(status_code=400, detail="Dataset must contain at least 5 rows")

    # Generate unique dataset ID
    dataset_id = str(uuid.uuid4())
    print(f"Processing dataset {dataset_id} with {len(df)} rows")

    # Process pipeline
    try:
        print("Generating embeddings...")
        embeddings = generate_embeddings(df)

        print("Clustering data...")
        clusters = cluster_data(embeddings)

        print("Analyzing clusters...")
        descriptions = analyze_clusters(df, clusters)

        print("Building waveform...")
        waveform_data = build_waveform(embeddings, clusters, descriptions, df)

        # Store everything
        datasets[dataset_id] = {
            'df': df,
            'embeddings': embeddings,
            'clusters': clusters,
            'waveform': waveform_data
        }

        return {
            "dataset_id": dataset_id,
            "total_points": waveform_data["totalPoints"],
            "num_clusters": len(waveform_data["peaks"])
        }

    except Exception as e:
        import traceback
        print(f"Error occurred: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.get("/api/waveform/{dataset_id}")
async def get_waveform(dataset_id: str):
    """Get waveform data for a dataset."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return datasets[dataset_id]['waveform']


@app.post("/api/adjust/{dataset_id}")
async def adjust_weights(dataset_id: str, request: AdjustmentRequest):
    """Adjust peak amplitudes and recalculate metrics."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    waveform = datasets[dataset_id]['waveform']
    peak_ids = {peak['id'] for peak in waveform['peaks']}

    # Validate cluster IDs exist
    for adjustment in request.adjustments:
        if adjustment.id not in peak_ids:
            raise HTTPException(status_code=400, detail=f"Cluster {adjustment.id} not found")

    # Update amplitudes and weights
    for adjustment in request.adjustments:
        for peak in waveform['peaks']:
            if peak['id'] == adjustment.id:
                peak['amplitude'] = adjustment.amplitude
                peak['weight'] = adjustment.amplitude / peak['originalAmplitude']
                break

    # Recalculate metrics
    amplitudes = [peak['amplitude'] for peak in waveform['peaks']]
    gini = calculate_gini_coefficient(amplitudes)

    waveform['metrics'] = {
        "giniCoefficient": float(gini),
        "flatnessScore": float(1 - gini),
        "avgAmplitude": float(sum(amplitudes) / len(amplitudes))
    }

    return waveform


@app.get("/api/export/{dataset_id}")
async def export_dataset(dataset_id: str):
    """Export dataset with weight column."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = datasets[dataset_id]['df'].copy()
        clusters = datasets[dataset_id]['clusters']
        waveform = datasets[dataset_id]['waveform']

        # Create weight mapping and add weight column
        weight_map = {peak['id']: peak['weight'] for peak in waveform['peaks']}
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=Config.HOST, port=Config.PORT)
