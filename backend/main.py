"""
Level Backend - FastAPI Application

Main application file with all API endpoints for dataset bias visualization.
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
import asyncio
import uuid
from datetime import datetime, timezone
from io import StringIO, BytesIO
import umap
from dotenv import load_dotenv

# Import services
from services import embedder, clusterer, sampler, analyzer, terrain_builder

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Level API",
    description="Dataset bias visualization and correction tool",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
datasets: Dict[str, Dict] = {}

# Configuration
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
MIN_ROWS = 50


# Pydantic models
class AdjustmentRequest(BaseModel):
    adjustments: Dict[int, float]


# Startup event - load embedding model
@app.on_event("startup")
async def startup_event():
    """Load Snowflake model at startup"""
    print("Starting Level API...")
    embedder.load_model()
    analyzer.configure_gemini()
    print("Ready to process datasets!")


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "datasets_in_memory": len(datasets),
        "model_loaded": embedder._model is not None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# POST /api/upload
@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    text_column: Optional[str] = Form(None)
):
    """
    Upload CSV file for analysis

    Args:
        file: CSV file (max 50MB)
        text_column: Optional column name containing text data

    Returns:
        Dataset ID and initial status
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=415, detail="Only CSV files supported")

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_SIZE // (1024*1024)}MB limit")

    # Parse CSV
    try:
        df = pd.read_csv(BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    # Validate row count
    if len(df) < MIN_ROWS:
        raise HTTPException(status_code=400, detail=f"Dataset too small (min {MIN_ROWS} rows)")

    # Determine text column
    if text_column and text_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{text_column}' not found in CSV")

    if not text_column:
        # Auto-detect: use first string column
        string_columns = df.select_dtypes(include=['object']).columns
        if len(string_columns) == 0:
            raise HTTPException(status_code=400, detail="No text columns found in CSV")
        text_column = string_columns[0]

    # Extract text data
    texts = df[text_column].astype(str).tolist()

    # Generate dataset ID
    dataset_id = str(uuid.uuid4())

    # Initialize dataset storage
    datasets[dataset_id] = {
        'status': 'processing',
        'progress': 0,
        'stage': 'parsing',
        'message': 'CSV parsed successfully',
        'data': df,
        'texts': texts,
        'text_column': text_column,
        'created_at': datetime.now(timezone.utc),
        'last_accessed': datetime.now(timezone.utc)
    }

    # Start async processing
    asyncio.create_task(process_dataset(dataset_id))

    return {
        'dataset_id': dataset_id,
        'status': 'processing',
        'row_count': len(df),
        'columns': df.columns.tolist()
    }


async def process_dataset(dataset_id: str):
    """
    Process dataset through the full pipeline

    Pipeline: Embed → Cluster → Sample → Analyze → UMAP → Build Terrain
    """
    try:
        dataset = datasets[dataset_id]
        texts = dataset['texts']

        # Stage 1: Embedding (10-40%)
        dataset['stage'] = 'embedding'
        dataset['progress'] = 10
        dataset['message'] = 'Generating embeddings'

        embeddings = embedder.embed_texts(texts, batch_size=32)
        dataset['embeddings'] = embeddings
        dataset['progress'] = 40

        # Stage 2: Clustering (40-60%)
        dataset['stage'] = 'clustering'
        dataset['progress'] = 40
        dataset['message'] = 'Finding clusters'

        # Estimate optimal eps
        eps = clusterer.estimate_optimal_eps(embeddings)

        # Perform clustering
        cluster_result = clusterer.cluster_embeddings(embeddings, eps=eps, min_samples=5)
        labels = cluster_result['labels']

        dataset['labels'] = labels
        dataset['num_clusters'] = cluster_result['num_clusters']
        dataset['progress'] = 60

        # Calculate cluster statistics
        cluster_stats = clusterer.calculate_cluster_stats(embeddings, labels)
        dataset['cluster_stats'] = cluster_stats

        # Stage 3: Sampling (60-70%)
        dataset['stage'] = 'sampling'
        dataset['progress'] = 60
        dataset['message'] = 'Sampling representative points'

        cluster_samples = sampler.sample_all_clusters(
            embeddings,
            labels,
            texts,
            cluster_stats,
            k=5
        )
        dataset['cluster_samples'] = cluster_samples
        dataset['progress'] = 70

        # Stage 4: Analysis (70-80%)
        dataset['stage'] = 'analyzing'
        dataset['progress'] = 70
        dataset['message'] = 'Generating cluster descriptions'

        cluster_analyses = await analyzer.analyze_all_clusters(cluster_samples)
        dataset['cluster_analyses'] = cluster_analyses
        dataset['progress'] = 80

        # Stage 5: UMAP dimension reduction (80-90%)
        dataset['stage'] = 'reducing_dimensions'
        dataset['progress'] = 80
        dataset['message'] = 'Reducing to 2D'

        reducer = umap.UMAP(n_components=2, random_state=42)
        positions_2d = reducer.fit_transform(embeddings)
        dataset['positions_2d'] = positions_2d
        dataset['progress'] = 90

        # Stage 6: Build terrain (90-100%)
        dataset['stage'] = 'building_terrain'
        dataset['progress'] = 90
        dataset['message'] = 'Building terrain'

        terrain = terrain_builder.build_terrain(
            positions_2d,
            labels,
            cluster_stats,
            cluster_analyses,
            cluster_samples,
            grid_size=100
        )
        dataset['terrain'] = terrain
        dataset['cluster_weights'] = {hill['id']: 1.0 for hill in terrain['hills']}

        # Complete
        dataset['status'] = 'completed'
        dataset['progress'] = 100
        dataset['stage'] = 'completed'
        dataset['message'] = 'Processing complete'

    except Exception as e:
        print(f"Error processing dataset {dataset_id}: {e}")
        dataset['status'] = 'failed'
        dataset['message'] = str(e)


# GET /api/status/{dataset_id}
@app.get("/api/status/{dataset_id}")
async def get_status(dataset_id: str):
    """
    Check processing status

    Returns:
        Status, progress, and current stage
    """
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = datasets[dataset_id]
    dataset['last_accessed'] = datetime.now(timezone.utc)

    return {
        'status': dataset['status'],
        'progress': dataset['progress'],
        'stage': dataset['stage'],
        'message': dataset.get('message', '')
    }


# GET /api/terrain/{dataset_id}
@app.get("/api/terrain/{dataset_id}")
async def get_terrain(dataset_id: str):
    """
    Get terrain data for visualization

    Returns:
        Complete terrain structure with hills, heightData, and metrics
    """
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = datasets[dataset_id]
    dataset['last_accessed'] = datetime.now(timezone.utc)

    if dataset['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Dataset not ready (still processing)")

    return dataset['terrain']


# POST /api/adjust/{dataset_id}
@app.post("/api/adjust/{dataset_id}")
async def adjust_weights(dataset_id: str, request: AdjustmentRequest):
    """
    Adjust cluster weights

    Args:
        adjustments: Dictionary mapping cluster_id to new weight

    Returns:
        Updated metrics
    """
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = datasets[dataset_id]
    dataset['last_accessed'] = datetime.now(timezone.utc)

    if dataset['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Dataset not ready")

    # Validate adjustments
    for cluster_id, weight in request.adjustments.items():
        if weight < 0 or weight > 2.0:
            raise HTTPException(status_code=400, detail=f"Invalid weight {weight} for cluster {cluster_id}")

    # Update weights
    terrain = dataset['terrain']
    for hill in terrain['hills']:
        if hill['id'] in request.adjustments:
            new_weight = request.adjustments[hill['id']]
            hill['weight'] = new_weight
            # Update height based on weight
            hill['height'] = hill['originalHeight'] * new_weight

    # Recalculate metrics
    updated_metrics = terrain_builder.recalculate_metrics(terrain['hills'])
    terrain['metrics'] = updated_metrics

    # Store updated weights
    dataset['cluster_weights'].update(request.adjustments)

    return {
        'success': True,
        'updated_metrics': updated_metrics,
        'message': 'Weights updated successfully'
    }


# GET /api/export/{dataset_id}
@app.get("/api/export/{dataset_id}")
async def export_dataset(dataset_id: str, format: str = 'weighted'):
    """
    Export balanced dataset

    Query params:
        format: 'weighted' (default) or 'resampled'

    Returns:
        CSV file download
    """
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = datasets[dataset_id]
    dataset['last_accessed'] = datetime.now(timezone.utc)

    if dataset['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Dataset not ready")

    # Get original data
    df = dataset['data'].copy()
    labels = dataset['labels']
    weights = dataset['cluster_weights']

    # Add cluster_id column
    df['cluster_id'] = labels

    if format == 'weighted':
        # Add weight column
        df['weight'] = df['cluster_id'].map(lambda cid: weights.get(cid, 1.0))

        # Convert to CSV
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_content = csv_buffer.getvalue()

    elif format == 'resampled':
        # Resample based on weights
        resampled_dfs = []

        for cluster_id, weight in weights.items():
            cluster_df = df[df['cluster_id'] == cluster_id].copy()

            if len(cluster_df) == 0:
                continue

            target_size = int(len(cluster_df) * weight)

            if target_size == 0:
                continue
            elif target_size <= len(cluster_df):
                # Undersample
                sampled = cluster_df.sample(n=target_size, random_state=42)
            else:
                # Oversample with replacement
                sampled = cluster_df.sample(n=target_size, replace=True, random_state=42)

            resampled_dfs.append(sampled)

        # Combine and shuffle
        if resampled_dfs:
            resampled_df = pd.concat(resampled_dfs, ignore_index=True)
            resampled_df = resampled_df.sample(frac=1, random_state=42).reset_index(drop=True)
        else:
            resampled_df = pd.DataFrame()

        # Convert to CSV
        csv_buffer = StringIO()
        resampled_df.to_csv(csv_buffer, index=False)
        csv_content = csv_buffer.getvalue()

    else:
        raise HTTPException(status_code=400, detail="Invalid format (use 'weighted' or 'resampled')")

    # Return as streaming response
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=balanced_dataset_{format}.csv"
        }
    )


# Main entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
