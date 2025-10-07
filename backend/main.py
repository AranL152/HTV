from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List
import pandas as pd
import io
import uuid
import random
import asyncio

from config import Config
from services.embedder import generate_embeddings
from services.clusterer import cluster_data, extract_clusters_from_csv
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
    count: int | None = Field(None, ge=0)
    weight: float | None = Field(None, ge=0.01, le=2.0)


class AdjustmentRequest(BaseModel):
    adjustments: List[CountAdjustment]


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    response: str
    suggestions: dict | None = None  # Optional waveform suggestions


def create_user_waveform_from_base(base_waveform: dict) -> dict:
    """Create initial user waveform as copy of base."""
    return {
        'peaks': [
            {
                'id': p['id'],
                'x': p['x'],
                'count': p['sampleCount'],
                'weight': 1.0,
                'label': p['label'],
                'color': p['color']
            }
            for p in base_waveform['peaks']
        ],
        'totalPoints': base_waveform['totalPoints']
    }


def create_ai_waveform_from_suggestions(base_waveform: dict, suggestions: dict) -> dict:
    """Create AI waveform from balance suggestions."""
    ai_waveform = {
        'peaks': [],
        'totalPoints': base_waveform['totalPoints'],
        'strategy': suggestions.get('overall_strategy', '')
    }

    for peak in base_waveform['peaks']:
        suggestion = next(
            (s for s in suggestions['suggestions'] if s['id'] == peak['id']),
            None
        )
        ai_peak = {
            'id': peak['id'],
            'x': peak['x'],
            'count': suggestion['suggestedCount'] if suggestion else peak['sampleCount'],
            'weight': suggestion.get('suggestedWeight', 1.0) if suggestion else 1.0,
            'label': peak['label'],
            'color': peak['color'],
            'reasoning': suggestion.get('reasoning', '') if suggestion else ''
        }
        ai_waveform['peaks'].append(ai_peak)

    return ai_waveform


