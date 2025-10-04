"""Chat service for dataset Q&A."""

import pandas as pd

from .client import get_gemini_model
from .prompts import build_chat_prompt


async def generate_chat_response(
    df: pd.DataFrame,
    waveform: dict,
    user_message: str
) -> str:
    """Generate chat response about dataset.

    Args:
        df: Original DataFrame
        waveform: Current waveform data
        user_message: User's question

    Returns:
        AI-generated response text
    """
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
        selection_ratio = peak['selectedCount'] / peak['sampleCount'] if peak['sampleCount'] > 0 else 1.0
        context_parts.append(
            f"\nCluster {peak['id']}:"
            f"\n  - Label: {peak['label']}"
            f"\n  - Sample count: {peak['sampleCount']}"
            f"\n  - Selected count: {peak['selectedCount']} ({selection_ratio:.1%})"
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

    # Build prompt
    prompt = build_chat_prompt(context, user_message)

    # Call Gemini API
    model = get_gemini_model()
    response = model.generate_content(prompt)

    return response.text
