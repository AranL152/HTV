"""AI-powered dataset balancing service."""

import json
import re
from typing import Dict
import pandas as pd

from .client import get_gemini_model
from .prompts import build_balance_suggestion_prompt, build_detection_prompt


async def suggest_balance(df: pd.DataFrame, base_waveform: dict, user_waveform: dict, user_request: str = None, ai_waveform: dict = None) -> dict:
    """Generate AI balance suggestions for dataset.

    Args:
        df: Original DataFrame
        base_waveform: Original dataset (immutable)
        user_waveform: User's current adjustments
        user_request: Optional user request to inform suggestions (e.g., "reduce Big Tech")
        ai_waveform: Previous AI suggestions (for context)

    Returns:
        Dictionary with suggestions list and overall strategy
    """
    # Build context about the dataset
    context_parts = [
        f"Dataset Overview:",
        f"- Total data points: {len(df)}",
        f"- Number of clusters: {len(base_waveform['peaks'])}",
        f"- Columns: {', '.join(df.columns.tolist())}",
        f"\n\nCluster Information (CURRENT STATE):"
    ]

    # Add cluster details
    for i, base_peak in enumerate(base_waveform['peaks']):
        user_peak = user_waveform['peaks'][i]

        # Calculate selection ratio
        selection_ratio = user_peak['count'] / base_peak['sampleCount'] if base_peak['sampleCount'] > 0 else 1.0

        # Get previous AI suggestion if available
        ai_info = ""
        if ai_waveform:
            ai_peak = next((p for p in ai_waveform['peaks'] if p['id'] == base_peak['id']), None)
            if ai_peak:
                ai_info = f"\n  - Previous AI suggestion: {ai_peak['count']} samples, weight {ai_peak['weight']:.2f}x"

        context_parts.append(
            f"\nCluster {base_peak['id']} - {base_peak['label']}:"
            f"\n  - Original dataset size: {base_peak['sampleCount']} samples"
            f"{ai_info}"
            f"\n  - User's current selection: {user_peak['count']} samples ({selection_ratio:.1%}), weight {user_peak['weight']:.2f}x"
            f"\n  - Sample examples: {', '.join(base_peak['samples'][:3])}"
        )

    context = "\n".join(context_parts)

    # Build prompt with optional user request
    prompt = build_balance_suggestion_prompt(context, user_request)

    # Call Gemini API with JSON mode enabled
    model = get_gemini_model(json_mode=True)
    response = model.generate_content(prompt)

    # Log response details
    print(f"\n{'='*60}")
    print(f"🔍 SUGGEST_BALANCE: Gemini Response")
    print(f"{'='*60}")
    print(f"Response type: {type(response.text)}")
    print(f"Response length: {len(response.text)} chars")
    print(f"First 200 chars: {response.text[:200]}")
    print(f"Attempting JSON parse...")

    # Parse JSON directly (no regex needed with JSON mode)
    suggestions_data = json.loads(response.text)

    print(f"✅ JSON parsed successfully")
    print(f"Keys: {suggestions_data.keys()}")
    print(f"Suggestions count: {len(suggestions_data.get('suggestions', []))}")
    print(f"Strategy: {suggestions_data.get('overall_strategy', 'MISSING')[:100]}...")
    print(f"{'='*60}\n")

    return suggestions_data


async def detect_balance_request(user_message: str) -> bool:
    """Detect if user is requesting balance adjustments.

    Args:
        user_message: User's chat message

    Returns:
        True if requesting balance changes, False otherwise
    """
    prompt = build_detection_prompt(user_message)

    model = get_gemini_model()
    response = model.generate_content(prompt)

    return "YES" in response.text.strip().upper()
