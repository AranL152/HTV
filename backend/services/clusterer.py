"""DBSCAN clustering and UMAP 1D projection service."""

import numpy as np
from sklearn.cluster import DBSCAN
from umap import UMAP


def cluster_data(embeddings: np.ndarray) -> np.ndarray:
    """
    Cluster embeddings using DBSCAN with cosine metric.

    Args:
        embeddings: numpy array of embeddings (n_samples x embedding_dim)

    Returns:
        numpy array of cluster labels (n_samples,)
        Noise points (-1) are reassigned to cluster 0
    """
    clusterer = DBSCAN(eps=0.5, min_samples=5, metric='cosine')
    labels = clusterer.fit_predict(embeddings)

    # Reassign noise points (-1) to cluster 0
    labels[labels == -1] = 0

    return labels


def project_to_1d(cluster_centers: np.ndarray) -> np.ndarray:
    """
    Project cluster centers to 1D using UMAP.

    This arranges similar clusters adjacently along the waveform.

    Args:
        cluster_centers: numpy array of cluster center embeddings (n_clusters x embedding_dim)

    Returns:
        numpy array of normalized 1D positions (n_clusters,) in range [0, 1]
    """
    # Handle single cluster case
    if len(cluster_centers) == 1:
        return np.array([0.5])

    # Handle two cluster case (UMAP needs at least 2 neighbors)
    if len(cluster_centers) == 2:
        return np.array([0.0, 1.0])

    umap_reducer = UMAP(n_components=1, random_state=42)
    positions = umap_reducer.fit_transform(cluster_centers)

    # Normalize to 0-1 range
    positions_flat = positions.flatten()
    min_pos = positions_flat.min()
    max_pos = positions_flat.max()

    # Handle case where all positions are the same
    if max_pos == min_pos:
        return np.linspace(0, 1, len(cluster_centers))

    normalized = (positions_flat - min_pos) / (max_pos - min_pos)

    return normalized
