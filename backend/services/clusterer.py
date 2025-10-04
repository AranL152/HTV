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
    umap_reducer = UMAP(n_components=1, random_state=42)
    positions = umap_reducer.fit_transform(cluster_centers)

    # Normalize to 0-1 range
    positions_flat = positions.flatten()
    normalized = (positions_flat - positions_flat.min()) / (positions_flat.max() - positions_flat.min())

    return normalized
