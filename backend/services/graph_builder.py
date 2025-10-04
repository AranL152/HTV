"""
Graph Builder Service - Constructs graph structure with nodes and edges
"""
import numpy as np
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics.pairwise import cosine_similarity
from umap import UMAP
from typing import List, Dict, Tuple
import colorsys

def reduce_to_3d(embeddings: np.ndarray) -> np.ndarray:
    """
    Reduce 768D embeddings to 3D coordinates using UMAP

    Args:
        embeddings: Array of shape (n_samples, 768)

    Returns:
        Array of shape (n_samples, 3) with 3D positions
    """
    print("Reducing embeddings to 3D with UMAP...")

    reducer = UMAP(
        n_components=3,
        n_neighbors=15,
        min_dist=0.1,
        metric='cosine',
        random_state=42
    )

    positions_3d = reducer.fit_transform(embeddings)

    # Normalize to reasonable bounds for Three.js (-100 to 100)
    min_vals = positions_3d.min(axis=0)
    max_vals = positions_3d.max(axis=0)
    positions_3d = ((positions_3d - min_vals) / (max_vals - min_vals)) * 200 - 100

    return positions_3d

def generate_cluster_colors(num_clusters: int) -> Dict[int, str]:
    """
    Generate distinct colors for each cluster using HSL color space

    Args:
        num_clusters: Number of clusters (excluding noise)

    Returns:
        Dictionary mapping cluster_id to hex color string
    """
    colors = {}

    for i in range(num_clusters):
        # Evenly distribute hue values
        hue = (i * 360 / num_clusters) % 360
        saturation = 70
        lightness = 60

        # Convert HSL to RGB
        r, g, b = colorsys.hls_to_rgb(hue / 360, lightness / 100, saturation / 100)

        # Convert to hex
        hex_color = "#{:02x}{:02x}{:02x}".format(
            int(r * 255), int(g * 255), int(b * 255)
        )
        colors[i] = hex_color

    # Special color for noise cluster
    colors[-1] = "#888888"

    return colors

def build_edges(
    embeddings: np.ndarray,
    k_neighbors: int = 5,
    similarity_threshold: float = 0.7,
    max_edges_per_node: int = 10
) -> List[Dict]:
    """
    Build edges between similar nodes

    Args:
        embeddings: Array of embeddings
        k_neighbors: Number of nearest neighbors to consider
        similarity_threshold: Minimum cosine similarity to create edge
        max_edges_per_node: Maximum edges per node (prevent clutter)

    Returns:
        List of edge dictionaries
    """
    print(f"Building edges with k={k_neighbors}...")

    # Find k-nearest neighbors
    nbrs = NearestNeighbors(n_neighbors=k_neighbors + 1, metric='cosine')
    nbrs.fit(embeddings)
    distances, indices = nbrs.kneighbors(embeddings)

    edges = []
    edge_counts = {}  # Track edges per node

    for i, (neighbor_indices, neighbor_distances) in enumerate(zip(indices, distances)):
        # Skip first neighbor (itself)
        for j, dist in zip(neighbor_indices[1:], neighbor_distances[1:]):
            # Convert distance to similarity
            similarity = 1 - dist

            if similarity < similarity_threshold:
                continue

            # Check max edges limit
            if edge_counts.get(i, 0) >= max_edges_per_node:
                break

            # Avoid duplicate edges (only add if i < j)
            if i < j:
                edges.append({
                    "source": f"node-{i}",
                    "target": f"node-{j}",
                    "weight": round(float(similarity), 3)
                })

                edge_counts[i] = edge_counts.get(i, 0) + 1
                edge_counts[j] = edge_counts.get(j, 0) + 1

    print(f"Created {len(edges)} edges")
    return edges

def build_graph(
    embeddings: np.ndarray,
    labels: np.ndarray,
    positions_3d: np.ndarray,
    texts: List[str],
    original_data: List[Dict],
    cluster_stats: List[Dict],
    cluster_labels: Dict[int, str]
) -> Dict:
    """
    Build complete graph structure

    Args:
        embeddings: 768D embeddings
        labels: Cluster assignments
        positions_3d: 3D coordinates for visualization
        texts: Original text entries
        original_data: Original CSV row data
        cluster_stats: Cluster statistics
        cluster_labels: Gemini-generated labels

    Returns:
        Complete graph dictionary matching API response format
    """
    num_clusters = len([c for c in cluster_stats if c["id"] >= 0])
    colors = generate_cluster_colors(num_clusters)

    # Build nodes
    nodes = []
    for i, (label, pos, text, data) in enumerate(zip(labels, positions_3d, texts, original_data)):
        cluster_id = int(label)

        # Get bias score for this cluster
        bias_score = next(
            (c["bias_score"] for c in cluster_stats if c["id"] == cluster_id),
            0.5
        )

        # Get cluster label
        cluster_label = cluster_labels.get(cluster_id, f"Group {cluster_id}")

        nodes.append({
            "id": f"node-{i}",
            "position": [round(float(pos[0]), 2), round(float(pos[1]), 2), round(float(pos[2]), 2)],
            "cluster": cluster_id,
            "biasScore": round(bias_score, 3),
            "label": cluster_label,
            "data": data
        })

    # Build edges
    edges = build_edges(embeddings)

    # Enhance cluster stats with colors and labels
    clusters = []
    for stat in cluster_stats:
        cluster_id = stat["id"]
        clusters.append({
            "id": cluster_id,
            "label": cluster_labels.get(cluster_id, f"Group {cluster_id}"),
            "size": stat["size"],
            "biasScore": stat["bias_score"],
            "color": colors.get(cluster_id, "#888888"),
            "percentage": stat["percentage"]
        })

    # Calculate Gini coefficient
    from services.clusterer import compute_gini_coefficient
    cluster_sizes = [c["size"] for c in cluster_stats if c["id"] >= 0]
    gini = compute_gini_coefficient(cluster_sizes)

    return {
        "nodes": nodes,
        "edges": edges,
        "clusters": clusters,
        "metrics": {
            "totalNodes": len(nodes),
            "clusterCount": num_clusters,
            "giniCoefficient": gini
        }
    }
