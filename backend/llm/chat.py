"""Chat service for dataset Q&A."""

import pandas as pd

from .client import get_gemini_model
from .prompts import build_chat_prompt


async def generate_chat_response(
    df: pd.DataFrame,
    base_waveform: dict,
    user_waveform: dict,
    user_message: str
) -> str:
    """Generate chat response about dataset.

    Args:
        df: Original DataFrame
        base_waveform: Original dataset (immutable)
        user_waveform: User's current adjustments
        user_message: User's question

    Returns:
        AI-generated response text
    """
    # Build context about the dataset
    context_parts = [
        f"Dataset Overview:",
        f"- Total data points: {len(df)}",
        f"- Number of clusters: {len(base_waveform['peaks'])}",
        f"- Columns: {', '.join(df.columns.tolist())}",
        f"\nDataset sample (first 5 rows):",
        df.head().to_string(),
        f"\n\nCluster Information:"
    ]

    # Add cluster details
    for i, base_peak in enumerate(base_waveform['peaks']):
        user_peak = user_waveform['peaks'][i]
        selection_ratio = user_peak['count'] / base_peak['sampleCount'] if base_peak['sampleCount'] > 0 else 1.0
        context_parts.append(
            f"\nCluster {base_peak['id']}:"
            f"\n  - Label: {base_peak['label']}"
            f"\n  - Original dataset: {base_peak['sampleCount']} samples"
            f"\n  - User's current selection: {user_peak['count']} samples ({selection_ratio:.1%}), weight {user_peak['weight']:.2f}x"
            f"\n  - Position: {base_peak['x']:.2%} along data distribution"
            f"\n  - Sample examples: {', '.join(base_peak['samples'][:3])}"
        )

    context = "\n".join(context_parts)

    # Build prompt
    prompt = build_chat_prompt(context, user_message)

    # Call Gemini API
    model = get_gemini_model()
    response = model.generate_content(prompt)

    return response.text
