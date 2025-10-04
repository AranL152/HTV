"""Lightweight local embeddings using sentence-transformers."""

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

# Load lightweight model (90MB, ~400MB RAM)
model = SentenceTransformer('all-MiniLM-L6-v2')


def generate_embeddings(df: pd.DataFrame) -> np.ndarray:
    """
    Generate embeddings for a DataFrame using local MiniLM model.

    Concatenates all columns as text per row and encodes using all-MiniLM-L6-v2.

    Args:
        df: Input DataFrame

    Returns:
        numpy array of embeddings (n_rows x embedding_dim)
    """
    # Concatenate all columns as text per row
    texts = df.astype(str).apply(' '.join, axis=1).tolist()

    # Generate embeddings locally (fast, no API limits)
    embeddings = model.encode(texts, show_progress_bar=False)

    return embeddings
