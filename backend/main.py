from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List
import pandas as pd
import io
import uuid
import google.generativeai as genai

from config import Config
from services.embedder import generate_embeddings
from services.clusterer import cluster_data
from services.analyzer import analyze_clusters
from services.waveform import build_waveform
from utils.metrics import calculate_gini_coefficient

# Configure Gemini
genai.configure(api_key=Config.GEMINI_API_KEY)

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


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


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


@app.post("/api/chat/{dataset_id}")
async def chat_about_dataset(dataset_id: str, request: ChatRequest):
    """Chat with Gemini about the dataset and clusters."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        dataset_info = datasets[dataset_id]
        df = dataset_info['df']
        waveform = dataset_info['waveform']
        
        # Build context about the dataset
        context_parts = [
            f"Dataset Overview:",
            f"- Total data points: {len(df)}",
            f"- Number of clusters: {len(waveform['peaks'])}",
            f"- Columns: {', '.join(df.columns.tolist())}",
            f"\nDataset sample (first 5 rows):",
            df.head().to_string(),
            f"\n\nCluster Information:"
        ]
        
        # Add cluster details
        for peak in waveform['peaks']:
            context_parts.append(
                f"\nCluster {peak['id']}:"
                f"\n  - Label: {peak['label']}"
                f"\n  - Sample count: {peak['sampleCount']}"
                f"\n  - Current weight: {peak['weight']:.2f}"
                f"\n  - Position: {peak['x']:.2%} along data distribution"
                f"\n  - Sample examples: {', '.join(peak['samples'][:3])}"
            )
        
        # Add metrics
        metrics = waveform['metrics']
        context_parts.append(
            f"\n\nCurrent Metrics:"
            f"\n  - Gini Coefficient: {metrics['giniCoefficient']:.3f}"
            f"\n  - Flatness Score: {metrics['flatnessScore']:.3f}"
            f"\n  - Average Amplitude: {metrics['avgAmplitude']:.3f}"
        )
        
        context = "\n".join(context_parts)
        
        # Create prompt for Gemini
        prompt = f"""You are an AI assistant helping users understand their dataset clustering analysis.

Context about the current dataset:
{context}

User Question: {request.message}

Please provide a helpful, concise answer based on the dataset information provided. If the question is about a specific cluster, reference the cluster details above. If asking for recommendations, consider the current metrics and cluster distribution."""

        # Call Gemini API
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        response = model.generate_content(prompt)
        
        return {
            "response": response.text
        }
        
    except Exception as e:
        import traceback
        print(f"Chat error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=Config.HOST, port=Config.PORT)
