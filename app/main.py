import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

# 配置跨域中间件（方便开发调试）
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


# 前端静态资源定位与挂载（支持源码运行和 PyInstaller 打包运行）
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

WEB_DIST_DIR = BASE_DIR / "web" / "dist"

if WEB_DIST_DIR.exists():
    logger.info(f"Mounted static web frontend from {WEB_DIST_DIR}")
    assets_dir = WEB_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # 避免拦截未命中的 API 路由
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API route not found")

        # 尝试返回已存在的静态文件（如 favicon.ico 等）
        candidate_file = WEB_DIST_DIR / full_path
        if full_path and candidate_file.is_file():
            return FileResponse(candidate_file)

        # 兜底返回 SPA index.html
        index_file = WEB_DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return HTTPException(status_code=404, detail="Index file not found")


if __name__ == "__main__":
    logger.info(f"Starting RAG-GK backend server on {settings.HOST}:{settings.PORT}")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

