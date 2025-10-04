"""
Terrain Builder Service - Generates 3D height maps from cluster data
"""
import numpy as np
from scipy.ndimage import gaussian_filter
from typing import List, Dict
import colorsys


def generate_color(cluster_id: int, num_clusters: int) -> str:
    """
    Generate distinct colors for each cluster using HSV color space

    Args:
        cluster_id: Cluster identifier
        num_clusters: Total number of clusters

    Returns:
        Hex color string (e.g., "#FF6B6B")
    """
    # Use golden ratio for evenly spaced hues
    hue = (cluster_id * 0.618033988749895) % 1.0

    # High saturation and value for vibrant colors
    saturation = 0.7 + (cluster_id % 3) * 0.1  # Vary saturation slightly
    value = 0.8 + (cluster_id % 2) * 0.1  # Vary brightness slightly

    # Convert to RGB
    r, g, b = colorsys.hsv_to_rgb(hue, saturation, value)

    # Convert to hex
    return f"#{int(r * 255):02X}{int(g * 255):02X}{int(b * 255):02X}"


def add_gaussian_hill(
    grid: np.ndarray,
    center: np.ndarray,
    height: float,
    radius: float,
    grid_size: int
) -> None:
    """
    Add a Gaussian hill to the height grid (in-place)

    Uses formula: height * exp(-distance^2 / (2 * radius^2))

    Args:
        grid: Height grid to modify (grid_size x grid_size)
        center: [x, z] position on terrain
        height: Peak height of the hill
        radius: Base radius of the hill
        grid_size: Size of the grid
    """
    cx, cz = center

    # Generate coordinate arrays
    x = np.arange(grid_size)
    z = np.arange(grid_size)
    X, Z = np.meshgrid(x, z, indexing='ij')

    # Calculate distances from center
    distances = np.sqrt((X - cx) ** 2 + (Z - cz) ** 2)

    # Apply Gaussian formula
    hill_contribution = height * np.exp(-(distances ** 2) / (2 * radius ** 2))

    # Add to grid (hills blend additively)
    grid += hill_contribution


def build_terrain(
    positions_2d: np.ndarray,
    labels: np.ndarray,
    cluster_stats: List[Dict],
    cluster_analyses: Dict[int, Dict[str, str]],
    cluster_samples: Dict[int, List[str]],
    grid_size: int = 100
) -> Dict:
    """
    Build complete terrain structure with hills and height map

    Args:
        positions_2d: UMAP 2D positions of all data points (n_samples, 2)
        labels: Cluster assignments
        cluster_stats: List of cluster statistics (size, centroid, spread)
        cluster_analyses: Gemini-generated labels and descriptions
        cluster_samples: Representative samples per cluster
        grid_size: Resolution of height map (default: 100x100)

    Returns:
        Dictionary with hills, heightData, gridSize, and metrics
    """
    # Initialize empty grid
    height_grid = np.zeros((grid_size, grid_size))

    # Calculate normalization factors
    cluster_sizes = [stat['size'] for stat in cluster_stats]
    max_cluster_size = max(cluster_sizes) if cluster_sizes else 1
    total_points = sum(cluster_sizes)

    # Normalize 2D positions to grid coordinates
    # Map to range [grid_size * 0.1, grid_size * 0.9] for padding
    padding = 0.1
    min_pos = positions_2d.min(axis=0)
    max_pos = positions_2d.max(axis=0)
    pos_range = max_pos - min_pos

    # Avoid division by zero
    pos_range = np.where(pos_range == 0, 1, pos_range)

    # Build hills list
    hills = []

    for stat in cluster_stats:
        cluster_id = stat['id']
        cluster_mask = labels == cluster_id
        cluster_positions = positions_2d[cluster_mask]

        # Calculate center position (mean of cluster points)
        center_normalized = (cluster_positions.mean(axis=0) - min_pos) / pos_range
        center_x = padding * grid_size + center_normalized[0] * (1 - 2 * padding) * grid_size
        center_z = padding * grid_size + center_normalized[1] * (1 - 2 * padding) * grid_size

        # Calculate height based on cluster size (normalized to 0-10 range)
        height = (stat['size'] / max_cluster_size) * 10.0

        # Calculate radius based on cluster spread
        # Use spread * scaling factor, with min/max bounds
        radius = max(5.0, min(15.0, stat['spread'] * 20.0))

        # Get analysis results (with fallback)
        analysis = cluster_analyses.get(cluster_id, {
            'label': f'Cluster {cluster_id}',
            'description': ''
        })

        # Get samples (with fallback)
        samples = cluster_samples.get(cluster_id, [])

        # Create hill object
        hill = {
            'id': cluster_id,
            'center': [float(center_x), float(center_z)],
            'height': float(height),
            'originalHeight': float(height),
            'radius': float(radius),
            'label': analysis['label'],
            'description': analysis.get('description', ''),
            'weight': 1.0,
            'color': generate_color(cluster_id, len(cluster_stats)),
            'sampleCount': stat['size'],
            'samples': samples[:5]  # Include up to 5 samples
        }

        hills.append(hill)

        # Add Gaussian hill to height grid
        add_gaussian_hill(
            height_grid,
            np.array([center_x, center_z]),
            height,
            radius,
            grid_size
        )

    # Apply Gaussian smoothing for organic appearance
    height_grid = gaussian_filter(height_grid, sigma=1.5)

    # Calculate metrics
    from .clusterer import compute_gini_coefficient

    gini = compute_gini_coefficient(cluster_sizes)
    flatness = 1.0 - gini

    metrics = {
        'totalPoints': total_points,
        'clusterCount': len(cluster_stats),
        'giniCoefficient': float(gini),
        'flatnessScore': float(flatness)
    }

    # Convert height grid to list of lists for JSON serialization
    height_data = height_grid.tolist()

    return {
        'hills': hills,
        'gridSize': grid_size,
        'heightData': height_data,
        'metrics': metrics
    }


def recalculate_metrics(hills: List[Dict]) -> Dict:
    """
    Recalculate metrics after weight adjustments

    Args:
        hills: List of hill objects with weights applied

    Returns:
        Updated metrics dictionary
    """
    # Calculate effective cluster sizes (size * weight)
    effective_sizes = [hill['sampleCount'] * hill['weight'] for hill in hills]

    # Recalculate Gini coefficient
    from .clusterer import compute_gini_coefficient

    gini = compute_gini_coefficient([int(s) for s in effective_sizes])
    flatness = 1.0 - gini

    total_points = sum(hill['sampleCount'] for hill in hills)

    return {
        'totalPoints': total_points,
        'clusterCount': len(hills),
        'giniCoefficient': float(gini),
        'flatnessScore': float(flatness)
    }
