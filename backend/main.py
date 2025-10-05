from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List
import pandas as pd
import io
import uuid
import random

from config import Config
from services.embedder import generate_embeddings
from services.clusterer import cluster_data
from services.analyzer import analyze_clusters
from services.waveform import build_waveform
from utils.metrics import calculate_gini_coefficient
from llm import suggest_balance, detect_balance_request, generate_chat_response

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


class CountAdjustment(BaseModel):
    id: int = Field(..., ge=0)
    selectedCount: int | None = Field(None, ge=0)
    weight: float | None = Field(None, ge=0.01, le=2.0)


class AdjustmentRequest(BaseModel):
    adjustments: List[CountAdjustment]


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    response: str
    suggestions: dict | None = None  # Optional waveform suggestions


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

        # Generate AI suggestions automatically
        print("Generating AI balance suggestions...")
        suggestions = await suggest_balance(df, waveform_data)

        # Apply suggestions to waveform
        for peak in waveform_data['peaks']:
            suggestion = next(
                (s for s in suggestions['suggestions'] if s['id'] == peak['id']),
                None
            )
            if suggestion:
                peak['suggestedCount'] = suggestion['suggestedCount']
                peak['suggestedWeight'] = suggestion.get('suggestedWeight', 1.0)
                peak['reasoning'] = suggestion.get('reasoning', '')

        waveform_data['strategy'] = suggestions.get('overall_strategy', '')

        # Create initial chat message
        initial_message = {
            'role': 'assistant',
            'content': f"I've analyzed your dataset and found {len(waveform_data['peaks'])} clusters. {suggestions.get('overall_strategy', '')}",
            'timestamp': pd.Timestamp.now().isoformat()
        }

        # Store everything
        datasets[dataset_id] = {
            'df': df,
            'embeddings': embeddings,
            'clusters': clusters,
            'waveform': waveform_data,
            'chat_history': [initial_message]
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
async def adjust_counts(dataset_id: str, request: AdjustmentRequest):
    """Adjust peak selected counts and recalculate metrics."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    waveform = datasets[dataset_id]['waveform']
    peak_ids = {peak['id'] for peak in waveform['peaks']}

    # Validate cluster IDs exist and values are within valid range
    for adjustment in request.adjustments:
        if adjustment.id not in peak_ids:
            raise HTTPException(status_code=400, detail=f"Cluster {adjustment.id} not found")

        # Find the peak to validate adjustment
        peak = next((p for p in waveform['peaks'] if p['id'] == adjustment.id), None)
        if peak:
            if adjustment.selectedCount is not None and adjustment.selectedCount > peak['sampleCount']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Selected count ({adjustment.selectedCount}) cannot exceed sample count ({peak['sampleCount']})"
                )
            # Weight validation is handled by Pydantic (0.1-5.0)

    # Update selected counts and/or weights
    for adjustment in request.adjustments:
        for peak in waveform['peaks']:
            if peak['id'] == adjustment.id:
                if adjustment.selectedCount is not None:
                    peak['selectedCount'] = adjustment.selectedCount
                if adjustment.weight is not None:
                    peak['weight'] = adjustment.weight
                break

    # Recalculate metrics based on selection ratios
    selection_ratios = [
        peak['selectedCount'] / peak['sampleCount'] if peak['sampleCount'] > 0 else 1.0
        for peak in waveform['peaks']
    ]
    gini = calculate_gini_coefficient(selection_ratios)

    waveform['metrics'] = {
        "giniCoefficient": float(gini),
        "flatnessScore": float(1 - gini),
        "avgAmplitude": float(sum(selection_ratios) / len(selection_ratios))
    }

    return waveform


@app.get("/api/export/{dataset_id}")
async def export_dataset(dataset_id: str):
    """Export pruned dataset based on selectedCount and weights per cluster."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = datasets[dataset_id]['df'].copy()
        clusters = datasets[dataset_id]['clusters']
        waveform = datasets[dataset_id]['waveform']

        # Create selectedCount and weight mapping
        selected_map = {peak['id']: peak['selectedCount'] for peak in waveform['peaks']}
        weight_map = {peak['id']: peak.get('weight', 1.0) for peak in waveform['peaks']}

        # Check if any non-default weights are set (not all 1.0)
        has_weights = any(w != 1.0 for w in weight_map.values())

        # Prune dataset: keep only selectedCount rows per cluster
        selected_indices = []
        random.seed(42)  # For reproducibility

        for cluster_id in set(clusters):
            # Get all indices for this cluster
            cluster_mask = clusters == cluster_id
            cluster_indices = df[cluster_mask].index.tolist()

            # Get selected count for this cluster
            selected_count = selected_map.get(cluster_id, len(cluster_indices))
            selected_count = min(selected_count, len(cluster_indices))

            # Apply weighted sampling if weights are set
            if has_weights and selected_count > 0:
                weight = weight_map.get(cluster_id, 1.0)
                # Convert weight to sampling probability (higher weight = more samples)
                # Scale selected_count by weight, but respect the original selectedCount as max
                weighted_count = int(selected_count * weight)
                # Clamp to available cluster size
                weighted_count = min(weighted_count, len(cluster_indices))
                # Use at least 1 sample if weight > 0 and original count > 0
                if weight > 0 and selected_count > 0:
                    weighted_count = max(1, weighted_count)

                if weighted_count > 0:
                    sampled_indices = random.sample(cluster_indices, weighted_count)
                    selected_indices.extend(sampled_indices)
            else:
                # Standard sampling based on selectedCount only
                if selected_count > 0:
                    sampled_indices = random.sample(cluster_indices, selected_count)
                    selected_indices.extend(sampled_indices)

        # Create pruned dataframe with selected rows
        if not selected_indices:
            raise HTTPException(status_code=400, detail="No data selected for export")

        pruned_df = df.loc[selected_indices].copy()

        # Convert to CSV
        output = io.StringIO()
        pruned_df.to_csv(output, index=False)
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

        # Store user message
        user_message = {
            'role': 'user',
            'content': request.message,
            'timestamp': pd.Timestamp.now().isoformat()
        }
        datasets[dataset_id]['chat_history'].append(user_message)

        # Generate chat response
        response_text = await generate_chat_response(df, waveform, request.message)

        # Check if user is asking for balance adjustments
        should_generate_suggestions = await detect_balance_request(request.message)

        # If user wants balance adjustments, generate new suggestions
        new_suggestions = None
        if should_generate_suggestions:
            try:
                # Get current suggestions (context-aware based on user request)
                suggestions_data = await suggest_balance(df, waveform)

                # Build waveform with new suggestions
                suggested_waveform = {
                    'peaks': [],
                    'totalPoints': waveform['totalPoints'],
                    'metrics': {},
                    'strategy': suggestions_data.get('overall_strategy', '')
                }

                for peak in waveform['peaks']:
                    suggested_peak = peak.copy()
                    suggestion = next(
                        (s for s in suggestions_data['suggestions'] if s['id'] == peak['id']),
                        None
                    )
                    if suggestion:
                        suggested_peak['suggestedCount'] = min(suggestion['suggestedCount'], peak['sampleCount'])
                        suggested_peak['suggestedWeight'] = suggestion.get('suggestedWeight', 1.0)
                        suggested_peak['reasoning'] = suggestion.get('reasoning', '')
                    suggested_waveform['peaks'].append(suggested_peak)

                # Calculate metrics
                suggestion_ratios = [
                    peak['suggestedCount'] / peak['sampleCount'] if peak['sampleCount'] > 0 else 1.0
                    for peak in suggested_waveform['peaks']
                ]
                gini = calculate_gini_coefficient(suggestion_ratios)

                suggested_waveform['metrics'] = {
                    "giniCoefficient": float(gini),
                    "flatnessScore": float(1 - gini),
                    "avgAmplitude": float(sum(suggestion_ratios) / len(suggestion_ratios))
                }

                new_suggestions = suggested_waveform
            except Exception as e:
                print(f"Failed to generate suggestions: {str(e)}")
                # Continue without suggestions if generation fails

        # Store assistant message
        assistant_message = {
            'role': 'assistant',
            'content': response_text,
            'timestamp': pd.Timestamp.now().isoformat()
        }
        datasets[dataset_id]['chat_history'].append(assistant_message)

        return ChatResponse(
            response=response_text,
            suggestions=new_suggestions
        )

    except Exception as e:
        import traceback
        print(f"Chat error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.post("/api/suggest-balance/{dataset_id}")
async def suggest_balance_endpoint(dataset_id: str):
    """Use Gemini to suggest optimal cluster balance for the dataset."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        dataset_info = datasets[dataset_id]
        df = dataset_info['df']
        waveform = dataset_info['waveform']

        # Get suggestions
        suggestions_data = await suggest_balance(df, waveform)

        # Apply suggestions to create suggested waveform
        suggested_waveform = {
            'peaks': [],
            'totalPoints': waveform['totalPoints'],
            'metrics': {},
            'strategy': suggestions_data.get('overall_strategy', 'AI-suggested balance')
        }

        # Create suggested peaks
        for peak in waveform['peaks']:
            suggested_peak = peak.copy()

            # Find suggestion for this cluster
            suggestion = next(
                (s for s in suggestions_data['suggestions'] if s['id'] == peak['id']),
                None
            )

            if suggestion:
                suggested_count = min(suggestion['suggestedCount'], peak['sampleCount'])
                suggested_count = max(0, suggested_count)
                suggested_peak['suggestedCount'] = suggested_count
                suggested_peak['suggestedWeight'] = suggestion.get('suggestedWeight', 1.0)
                suggested_peak['reasoning'] = suggestion.get('reasoning', '')
            else:
                suggested_peak['suggestedCount'] = peak['selectedCount']
                suggested_peak['suggestedWeight'] = peak.get('weight', 1.0)
                suggested_peak['reasoning'] = 'No change suggested'

            suggested_waveform['peaks'].append(suggested_peak)

        # Calculate metrics for suggested distribution
        suggestion_ratios = [
            peak['suggestedCount'] / peak['sampleCount'] if peak['sampleCount'] > 0 else 1.0
            for peak in suggested_waveform['peaks']
        ]
        gini = calculate_gini_coefficient(suggestion_ratios)

        suggested_waveform['metrics'] = {
            "giniCoefficient": float(gini),
            "flatnessScore": float(1 - gini),
            "avgAmplitude": float(sum(suggestion_ratios) / len(suggestion_ratios))
        }

        return suggested_waveform

    except Exception as e:
        import traceback
        print(f"Suggest balance error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Suggestion failed: {str(e)}")


@app.get("/api/chat-history/{dataset_id}")
async def get_chat_history(dataset_id: str):
    """Get chat history for a dataset."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return {"messages": datasets[dataset_id].get('chat_history', [])}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=Config.HOST, port=Config.PORT)
