"""Gemini client configuration."""

import google.generativeai as genai
from config import Config

# Configure Gemini
genai.configure(api_key=Config.GEMINI_API_KEY)


def get_gemini_model(model_name: str = 'gemini-2.0-flash-exp') -> genai.GenerativeModel:
    """Get configured Gemini model instance."""
    return genai.GenerativeModel(model_name)
