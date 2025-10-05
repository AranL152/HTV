"""AI-powered dataset balancing service."""

import json
import re
from typing import Dict
import pandas as pd

from .client import get_gemini_model
from .prompts import build_balance_suggestion_prompt, build_detection_prompt


async def suggest_balance(df: pd.DataFrame, waveform: dict, user_request: str = None) -> dict:
    """Generate AI balance suggestions for dataset.

    Args:
        df: Original DataFrame
        waveform: Current waveform data with peaks
        user_request: Optional user request to inform suggestions (e.g., "reduce Big Tech")

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

    # Add cluster details
    for peak in waveform['peaks']:
        selection_ratio = peak['selectedCount'] / peak['sampleCount'] if peak['sampleCount'] > 0 else 1.0

        # Include current suggested values if they exist
        suggested_info = ""
        if peak.get('suggestedCount') is not None:
            suggested_info = f"\n  - Current AI suggestion: {peak['suggestedCount']}"

        context_parts.append(
            f"\nCluster {peak['id']} - {peak['label']}:"
            f"\n  - Total available samples: {peak['sampleCount']}"
            f"\n  - Currently selected: {peak['selectedCount']} ({selection_ratio:.1%})"
            f"{suggested_info}"
            f"\n  - Examples: {', '.join(peak['samples'][:3])}"
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
