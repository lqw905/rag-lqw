from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from app.models.schemas import (
    SearchRequest,
    SearchResponse,
    SearchHit,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ReferenceItem
)
from app.core.retriever import retriever
from app.core.generator import generator

router = APIRouter(prefix="/api/v1", tags=["Search & Chat"])


@router.post("/retrieval/search", response_model=SearchResponse)
def search_chunks(req: SearchRequest):
    """
    检索测试接口（Retrieval Playground）：
    直接返回密集检索、BM25 检索、RRF 融合及 Reranker 的打分结果，不调用大模型生成
    """
    kb_name = req.kb_name.strip()
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="检索查询文本不能为空")

    try:
        hits = retriever.retrieve(
            kb_name=kb_name,
            query=query,
            dense_top_k=req.dense_top_k or 20,
            sparse_top_k=req.sparse_top_k or 20,
            rerank_top_n=req.rerank_top_n or 5,
            enable_rerank=req.enable_rerank if req.enable_rerank is not None else True
        )

        search_hits = [
            SearchHit(
                rank=h["rank"],
                chunk_id=h["chunk_id"],
                doc_name=h["doc_name"],
                header_path=h["header_path"],
                score=h["score"],
                dense_rank=h.get("dense_rank"),
                sparse_rank=h.get("sparse_rank"),
                content=h["content"]
            )
            for h in hits
        ]

        return SearchResponse(
            kb_name=kb_name,
            query=query,
            total_hits=len(search_hits),
            hits=search_hits
        )
    except Exception as e:
        logger.error(f"Search failed for query '{query}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    """
    RAG 智能对话问答接口：
    - 支持 stream=True 输出 Server-Sent Events (SSE) 流
    - 支持 stream=False 输出完整 JSON 响应
    """
    kb_name = req.kb_name.strip()
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="用户问题不能为空")

    # 1. 混合多路召回 + Rerank
    try:
        retrieved_chunks = retriever.retrieve(
            kb_name=kb_name,
            query=query,
            rerank_top_n=req.top_n or 5,
            enable_rerank=req.enable_rerank if req.enable_rerank is not None else True
        )
    except Exception as e:
        logger.error(f"Retrieval during chat failed: {e}")
        retrieved_chunks = []

    history_dicts = [msg.model_dump() for msg in req.history] if req.history else []

    # 2. 流式响应分支
    if req.stream:
        return StreamingResponse(
            generator.generate_stream(
                query=query,
                retrieved_chunks=retrieved_chunks,
                chat_history=history_dicts
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    # 3. 非流式响应分支
    try:
        gen_result = generator.generate_sync(
            query=query,
            retrieved_chunks=retrieved_chunks,
            chat_history=history_dicts
        )

        references = [
            ReferenceItem(**ref) for ref in gen_result.get("references", [])
        ]

        return ChatCompletionResponse(
            answer=gen_result.get("answer", ""),
            references=references,
            usage=gen_result.get("usage")
        )
    except Exception as e:
        logger.error(f"Chat generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
