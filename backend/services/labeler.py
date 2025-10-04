"""
Labeler Service - Generates cluster descriptions using Google Gemini
"""
import google.generativeai as genai
import os
from typing import List, Dict
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Configure Gemini API
def configure_gemini():
    """Configure Gemini API with API key from environment"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    genai.configure(api_key=api_key)

def get_representative_samples(
    texts: List[str],
    embeddings: np.ndarray,
    cluster_mask: np.ndarray,
    centroid: np.ndarray,
    num_samples: int = 7
) -> List[str]:
    """
    Get representative text samples closest to cluster centroid

    Args:
        texts: All text entries
        embeddings: All embeddings
        cluster_mask: Boolean mask for this cluster
        centroid: Cluster centroid vector
        num_samples: Number of samples to return

    Returns:
        List of representative text samples
    """
    cluster_embeddings = embeddings[cluster_mask]
    cluster_texts = [texts[i] for i, mask in enumerate(cluster_mask) if mask]

    if len(cluster_texts) <= num_samples:
        return cluster_texts

    # Calculate similarity to centroid
    similarities = cosine_similarity([centroid], cluster_embeddings)[0]

    # Get indices of top samples
    top_indices = np.argsort(similarities)[-num_samples:]

    return [cluster_texts[i] for i in top_indices]

def label_cluster(sample_texts: List[str], cluster_id: int) -> str:
    """
    Generate a descriptive label for a cluster using Gemini

    Args:
        sample_texts: Representative text samples from the cluster
        cluster_id: Cluster ID number

    Returns:
        Short descriptive label (2-4 words)
    """
    try:
        configure_gemini()

        # Truncate very long samples
        truncated_samples = [t[:200] if len(t) > 200 else t for t in sample_texts]

        # Build prompt
        prompt = f"""You are analyzing a dataset for bias detection.
Given these sample texts from cluster #{cluster_id}, provide a
short descriptive label (2-4 words max) that captures
the common theme or characteristic:

{chr(10).join(f"Sample {i+1}: {text}" for i, text in enumerate(truncated_samples))}

Respond with only the label, no explanation."""

        # Call Gemini API
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(
            prompt,
            generation_config={
                'temperature': 0.3,
                'max_output_tokens': 20,
            }
        )

        label = response.text.strip()

        # Truncate if too long
        if len(label) > 30:
            label = label[:27] + "..."

        return label

    except Exception as e:
        print(f"Error labeling cluster {cluster_id}: {e}")
        # Fallback to generic label
        return f"Group {cluster_id}"

def label_all_clusters(
    texts: List[str],
    embeddings: np.ndarray,
    labels: np.ndarray,
    centroids: Dict[int, np.ndarray]
) -> Dict[int, str]:
    """
    Generate labels for all clusters

    Args:
        texts: All text entries
        embeddings: All embeddings
        labels: Cluster assignments
        centroids: Dictionary of cluster centroids

    Returns:
        Dictionary mapping cluster_id to label string
    """
    cluster_labels = {}
    unique_labels = set(labels)

    for cluster_id in unique_labels:
        if cluster_id == -1:
            # Noise cluster
            cluster_labels[-1] = "Uncategorized"
            continue

        # Get representative samples
        cluster_mask = labels == cluster_id
        centroid = centroids.get(cluster_id)

        if centroid is None:
            cluster_labels[cluster_id] = f"Group {cluster_id}"
            continue

        samples = get_representative_samples(
            texts, embeddings, cluster_mask, centroid, num_samples=7
        )

        # Generate label
        label = label_cluster(samples, cluster_id)
        cluster_labels[int(cluster_id)] = label

    return cluster_labels
