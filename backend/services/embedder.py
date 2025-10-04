"""
Embedder Service - Generates text embeddings using Snowflake Arctic Embed
"""
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Optional
import torch

# Global model instance - loaded once at startup
_model: Optional[SentenceTransformer] = None

def load_model() -> SentenceTransformer:
    """Load Snowflake Arctic Embed model once and cache globally"""
    global _model
    if _model is None:
        print("Loading Snowflake Arctic Embed model...")
        _model = SentenceTransformer('Snowflake/snowflake-arctic-embed-l')

        # Check for GPU availability
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = _model.to(device)
        print(f"Model loaded on device: {device}")

    return _model

def embed_texts(texts: List[str], batch_size: int = 32) -> np.ndarray:
    """
    Generate 768D embeddings for a list of texts

    Handles OOM errors by retrying with smaller batch sizes.

    Args:
        texts: List of text strings to embed
        batch_size: Number of texts to process at once (32 for CPU, 64+ for GPU)

    Returns:
        numpy array of shape (len(texts), 768)

    Raises:
        ValueError: If no valid text entries to embed
        RuntimeError: If embedding fails even with minimal batch size
    """
    model = load_model()

    # Filter out empty strings
    valid_texts = [t.strip() for t in texts if t and t.strip()]

    if not valid_texts:
        raise ValueError("No valid text entries to embed")

    # Try embedding with progressively smaller batch sizes on OOM
    current_batch_size = batch_size
    while current_batch_size >= 1:
        try:
            embeddings = model.encode(
                valid_texts,
                batch_size=current_batch_size,
                show_progress_bar=True,
                normalize_embeddings=True  # L2 normalization for cosine similarity
            )
            return embeddings
        except (RuntimeError, torch.cuda.OutOfMemoryError) as e:
            if current_batch_size == 1:
                raise RuntimeError(f"Failed to embed even with batch_size=1: {e}")

            # Reduce batch size and retry
            current_batch_size = max(1, current_batch_size // 4)
            print(f"OOM error, retrying with batch_size={current_batch_size}")

            # Clear GPU cache if using CUDA
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    raise RuntimeError("Embedding failed unexpectedly")

def embed_single_text(text: str) -> np.ndarray:
    """Embed a single text string"""
    return embed_texts([text], batch_size=1)[0]
