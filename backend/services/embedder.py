"""Snowflake Arctic Embed service for generating embeddings."""

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

# Load model at module level (cache for reuse)
model = SentenceTransformer('Snowflake/snowflake-arctic-embed-l')


def generate_embeddings(df: pd.DataFrame) -> np.ndarray:
    """
    Generate embeddings for a DataFrame.

    Concatenates all columns as text per row and encodes using Snowflake Arctic Embed.

    Args:
        df: Input DataFrame

    Returns:
        numpy array of embeddings (n_rows x embedding_dim)
    """
    # Concatenate all columns as text per row
    texts = df.astype(str).apply(' '.join, axis=1).tolist()

    # Generate embeddings
    embeddings = model.encode(texts)

    return embeddings
