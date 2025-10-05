"""Gemini cluster analysis service for generating cluster descriptions."""

from typing import Dict
import numpy as np
import pandas as pd
import google.generativeai as genai
import asyncio
from concurrent.futures import ThreadPoolExecutor

from config import Config

# Configure Gemini
genai.configure(api_key=Config.GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-pro')


def _analyze_single_cluster(cluster_id: int, df: pd.DataFrame, clusters: np.ndarray) -> tuple[int, str]:
    """
    Analyze a single cluster and return its description.

    Args:
        cluster_id: Cluster ID to analyze
        df: Original DataFrame
        clusters: Cluster labels array

    Returns:
        Tuple of (cluster_id, description)
    """
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
        print(f"✓ Gemini generated description for cluster {cluster_id}: {description}")
    except Exception as e:
        # Fallback label if Gemini fails
        print(f"⚠️  Gemini failed for cluster {cluster_id}: {type(e).__name__}: {str(e)}")
        description = f"Cluster {cluster_id}"
        # Note: Using fallback instead of failing ensures graceful degradation

    return (int(cluster_id), description)


def analyze_clusters(df: pd.DataFrame, clusters: np.ndarray, cluster_labels_map: Dict[int, str] = None) -> Dict[int, str]:
    """
    Generate human-readable descriptions for each cluster using Gemini in parallel.
    If cluster_labels_map is provided (from CSV), use those labels instead of generating new ones.

    Args:
        df: Original DataFrame
        clusters: Cluster labels array (n_samples,)
        cluster_labels_map: Optional mapping from cluster ID to label (from CSV 'cluster' column)

    Returns:
        Dictionary mapping cluster_id to description string
    """
    unique_clusters = np.unique(clusters)

    # If we have predefined labels from CSV, use them directly
    if cluster_labels_map is not None:
        print(f"Using predefined cluster labels from CSV for {len(unique_clusters)} clusters")
        descriptions = {}
        for cluster_id in unique_clusters:
            label = cluster_labels_map.get(cluster_id, f"Cluster {cluster_id}")
            descriptions[int(cluster_id)] = label
            print(f"✓ Cluster {cluster_id}: {label}")
        return descriptions

    # Otherwise, generate descriptions with Gemini
    print(f"Analyzing {len(unique_clusters)} clusters in parallel...")

    # Use ThreadPoolExecutor to parallelize Gemini API calls
    with ThreadPoolExecutor(max_workers=min(10, len(unique_clusters))) as executor:
        # Submit all tasks
        futures = [
            executor.submit(_analyze_single_cluster, cluster_id, df, clusters)
            for cluster_id in unique_clusters
        ]

        # Collect results
        descriptions = {}
        for future in futures:
            cluster_id, description = future.result()
            descriptions[cluster_id] = description

    print(f"✓ Finished analyzing all {len(unique_clusters)} clusters")
    return descriptions
