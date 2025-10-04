"""
Analyzer Service - Generates human-readable cluster descriptions using Gemini API
"""
import google.generativeai as genai
import asyncio
import os
from typing import List, Dict, Optional


# Configure Gemini API
def configure_gemini():
    """Configure Gemini API with key from environment"""
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("WARNING: GEMINI_API_KEY not found. Cluster analysis will use fallback labels.")
        return False

    genai.configure(api_key=api_key)
    return True


def analyze_cluster(samples: List[str], cluster_id: int) -> Dict[str, str]:
    """
    Generate description for a single cluster using Gemini API

    Args:
        samples: Representative data samples from the cluster
        cluster_id: Cluster identifier

    Returns:
        Dictionary with 'label' and 'description' fields
    """
    # Check if API is configured
    if not os.getenv('GEMINI_API_KEY'):
        return {
            'label': f'Cluster {cluster_id}',
            'description': f'Data cluster {cluster_id} with {len(samples)} representative samples'
        }

    try:
        # Create prompt for Gemini
        prompt = f"""Analyze these representative data samples from a cluster and provide:
1. A short label (2-4 words) that captures the main theme
2. A brief description (1-2 sentences) explaining what this cluster represents

Representative samples:
{chr(10).join(f'- {sample[:200]}' for sample in samples[:10])}

Respond in this exact format:
Label: [your 2-4 word label]
Description: [your 1-2 sentence description]"""

        # Call Gemini API
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=100,
            )
        )

        # Parse response
        response_text = response.text.strip()
        lines = response_text.split('\n')

        label = f'Cluster {cluster_id}'
        description = ''

        for line in lines:
            if line.startswith('Label:'):
                label = line.replace('Label:', '').strip()
            elif line.startswith('Description:'):
                description = line.replace('Description:', '').strip()

        return {
            'label': label,
            'description': description
        }

    except Exception as e:
        print(f"Error analyzing cluster {cluster_id}: {e}")
        # Fallback to generic label
        return {
            'label': f'Cluster {cluster_id}',
            'description': f'Data cluster {cluster_id} with {len(samples)} representative samples'
        }


async def analyze_cluster_async(samples: List[str], cluster_id: int) -> Dict[str, str]:
    """
    Async wrapper for analyze_cluster

    Args:
        samples: Representative data samples from the cluster
        cluster_id: Cluster identifier

    Returns:
        Dictionary with 'label' and 'description' fields
    """
    # Run in executor to avoid blocking
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, analyze_cluster, samples, cluster_id)


async def analyze_all_clusters(cluster_samples: Dict[int, List[str]]) -> Dict[int, Dict[str, str]]:
    """
    Analyze all clusters concurrently using Gemini API

    Args:
        cluster_samples: Dictionary mapping cluster_id to list of sample strings

    Returns:
        Dictionary mapping cluster_id to analysis results (label and description)
    """
    # Create async tasks for all clusters
    tasks = []
    cluster_ids = []

    for cluster_id, samples in cluster_samples.items():
        task = analyze_cluster_async(samples, cluster_id)
        tasks.append(task)
        cluster_ids.append(cluster_id)

    # Run all analyses concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Build result dictionary
    analyses = {}
    for cluster_id, result in zip(cluster_ids, results):
        if isinstance(result, Exception):
            # Use fallback for failed analyses
            analyses[cluster_id] = {
                'label': f'Cluster {cluster_id}',
                'description': f'Data cluster {cluster_id}'
            }
        else:
            analyses[cluster_id] = result

    return analyses
