"""local embeddings using sentence-transformers."""

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
import torch

# Use GPU if available, otherwise CPU
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# Use all-MiniLM-L6-v2: tiny (80MB), fast, decent quality
model = SentenceTransformer('all-MiniLM-L6-v2', device=device)


def generate_embeddings(df: pd.DataFrame) -> np.ndarray:
    """
    Generate embeddings for a DataFrame using fast local model.

    Concatenates all columns as text per row and encodes locally.

    Args:
        df: Input DataFrame

    Returns:
        numpy array of embeddings (n_rows x embedding_dim)
    """
    # Concatenate all columns as text per row
    texts = df.astype(str).apply(' '.join, axis=1).tolist()

    # Generate embeddings locally
    embeddings = model.encode(
        texts,
        batch_size=256,  # Larger batches for speed
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True  # Pre-normalize for cosine similarity
    )

    return embeddings
