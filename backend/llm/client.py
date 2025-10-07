"""Gemini client configuration."""

import google.generativeai as genai
from config import Config

# Configure Gemini
genai.configure(api_key=Config.GEMINI_API_KEY)


def get_gemini_model(model_name: str = 'gemini-2.0-flash-exp', json_mode: bool = False) -> genai.GenerativeModel:
    """Get configured Gemini model instance.

    Args:
        model_name: Gemini model to use
        json_mode: If True, force JSON output with schema validation

    Returns:
        Configured GenerativeModel instance
    """
    if json_mode:
        # JSON mode with schema for structured output
        generation_config = {
            "response_mime_type": "application/json",
            "response_schema": {
                "type": "object",
                "properties": {
                    "suggestions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "integer"},
                                "suggestedCount": {"type": "integer"},
                                "suggestedWeight": {"type": "number"},
                                "reasoning": {"type": "string"}
                            },
                            "required": ["id", "suggestedCount", "suggestedWeight", "reasoning"]
                        }
                    },
                    "overall_strategy": {"type": "string"}
                },
                "required": ["suggestions", "overall_strategy"]
            }
        }
        return genai.GenerativeModel(model_name, generation_config=generation_config)

    return genai.GenerativeModel(model_name)
