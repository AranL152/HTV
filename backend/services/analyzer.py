"""Gemini cluster analysis service for generating cluster descriptions."""

from typing import Dict
import numpy as np
import pandas as pd
import google.generativeai as genai

from config import Config

# Configure Gemini
genai.configure(api_key=Config.GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')


def analyze_clusters(df: pd.DataFrame, clusters: np.ndarray) -> Dict[int, str]:
    """
    Generate human-readable descriptions for each cluster using Gemini.

    Args:
        df: Original DataFrame
        clusters: Cluster labels array (n_samples,)

    Returns:
        Dictionary mapping cluster_id to description string
    """
    descriptions = {}
    unique_clusters = np.unique(clusters)

    for cluster_id in unique_clusters:
        # Get indices for this cluster
        cluster_mask = clusters == cluster_id
        cluster_rows = df[cluster_mask]

        # Sample up to 5 rows
        sample_size = min(5, len(cluster_rows))
        samples = cluster_rows.sample(n=sample_size, random_state=42)

        # Format samples as text
        sample_text = "\n".join([
            f"Row {i+1}: {row.to_dict()}"
            for i, (_, row) in enumerate(samples.iterrows())
        ])

        # Generate description with Gemini
        prompt = f"""Analyze these data samples from a cluster and create a concise label.

Samples:
{sample_text}

Generate a descriptive label for this cluster in 3-5 words. Focus on the key characteristics that define this group. Return only the label, nothing else."""

        try:
            response = model.generate_content(prompt)
            description = response.text.strip()
        except Exception:
            # Fallback label if Gemini fails
            description = f"Cluster {cluster_id}"
            # Note: Using fallback instead of failing ensures graceful degradation

        descriptions[int(cluster_id)] = description

    return descriptions
