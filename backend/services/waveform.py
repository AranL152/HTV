"""Waveform builder with UMAP 1D projection and peak generation."""

from typing import Dict
import numpy as np
from .clusterer import project_to_1d
from utils.metrics import calculate_gini_coefficient


def build_waveform(
    embeddings: np.ndarray,
    clusters: np.ndarray,
    descriptions: Dict[int, str],
    df=None
) -> dict:
    """
    Build waveform data structure from embeddings and clusters.

    Args:
        embeddings: numpy array of embeddings (n_samples x embedding_dim)
        clusters: numpy array of cluster labels (n_samples,)
        descriptions: Dictionary mapping cluster_id to description string

    Returns:
        Dictionary with structure:
        {
            "peaks": [
                {
                    "id": cluster_id,
                    "x": position (0-1),
                    "selectedCount": count (initially equals sampleCount),
                    "label": description,
                    "color": hex_color,
                    "sampleCount": count,
                    "samples": []
                },
                ...
            ],
            "totalPoints": total_count,
            "metrics": {
                "giniCoefficient": float,
                "flatnessScore": float,
                "avgAmplitude": float
            }
        }
    """
    unique_clusters = np.unique(clusters)
    n_clusters = len(unique_clusters)

    # Calculate cluster centers
    cluster_centers = np.array([
        embeddings[clusters == cluster_id].mean(axis=0)
        for cluster_id in unique_clusters
    ])

    # Project to 1D for x positions
    x_positions = project_to_1d(cluster_centers)

    # Calculate cluster sizes
    cluster_sizes = np.array([
        np.sum(clusters == cluster_id)
        for cluster_id in unique_clusters
    ])

    # Generate colors (simple rainbow gradient)
    colors = [_generate_color(i, n_clusters) for i in range(n_clusters)]

    # Build peaks array
    peaks = []
    for i, cluster_id in enumerate(unique_clusters):
        # Handle potential NaN values
        x_val = float(x_positions[i]) if not np.isnan(x_positions[i]) else 0.5
        sample_count = int(cluster_sizes[i])

        # Get sample data for this cluster
        samples = []
        if df is not None:
            cluster_mask = clusters == cluster_id
            cluster_rows = df[cluster_mask]
            sample_size = min(5, len(cluster_rows))
            sample_rows = cluster_rows.sample(n=sample_size, random_state=42)
            # Convert each row to a readable string format
            samples = [
                ", ".join([f"{col}: {val}" for col, val in row.items()])
                for _, row in sample_rows.iterrows()
            ]

        peak = {
            "id": int(cluster_id),
            "x": x_val,
            "selectedCount": sample_count,  # Initially all points selected
            "label": descriptions.get(int(cluster_id), f"Cluster {cluster_id}"),
            "color": colors[i],
            "sampleCount": sample_count,
            "samples": samples
        }
        peaks.append(peak)

    # Sort peaks by x position for rendering
    peaks.sort(key=lambda p: p["x"])

    # Calculate metrics based on selection ratios
    selection_ratios = np.array([
        peak["selectedCount"] / peak["sampleCount"] if peak["sampleCount"] > 0 else 1.0
        for peak in peaks
    ])

    gini = calculate_gini_coefficient(selection_ratios)
    avg_ratio = selection_ratios.mean()

    # Ensure no NaN values in metrics
    gini_val = float(gini) if not np.isnan(gini) else 0.0
    avg_val = float(avg_ratio) if not np.isnan(avg_ratio) else 1.0

    metrics = {
        "giniCoefficient": gini_val,
        "flatnessScore": 1.0 - gini_val,
        "avgAmplitude": avg_val  # Average selection ratio across clusters
    }

    return {
        "peaks": peaks,
        "totalPoints": int(len(clusters)),
        "metrics": metrics
    }


def _generate_color(index: int, total: int) -> str:
    """
    Generate a color for a cluster using HSL rainbow gradient.

    Args:
        index: Cluster index
        total: Total number of clusters

    Returns:
        Hex color string
    """
    hue = (index / max(total, 1)) * 360
    # Convert HSL to RGB (S=70%, L=60%)
    h = hue / 60
    c = 0.7 * 0.8  # chroma
    x = c * (1 - abs(h % 2 - 1))
    m = 0.6 - c / 2

    if h < 1:
        r, g, b = c, x, 0
    elif h < 2:
        r, g, b = x, c, 0
    elif h < 3:
        r, g, b = 0, c, x
    elif h < 4:
        r, g, b = 0, x, c
    elif h < 5:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x

    r, g, b = int((r + m) * 255), int((g + m) * 255), int((b + m) * 255)
    return f"#{r:02x}{g:02x}{b:02x}"
