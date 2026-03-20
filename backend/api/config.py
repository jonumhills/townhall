"""
Backend Configuration - Loads from .env file
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from root directory (2 levels up from api/)
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path, override=True)


class Settings:
    """Backend API Settings"""

    # API Server
    API_HOST: str = os.getenv("API_HOST", "localhost")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    API_RELOAD: bool = os.getenv("API_RELOAD", "true").lower() == "true"

    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

    # Data Directories
    DATA_ROOT_DIR: Path = Path(__file__).parent.parent.parent / "data"

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # API Metadata
    API_TITLE: str = "Townhall Rezoning Tracker API"
    API_DESCRIPTION: str = "REST API for government rezoning petition data"
    API_VERSION: str = "1.0.0"

    # Elasticsearch Configuration
    ELASTIC_ENDPOINT: str = os.getenv("VITE_ELASTIC_ENDPOINT", "")
    KIBANA_ENDPOINT: str = os.getenv("VITE_KIBANA_ENDPOINT", "")
    ELASTIC_API_KEY: str = os.getenv("VITE_ELASTIC_API_KEY", "")
    ALERT_AGENT_ID: str = os.getenv("ALERT_AGENT_ID", "townhall_alert_checker")

    # Mapbox Configuration
    MAPBOX_TOKEN: str = os.getenv("VITE_MAPBOX_TOKEN", "")

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # Email Service (SMTP)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    ALERT_FROM_EMAIL: str = os.getenv("ALERT_FROM_EMAIL", "")
    APP_URL: str = os.getenv("VITE_APP_URL", "http://localhost:5173")


settings = Settings()
