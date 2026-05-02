from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"

    class Config:
        env_file = ".env"


settings = Settings()
