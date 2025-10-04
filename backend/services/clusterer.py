"""
Clusterer Service - Performs DBSCAN clustering and calculates statistics
"""
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_distances
from sklearn.neighbors import NearestNeighbors
import numpy as np
from typing import Dict, List, Tuple

def cluster_embeddings(
    embeddings: np.ndarray,
    eps: float = 0.5,
    min_samples: int = 5
) -> Dict:
    """
    Cluster embeddings using DBSCAN

    Args:
        embeddings: Array of shape (n_samples, 768)
        eps: Maximum distance between two samples to be neighbors
        min_samples: Minimum points required to form a dense region

    Returns:
        Dictionary with labels, num_clusters, and noise_points count
    """
    # Use cosine distance for text embeddings
    distances = cosine_distances(embeddings)

    # Perform DBSCAN clustering
    dbscan = DBSCAN(eps=eps, min_samples=min_samples, metric='precomputed')
    labels = dbscan.fit_predict(distances)

    # Count clusters (excluding noise label -1)
    num_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    noise_points = np.sum(labels == -1)

    return {
        "labels": labels,
        "num_clusters": num_clusters,
        "noise_points": noise_points
    }

def calculate_cluster_stats(
    embeddings: np.ndarray,
    labels: np.ndarray
) -> List[Dict]:
    """
    Calculate statistics for each cluster including size, centroid, and spread

    Args:
        embeddings: Array of shape (n_samples, 768)
        labels: Array of cluster assignments

    Returns:
        List of cluster metadata dictionaries with size, centroid, and spread
    """
    unique_labels = set(labels)

    # Remove noise label if present
    if -1 in unique_labels:
        unique_labels.remove(-1)

    cluster_stats = []

    for label in sorted(unique_labels):
        cluster_mask = labels == label
        cluster_embeddings = embeddings[cluster_mask]
        size = int(np.sum(cluster_mask))

        # Calculate centroid (mean embedding)
        centroid = np.mean(cluster_embeddings, axis=0)

        # Calculate spread (standard deviation of distances to centroid)
        distances = np.linalg.norm(cluster_embeddings - centroid, axis=1)
        spread = float(np.std(distances))

        cluster_stats.append({
            "id": int(label),
            "size": size,
            "centroid": centroid,
            "spread": spread
        })

    return cluster_stats

def compute_gini_coefficient(cluster_sizes: List[int]) -> float:
    """
    Calculate Gini coefficient to measure inequality in cluster distribution

    Args:
        cluster_sizes: List of cluster sizes

    Returns:
        Gini coefficient (0 = perfect equality, 1 = maximum inequality)
    """
    if not cluster_sizes or len(cluster_sizes) == 1:
        return 0.0

    # Sort sizes
    sorted_sizes = sorted(cluster_sizes)
    n = len(sorted_sizes)
    total = sum(sorted_sizes)

    if total == 0:
        return 0.0

    # Calculate Gini coefficient
    cumsum = np.cumsum(sorted_sizes)
    gini = (2 * np.sum((np.arange(1, n + 1)) * sorted_sizes)) / (n * total) - (n + 1) / n

    return round(gini, 3)

def estimate_optimal_eps(embeddings: np.ndarray, k: int = 5) -> float:
    """
    Estimate optimal eps parameter for DBSCAN using k-distance graph

    Args:
        embeddings: Array of shape (n_samples, 768)
        k: Number of neighbors to consider (default: min_samples value)

    Returns:
        Suggested eps value (always > 0)
    """
    # Calculate cosine distances
    distances = cosine_distances(embeddings)

    # For each point, find k-th nearest neighbor distance
    k_distances = []
    for i in range(len(distances)):
        # Get sorted distances for this point (excluding itself)
        sorted_dists = np.sort(distances[i])[1:]  # Skip 0 distance to itself
        if len(sorted_dists) >= k:
            k_distances.append(sorted_dists[k - 1])

    # Use 90th percentile as eps estimate
    if k_distances:
        eps = float(np.percentile(k_distances, 90))
        # Ensure eps is always positive
        if eps <= 0:
            return 0.5
        return max(0.1, round(eps, 3))  # Minimum eps of 0.1

    return 0.5  # Default fallback
