from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import uvicorn

from app.config import settings
from app.api.kb_router import router as kb_router
from app.api.chat_router import router as chat_router

app = FastAPI(
    title="RAG-GK Knowledge Engine API",
    description="轻量级、高精度可信 RAG 知识库问答后端服务",
    version="1.0.0"
)

# 配置跨域中间件（方便方案 A 的 React/Vue 前端本地调试调用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(kb_router)
app.include_router(chat_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "RAG-GK Engine",
        "version": "1.0.0",
        "llm_model": settings.LLM_MODEL,
        "embedding_model": settings.EMBEDDING_MODEL,
        "reranker_model": settings.RERANKER_MODEL
    }


if __name__ == "__main__":
    logger.info(f"Starting RAG-GK backend server on {settings.HOST}:{settings.PORT}")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
