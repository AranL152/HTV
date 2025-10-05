"""K-Means clustering and UMAP 1D projection service."""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from umap import UMAP


def cluster_data(embeddings: np.ndarray, n_clusters: int = None) -> np.ndarray:
    """
    Cluster embeddings using K-Means.

    Args:
        embeddings: numpy array of embeddings (n_samples x embedding_dim)
        n_clusters: number of clusters (default: auto-determine based on dataset size)

    Returns:
        numpy array of cluster labels (n_samples,)
    """
    # Auto-determine number of clusters if not specified
    if n_clusters is None:
        n_samples = len(embeddings)
        if n_samples < 50:
            n_clusters = min(3, n_samples // 10 + 1)
        elif n_samples < 200:
            n_clusters = 4
        elif n_samples < 500:
            n_clusters = 5
        else:
            n_clusters = 7  # Max 7 clusters

    # Ensure we don't have more clusters than samples
    n_clusters = min(n_clusters, len(embeddings))
    n_clusters = max(2, n_clusters)  # At least 2 clusters

    print(f"Clustering into {n_clusters} clusters...")

    clusterer = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = clusterer.fit_predict(embeddings)

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
    min_pos = float(positions_flat.min())
    max_pos = float(positions_flat.max())

    # Handle case where all positions are the same
    if max_pos == min_pos:
        return np.linspace(0, 1, len(cluster_centers))

    normalized = (positions_flat - min_pos) / (max_pos - min_pos)

    return normalized


def extract_clusters_from_csv(df: pd.DataFrame) -> tuple[np.ndarray, dict[int, str]] | None:
    """
    Extract cluster labels from CSV if 'cluster' column exists.

    Args:
        df: pandas DataFrame with optional 'cluster' column

    Returns:
        Tuple of (labels array, label_mapping dict) if cluster column exists, None otherwise
        - labels: numpy array of cluster IDs (n_samples,)
        - label_mapping: dict mapping cluster ID to cluster name
    """
    if 'cluster' not in df.columns:
        return None

    print("Found 'cluster' column in CSV - using predefined clusters")

    # Get unique cluster names
    unique_clusters = df['cluster'].unique()
    print(f"Found {len(unique_clusters)} unique clusters: {list(unique_clusters)}")

    # Create mapping from cluster name to ID
    cluster_to_id = {name: idx for idx, name in enumerate(sorted(unique_clusters))}
    id_to_cluster = {idx: name for name, idx in cluster_to_id.items()}

    # Convert cluster names to numeric IDs
    labels = df['cluster'].map(cluster_to_id).to_numpy()

    return labels, id_to_cluster
