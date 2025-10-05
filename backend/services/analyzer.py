"""Gemini cluster analysis service for generating cluster descriptions."""

from typing import Dict
import numpy as np
import pandas as pd
import json
import google.generativeai as genai
import asyncio
from concurrent.futures import ThreadPoolExecutor

from config import Config

# Configure Gemini
genai.configure(api_key=Config.GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')


def _analyze_single_cluster(cluster_id: int, df: pd.DataFrame, clusters: np.ndarray) -> tuple[int, dict]:
    """
    Analyze a single cluster and return its label and summary.

    Args:
        cluster_id: Cluster ID to analyze
        df: Original DataFrame
        clusters: Cluster labels array

    Returns:
        Tuple of (cluster_id, {"label": str, "summary": str})
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

    # Generate description and summary with Gemini in a single call
    prompt = f"""Analyze these data samples from a cluster and generate:
1. A concise label (3-5 words) describing this cluster
2. A summary (2-3 sentences) explaining what common traits or characteristics caused them to be grouped together

Samples:
{sample_text}

Return ONLY a JSON object in this exact format:
{{"label": "short label here", "summary": "detailed summary here"}}"""

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Try to extract JSON from response (handle markdown code blocks)
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        analysis = json.loads(response_text)

        # Validate response structure
        if "label" not in analysis or "summary" not in analysis:
            raise ValueError("Missing required fields in JSON response")

        print(f"✓ Gemini generated analysis for cluster {cluster_id}: {analysis['label']}")
        return (int(cluster_id), analysis)

    except Exception as e:
        # Fallback if Gemini fails or JSON parsing fails
        print(f"⚠️  Gemini failed for cluster {cluster_id}: {type(e).__name__}: {str(e)}")
        fallback = {
            "label": f"Cluster {cluster_id}",
            "summary": "Unable to generate summary at this time."
        }
        return (int(cluster_id), fallback)


def analyze_clusters(df: pd.DataFrame, clusters: np.ndarray) -> Dict[int, dict]:
    """
    Generate human-readable labels and summaries for each cluster using Gemini in parallel.

    Args:
        df: Original DataFrame
        clusters: Cluster labels array (n_samples,)

    Returns:
        Dictionary mapping cluster_id to {"label": str, "summary": str}
    """
    unique_clusters = np.unique(clusters)

    print(f"Analyzing {len(unique_clusters)} clusters in parallel...")

    # Use ThreadPoolExecutor to parallelize Gemini API calls
    with ThreadPoolExecutor(max_workers=min(10, len(unique_clusters))) as executor:
        # Submit all tasks
        futures = [
            executor.submit(_analyze_single_cluster, cluster_id, df, clusters)
            for cluster_id in unique_clusters
        ]

        # Collect results
        analyses = {}
        for future in futures:
            cluster_id, analysis = future.result()
            analyses[cluster_id] = analysis

    print(f"✓ Finished analyzing all {len(unique_clusters)} clusters")
    return analyses
