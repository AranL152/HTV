"""Shared metric calculation utilities."""

from typing import List, Union
import numpy as np


def calculate_gini_coefficient(values: Union[List[float], np.ndarray]) -> float:
    """
    Calculate Gini coefficient for a distribution of values.

    The Gini coefficient is a measure of statistical dispersion
    representing inequality in a distribution:
    - 0 = perfect equality (all values are the same)
    - 1 = perfect inequality (one value has everything)

    Args:
        values: List or array of numeric values

    Returns:
        float: Gini coefficient between 0 and 1

    Examples:
        >>> calculate_gini_coefficient([1, 1, 1, 1])  # Perfect equality
        0.0
        >>> calculate_gini_coefficient([0, 0, 0, 100])  # High inequality
        0.75
    """
    if len(values) == 0:
        return 0.0

    # Convert to numpy array if needed
    if isinstance(values, list):
        values = np.array(values)

    # Handle case where all values are zero
    total = values.sum()
    if total == 0:
        return 0.0

    # Sort values
    sorted_values = np.sort(values)
    n = len(sorted_values)

    # Calculate Gini coefficient using the standard formula
    cumsum = sum((i + 1) * val for i, val in enumerate(sorted_values))
    gini = (2 * cumsum) / (n * total) - (n + 1) / n

    return float(gini)


def calculate_flatness_score(values: Union[List[float], np.ndarray]) -> float:
    """
    Calculate flatness score (inverse of Gini coefficient).

    Higher scores indicate more balanced/flat distributions:
    - 1.0 = perfectly flat/balanced
    - 0.0 = highly concentrated/unbalanced

    Args:
        values: List or array of numeric values

    Returns:
        float: Flatness score between 0 and 1
    """
    gini = calculate_gini_coefficient(values)
    return 1.0 - gini