async def _process_dataframe(df: pd.DataFrame) -> dict:
    """
    Shared processing pipeline for uploaded or sample datasets.
    Returns dataset metadata.
    """
    # Generate unique dataset ID
    dataset_id = str(uuid.uuid4())
    print(f"Processing dataset {dataset_id} with {len(df)} rows")

    # Process pipeline
    print("Generating embeddings...")
    embeddings = generate_embeddings(df)

    # Check if CSV has predefined clusters
    cluster_result = extract_clusters_from_csv(df)
    cluster_labels_map = None

    if cluster_result:
        print("Using predefined clusters from CSV...")
        clusters, cluster_labels_map = cluster_result
    else:
        print("Clustering data with K-Means...")
        clusters = cluster_data(embeddings)

    print("Analyzing clusters...")
    descriptions = analyze_clusters(df, clusters, cluster_labels_map)

    print("Building waveform...")
    waveform_data = build_waveform(embeddings, clusters, descriptions, df)

    # Generate AI suggestions automatically
    print("Generating AI balance suggestions...")
    # Initial call with no user modifications yet
    initial_user_waveform = create_user_waveform_from_base(waveform_data)
    suggestions = await suggest_balance(df, waveform_data, initial_user_waveform, None, None)

    # Create AI waveform from suggestions
    ai_waveform = create_ai_waveform_from_suggestions(waveform_data, suggestions)

    # Log AI suggestion details
    print(f"\n{'='*60}")
    print(f"🔍 UPLOAD: AI Suggestions Generated")
    print(f"{'='*60}")
    print(f"Suggestions structure: {suggestions.keys()}")
    print(f"Number of suggestions: {len(suggestions.get('suggestions', []))}")
    print(f"Overall strategy: {suggestions.get('overall_strategy', 'MISSING')[:100]}...")
    print(f"\n📊 AI Waveform Created:")
    print(f"Total points: {ai_waveform.get('totalPoints')}")
    print(f"Number of peaks: {len(ai_waveform.get('peaks', []))}")
    print(f"Strategy in AI waveform: {ai_waveform.get('strategy', 'MISSING')[:100]}...")
    for i, peak in enumerate(ai_waveform.get('peaks', [])[:3]):
        print(f"  Peak {i}: id={peak['id']}, count={peak['count']}, weight={peak['weight']}, reasoning={peak.get('reasoning', 'MISSING')[:50]}...")
    print(f"{'='*60}\n")

    # Create initial chat message
    initial_message = {
        'role': 'assistant',
        'content': f"I've analyzed your dataset and found {len(waveform_data['peaks'])} clusters. {suggestions.get('overall_strategy', '')}",
        'timestamp': pd.Timestamp.now().isoformat()
    }

    # Store three separate waveforms
    datasets[dataset_id] = {
        'df': df,
        'embeddings': embeddings,
        'clusters': clusters,
        'base_waveform': waveform_data,  # Original dataset (immutable)
        'user_waveform': create_user_waveform_from_base(waveform_data),  # User's manual adjustments (starts as copy of base)
        'ai_waveform': ai_waveform,  # AI suggestions (updated by chat)
        'chat_history': [initial_message]
    }

    return {
        "dataset_id": dataset_id,
        "total_points": waveform_data["totalPoints"],
        "num_clusters": len(waveform_data["peaks"])
    }


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

    # Process pipeline
    try:
        return await _process_dataframe(df)
    except Exception as e:
        import traceback
        print(f"Error occurred: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.post("/api/upload-sample")
async def upload_sample_dataset():
    """
    Load and process the sample dataset from a predefined path.
    Returns dataset_id for subsequent requests.
    """
    sample_path = "/Users/evanhe/Downloads/ml_dataset.csv"

    try:
        df = pd.read_csv(sample_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load sample dataset: {str(e)}")

    if len(df) == 0 or len(df) < 5:
        raise HTTPException(status_code=400, detail="Sample dataset must contain at least 5 rows")

    # Process pipeline
    try:
        return await _process_dataframe(df)
    except Exception as e:
        import traceback
        print(f"Error occurred: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


def get_all_waveforms(dataset_id: str) -> dict:
    """
    Get all three waveforms for a dataset.

    Returns:
        {
            'base': base_waveform (original dataset, immutable),
            'user': user_waveform (user's manual adjustments),
            'ai': ai_waveform (AI suggestions),
            'metrics': calculated metrics,
            'strategy': AI strategy description
        }
    """
    base_waveform = datasets[dataset_id]['base_waveform']
    user_waveform = datasets[dataset_id]['user_waveform']
    ai_waveform = datasets[dataset_id]['ai_waveform']

    # Calculate metrics based on user's current selection ratios
    selection_ratios = [
        peak['count'] / base_peak['sampleCount'] if base_peak['sampleCount'] > 0 else 1.0
        for peak, base_peak in zip(user_waveform['peaks'], base_waveform['peaks'])
    ]
    gini = calculate_gini_coefficient(selection_ratios)

    metrics = {
        "giniCoefficient": float(gini),
        "flatnessScore": float(1 - gini),
        "avgAmplitude": float(sum(selection_ratios) / len(selection_ratios))
    }

    # Log waveform data being returned
    print(f"\n{'='*60}")
    print(f"🔍 GET_WAVEFORMS: Returning data for dataset {dataset_id}")
    print(f"{'='*60}")
    print(f"Base peaks: {len(base_waveform['peaks'])}")
    print(f"User peaks: {len(user_waveform['peaks'])}")
    print(f"AI peaks: {len(ai_waveform['peaks'])}")
    print(f"Strategy: {ai_waveform.get('strategy', 'MISSING')[:100]}...")
    print(f"\n📊 AI Peak Sample (first peak):")
    if ai_waveform['peaks']:
        peak = ai_waveform['peaks'][0]
        print(f"  ID: {peak['id']}, Count: {peak['count']}, Weight: {peak['weight']}")
        print(f"  Label: {peak['label']}, Color: {peak['color']}")
        print(f"  Reasoning: {peak.get('reasoning', 'MISSING')[:80]}...")
    print(f"{'='*60}\n")

    return {
        'base': base_waveform,
        'user': user_waveform,
        'ai': ai_waveform,
        'metrics': metrics,
        'strategy': ai_waveform.get('strategy', '')
    }


@app.get("/api/waveform/{dataset_id}")
async def get_waveform(dataset_id: str):
    """Get all waveforms for a dataset."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return get_all_waveforms(dataset_id)


@app.post("/api/adjust/{dataset_id}")
async def adjust_counts(dataset_id: str, request: AdjustmentRequest):
    """Adjust user waveform counts and/or weights."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    base_waveform = datasets[dataset_id]['base_waveform']
    user_waveform = datasets[dataset_id]['user_waveform']
    peak_ids = {peak['id'] for peak in user_waveform['peaks']}

    # Validate cluster IDs exist and values are within valid range
    for adjustment in request.adjustments:
        if adjustment.id not in peak_ids:
            raise HTTPException(status_code=400, detail=f"Cluster {adjustment.id} not found")

        # Find the base peak to validate adjustment
        base_peak = next((p for p in base_waveform['peaks'] if p['id'] == adjustment.id), None)
        if base_peak:
            if adjustment.count is not None and adjustment.count > base_peak['sampleCount']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Count ({adjustment.count}) cannot exceed sample count ({base_peak['sampleCount']})"
                )
            # Weight validation is handled by Pydantic (0.01-2.0)

    # Update user waveform
    for adjustment in request.adjustments:
        for peak in user_waveform['peaks']:
            if peak['id'] == adjustment.id:
                if adjustment.count is not None:
                    peak['count'] = adjustment.count
                if adjustment.weight is not None:
                    peak['weight'] = adjustment.weight
                break

    # Return all waveforms
    print(f"\n🔍 ADJUST: Returning updated waveforms with AI suggestions")
    result = get_all_waveforms(dataset_id)
    print(f"AI peaks in response: {len(result['ai']['peaks'])}")
    return result


@app.get("/api/export/{dataset_id}")
async def export_dataset(dataset_id: str):
    """Export pruned dataset based on user waveform counts and weights."""
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = datasets[dataset_id]['df'].copy()
        clusters = datasets[dataset_id]['clusters']
        user_waveform = datasets[dataset_id]['user_waveform']

        # Create count and weight mapping from user waveform
        count_map = {peak['id']: peak['count'] for peak in user_waveform['peaks']}
        weight_map = {peak['id']: peak['weight'] for peak in user_waveform['peaks']}

        # Check if any non-default weights are set (not all 1.0)
        has_weights = any(w != 1.0 for w in weight_map.values())

        # Prune dataset: keep only count rows per cluster
        selected_indices = []
        random.seed(42)  # For reproducibility

        for cluster_id in set(clusters):
            # Get all indices for this cluster
            cluster_mask = clusters == cluster_id
            cluster_indices = df[cluster_mask].index.tolist()

            # Get count for this cluster
            count = count_map.get(cluster_id, len(cluster_indices))
            count = min(count, len(cluster_indices))

            # Apply weighted sampling if weights are set
            if has_weights and count > 0:
                weight = weight_map.get(cluster_id, 1.0)
                # Convert weight to sampling probability (higher weight = more samples)
                weighted_count = int(count * weight)
                # Clamp to available cluster size
                weighted_count = min(weighted_count, len(cluster_indices))
                # Use at least 1 sample if weight > 0 and original count > 0
                if weight > 0 and count > 0:
                    weighted_count = max(1, weighted_count)

                if weighted_count > 0:
                    sampled_indices = random.sample(cluster_indices, weighted_count)
                    selected_indices.extend(sampled_indices)
            else:
                # Standard sampling based on count only
                if count > 0:
                    sampled_indices = random.sample(cluster_indices, count)
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
        base_waveform = dataset_info['base_waveform']
        user_waveform = dataset_info['user_waveform']

        # Store user message
        user_message = {
            'role': 'user',
            'content': request.message,
            'timestamp': pd.Timestamp.now().isoformat()
        }
        datasets[dataset_id]['chat_history'].append(user_message)

        # Add 1 second delay for more natural feel
        await asyncio.sleep(1.0)

        # Generate chat response using AI
        response_text = await generate_chat_response(df, base_waveform, user_waveform, request.message)

        # Check if user is asking for balance adjustments
        should_generate_suggestions = await detect_balance_request(request.message)
        print(f"🔍 Balance request detection: '{request.message}' -> {should_generate_suggestions}")

        # If user wants balance adjustments, generate new suggestions
        if should_generate_suggestions:
            print("✅ Generating new balance suggestions...")
            try:
                # Use AI to generate suggestions based on user request
                ai_waveform = dataset_info['ai_waveform']
                suggestions_data = await suggest_balance(df, base_waveform, user_waveform, request.message, ai_waveform)

                # Create AI waveform from suggestions and update stored version
                new_ai_waveform = create_ai_waveform_from_suggestions(base_waveform, suggestions_data)
                datasets[dataset_id]['ai_waveform'] = new_ai_waveform
                print(f"✅ Generated and stored {len(new_ai_waveform['peaks'])} AI suggestions")

                # Log new AI suggestion details
                print(f"\n{'='*60}")
                print(f"🔍 CHAT: New AI suggestions generated")
                print(f"{'='*60}")
                print(f"New AI waveform peaks: {len(new_ai_waveform['peaks'])}")
                print(f"New strategy: {new_ai_waveform.get('strategy', 'MISSING')[:100]}...")
                for i, peak in enumerate(new_ai_waveform['peaks'][:2]):
                    print(f"  Peak {i}: count={peak['count']}, weight={peak['weight']}")
                print(f"Stored in datasets[{dataset_id}]['ai_waveform']")
                print(f"{'='*60}\n")
            except Exception as e:
                print(f"❌ Failed to generate suggestions: {str(e)}")
                # Continue without updating suggestions if generation fails

        # Store assistant message
        assistant_message = {
            'role': 'assistant',
            'content': response_text,
            'timestamp': pd.Timestamp.now().isoformat()
        }
        datasets[dataset_id]['chat_history'].append(assistant_message)

        # Return all waveforms if suggestions were generated
        all_waveforms = get_all_waveforms(dataset_id) if should_generate_suggestions else None

        print(f"📤 Returning chat response with suggestions: {all_waveforms is not None}")
        return ChatResponse(
            response=response_text,
            suggestions=all_waveforms
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
        base_waveform = dataset_info['base_waveform']
        user_waveform = dataset_info['user_waveform']
        ai_waveform = dataset_info['ai_waveform']

        # Get suggestions
        suggestions_data = await suggest_balance(df, base_waveform, user_waveform, None, ai_waveform)

        # Create and store updated AI waveform
        new_ai_waveform = create_ai_waveform_from_suggestions(base_waveform, suggestions_data)
        datasets[dataset_id]['ai_waveform'] = new_ai_waveform

        return get_all_waveforms(dataset_id)

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
