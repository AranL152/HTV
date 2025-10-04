"""
Sampler Service - Extracts representative data points from clusters
"""
import numpy as np
from typing import List, Dict
from sklearn.metrics.pairwise import cosine_distances


def sample_cluster(
    embeddings: np.ndarray,
    cluster_embeddings: np.ndarray,
    cluster_data: List[str],
    centroid: np.ndarray,
    k: int = 5
) -> List[str]:
    """
    Sample k most representative data points from a cluster

    Uses cosine distance to find points nearest to the cluster centroid.

    Args:
        embeddings: Full embedding array (not used, kept for compatibility)
        cluster_embeddings: Embeddings of points in this cluster
        cluster_data: Original data strings for this cluster
        centroid: Cluster centroid vector
        k: Number of samples to return

    Returns:
        List of k representative data strings
    """
    if len(cluster_data) == 0:
        return []

    # If cluster is smaller than k, return all
    if len(cluster_data) <= k:
        return cluster_data

    # Calculate distances from each point to centroid
    # Reshape centroid for broadcasting
    centroid_reshaped = centroid.reshape(1, -1)
    distances = cosine_distances(cluster_embeddings, centroid_reshaped).flatten()

    # Get indices of k nearest points
    nearest_indices = np.argsort(distances)[:k]

    # Return corresponding data strings
    return [cluster_data[i] for i in nearest_indices]


def sample_all_clusters(
    embeddings: np.ndarray,
    labels: np.ndarray,
    data: List[str],
    cluster_stats: List[Dict],
    k: int = 5
) -> Dict[int, List[str]]:
    """
    Sample representative points from all clusters

    Args:
        embeddings: Array of shape (n_samples, 768)
        labels: Cluster assignments
        data: Original data strings
        cluster_stats: List of cluster statistics with centroid
        k: Number of samples per cluster

    Returns:
        Dictionary mapping cluster_id to list of representative samples
    """
    samples = {}

    for stat in cluster_stats:
        cluster_id = stat['id']
        centroid = stat['centroid']

        # Get mask for this cluster
        cluster_mask = labels == cluster_id

        # Extract cluster embeddings and data
        cluster_embeddings = embeddings[cluster_mask]
        cluster_data = [data[i] for i, is_member in enumerate(cluster_mask) if is_member]

        # Sample representative points
        cluster_samples = sample_cluster(
            embeddings,
            cluster_embeddings,
            cluster_data,
            centroid,
            k=k
        )

        samples[cluster_id] = cluster_samples

    return samples
