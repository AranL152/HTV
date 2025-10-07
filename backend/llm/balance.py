"""AI-powered dataset balancing service."""

import json
import re
from typing import Dict
import pandas as pd

from .client import get_gemini_model
from .prompts import build_balance_suggestion_prompt, build_detection_prompt


async def suggest_balance(df: pd.DataFrame, waveform: dict, user_request: str = None, initial_suggestions: dict = None, latest_suggestions: dict = None) -> dict:
    """Generate AI balance suggestions for dataset.

    Args:
        df: Original DataFrame
        waveform: Current waveform data with peaks
        user_request: Optional user request to inform suggestions (e.g., "reduce Big Tech")
        initial_suggestions: Initial AI-generated suggestions (baseline, never modified)
        latest_suggestions: Latest AI-generated suggestions (from previous chat)

    Returns:
        Dictionary with suggestions list and overall strategy
    """
    # Build context about the dataset
    context_parts = [
        f"Dataset Overview:",
        f"- Total data points: {len(df)}",
        f"- Number of clusters: {len(waveform['peaks'])}",
        f"- Columns: {', '.join(df.columns.tolist())}",
        f"\n\nCluster Information (CURRENT STATE):"
    ]

    # Add cluster details with initial AI baseline
    for peak in waveform['peaks']:
        selection_ratio = peak['selectedCount'] / peak['sampleCount'] if peak['sampleCount'] > 0 else 1.0

        # Get initial AI suggestion for this cluster (the original AI analysis)
        initial_ai_info = ""
        if initial_suggestions:
            initial_suggestion = next(
                (s for s in initial_suggestions.get('suggestions', []) if s['id'] == peak['id']),
                None
            )
            if initial_suggestion:
                initial_count = initial_suggestion.get('suggestedCount', peak['sampleCount'])
                initial_weight = initial_suggestion.get('suggestedWeight', 1.0)
                initial_ai_info = f"\n  - Initial AI recommendation (your baseline): {initial_count} samples, weight {initial_weight:.2f}x"

        # Get latest AI suggestion (from previous chat)
        latest_ai_info = ""
        if latest_suggestions:
            latest_suggestion = next(
                (s for s in latest_suggestions.get('suggestions', []) if s['id'] == peak['id']),
                None
            )
            if latest_suggestion:
                latest_count = latest_suggestion.get('suggestedCount', peak['sampleCount'])
                latest_weight = latest_suggestion.get('suggestedWeight', 1.0)
                latest_ai_info = f"\n  - Latest AI suggestion: {latest_count} samples, weight {latest_weight:.2f}x"

        context_parts.append(
            f"\nCluster {peak['id']} - {peak['label']}:"
            f"\n  - Original dataset size: {peak['sampleCount']} samples"
            f"{initial_ai_info}"
            f"{latest_ai_info}"
            f"\n  - User's current selection: {peak['selectedCount']} samples ({selection_ratio:.1%}), weight {peak.get('weight', 1.0):.2f}x"
            f"\n  - Sample examples: {', '.join(peak['samples'][:3])}"
        )

    # Add current metrics
    metrics = waveform['metrics']
    context_parts.append(
        f"\n\nCurrent Balance Metrics:"
        f"\n  - Gini Coefficient: {metrics['giniCoefficient']:.3f} (lower = more balanced)"
        f"\n  - Flatness Score: {metrics['flatnessScore']:.3f} (higher = more balanced)"
    )

    context = "\n".join(context_parts)

    # Build prompt with optional user request
    prompt = build_balance_suggestion_prompt(context, user_request)

    # Call Gemini API
    model = get_gemini_model()
    response = model.generate_content(prompt)
    response_text = response.text.strip()

    # Extract JSON from code blocks if present
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
    if json_match:
        response_text = json_match.group(1)

    suggestions_data = json.loads(response_text)
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
