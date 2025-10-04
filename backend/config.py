"""Application configuration with environment variable validation."""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Application configuration with validation."""

    # API Keys
    GEMINI_API_KEY: str = os.getenv('GEMINI_API_KEY', '')
    COHERE_API_KEY: str = os.getenv('COHERE_API_KEY', '')

    # CORS Settings
    ALLOWED_ORIGINS: list[str] = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')

    # Server Settings
    HOST: str = os.getenv('HOST', '0.0.0.0')
    PORT: int = int(os.getenv('PORT', '8000'))

    @classmethod
    def validate(cls) -> None:
        """Validate required environment variables."""
        errors = []

        if not cls.GEMINI_API_KEY:
            errors.append("GEMINI_API_KEY is required")

        if not cls.COHERE_API_KEY:
            errors.append("COHERE_API_KEY is required (currently unused but reserved)")

        if errors:
            raise ValueError(
                f"Environment validation failed:\n" + "\n".join(f"  - {err}" for err in errors)
            )


# Validate on import
try:
    Config.validate()
except ValueError as e:
    print(f"⚠️  Configuration Error: {e}")
    print("Please ensure all required environment variables are set in .env file")
    raise
