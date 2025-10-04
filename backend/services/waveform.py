"""Waveform builder with UMAP 1D projection and peak generation."""

from typing import Dict, List
import numpy as np
from .clusterer import project_to_1d


def build_waveform(
    embeddings: np.ndarray,
    clusters: np.ndarray,
    descriptions: Dict[int, str]
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
                    "amplitude": normalized_size,
                    "original_amplitude": normalized_size,
                    "label": description,
                    "weight": 1.0,
                    "color": hex_color,
                    "sample_count": count,
                    "samples": []
                },
                ...
            ],
            "total_points": total_count,
            "metrics": {
                "gini_coefficient": float,
                "flatness_score": float,
                "avg_amplitude": float
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

    # Normalize sizes to amplitudes (0-1 range based on max cluster size)
    max_size = cluster_sizes.max()
    amplitudes = cluster_sizes / max_size

    # Generate colors (simple rainbow gradient)
    colors = [_generate_color(i, n_clusters) for i in range(n_clusters)]

    # Build peaks array
    peaks = []
    for i, cluster_id in enumerate(unique_clusters):
        peak = {
            "id": int(cluster_id),
            "x": float(x_positions[i]),
            "amplitude": float(amplitudes[i]),
            "original_amplitude": float(amplitudes[i]),
            "label": descriptions.get(int(cluster_id), f"Cluster {cluster_id}"),
            "weight": 1.0,
            "color": colors[i],
            "sample_count": int(cluster_sizes[i]),
            "samples": []
        }
        peaks.append(peak)

    # Sort peaks by x position for rendering
    peaks.sort(key=lambda p: p["x"])

    # Calculate metrics
    gini = _calculate_gini(amplitudes)
    metrics = {
        "gini_coefficient": float(gini),
        "flatness_score": float(1 - gini),
        "avg_amplitude": float(amplitudes.mean())
    }

    return {
        "peaks": peaks,
        "total_points": int(len(clusters)),
        "metrics": metrics
    }


def _calculate_gini(amplitudes: np.ndarray) -> float:
    """
    Calculate Gini coefficient for amplitude distribution.

    Args:
        amplitudes: Array of amplitudes

    Returns:
        Gini coefficient (0 = perfect equality, 1 = perfect inequality)
    """
    sorted_amps = np.sort(amplitudes)
    n = len(sorted_amps)
    cumsum = sum((i + 1) * a for i, a in enumerate(sorted_amps))
    total = sum(sorted_amps)

    if total == 0:
        return 0.0

    gini = (2 * cumsum) / (n * total) - (n + 1) / n
    return gini


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
