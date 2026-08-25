import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # LLM Settings (OpenAI Compatible)
    OPENAI_BASE_URL: str = "https://api.deepseek.com/v1"
    OPENAI_API_KEY: str = "sk-placeholder"
    LLM_MODEL: str = "deepseek-chat"
    LLM_TEMPERATURE: float = 0.3
    LLM_MAX_TOKENS: int = 2048

    # Embedding Settings (OpenAI Compatible)
    EMBEDDING_BASE_URL: Optional[str] = None  # If None, fallback to OPENAI_BASE_URL
    EMBEDDING_API_KEY: Optional[str] = None   # If None, fallback to OPENAI_API_KEY
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: Optional[int] = None

    # Reranker Settings
    RERANKER_BASE_URL: Optional[str] = "https://api.siliconflow.cn/v1/rerank"
    RERANKER_API_KEY: Optional[str] = None
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"

    # Storage & Chunking Settings
    CHROMA_PERSIST_DIR: str = "./data/chroma_db"
    BM25_PERSIST_DIR: str = "./data/bm25_indices"
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 80

    # Retrieval parameters
    DENSE_TOP_K: int = 20
    SPARSE_TOP_K: int = 20
    RERANK_TOP_N: int = 5
    RRF_K: int = 60

    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    def get_embedding_base_url(self) -> str:
        return self.EMBEDDING_BASE_URL or self.OPENAI_BASE_URL

    def get_embedding_api_key(self) -> str:
        return self.EMBEDDING_API_KEY or self.OPENAI_API_KEY


# Global settings singleton
settings = Settings()

# Ensure storage directories exist
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
os.makedirs(settings.BM25_PERSIST_DIR, exist_ok=True)
