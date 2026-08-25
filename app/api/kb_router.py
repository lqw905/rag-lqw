from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from loguru import logger

from app.models.schemas import (
    CreateKBRequest,
    ListKBResponse,
    KBItem,
    UploadDocResponse,
    ListChunksResponse,
    ChunkDetail
)
from app.core.loader import DocumentLoader
from app.core.splitter import MarkdownHeaderSplitter
from app.core.vector_store import vector_store
from app.core.bm25 import bm25_store
from app.config import settings

router = APIRouter(prefix="/api/v1/kb", tags=["Knowledge Base"])


@router.post("/create", response_model=KBItem)
def create_knowledge_base(req: CreateKBRequest):
    """创建新知识库"""
    kb_name = req.kb_name.strip()
    if not kb_name:
        raise HTTPException(status_code=400, detail="知识库名称不能为空")

    try:
        vector_store.get_or_create_collection(kb_name)
        bm25_store.get_or_create_index(kb_name)
        return KBItem(kb_name=kb_name, chunk_count=0, description=req.description)
    except Exception as e:
        logger.error(f"Failed to create KB '{kb_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list", response_model=ListKBResponse)
def list_knowledge_bases():
    """获取所有知识库列表"""
    try:
        kb_names = vector_store.list_knowledge_bases()
        items = []
        for name in kb_names:
            cnt = vector_store.get_chunk_count(name)
            items.append(KBItem(kb_name=name, chunk_count=cnt))
        return ListKBResponse(knowledge_bases=items)
    except Exception as e:
        logger.error(f"Failed to list KBs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{kb_name}")
def delete_knowledge_base(kb_name: str):
    """删除知识库及全部索引"""
    try:
        vector_store.delete_knowledge_base(kb_name)
        bm25_store.delete_kb(kb_name)
        return {"message": f"知识库 '{kb_name}' 已成功删除"}
    except Exception as e:
        logger.error(f"Failed to delete KB '{kb_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{kb_name}/upload", response_model=List[UploadDocResponse])
async def upload_documents(
    kb_name: str,
    files: List[UploadFile] = File(...),
    chunk_size: int = Form(settings.CHUNK_SIZE),
    chunk_overlap: int = Form(settings.CHUNK_OVERLAP)
):
    """
    上传一个或多个文档（支持 .docx, .txt, .md）进行解析、切片与双路索引
    """
    if not files:
        raise HTTPException(status_code=400, detail="上传文件列表为空")

    splitter = MarkdownHeaderSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    responses = []

    for file in files:
        file_name = file.filename
        try:
            file_bytes = await file.read()
            # 1. 统一加载并转为 Markdown 字符串
            markdown_content, doc_meta = DocumentLoader.load_bytes(file_bytes, file_name)
            doc_meta["kb_name"] = kb_name

            # 2. 结构化带标题面包屑的递归切片
            chunks = splitter.split_text(markdown_content, doc_metadata=doc_meta)
            if not chunks:
                logger.warning(f"File '{file_name}' resulted in 0 chunks after splitting")
                responses.append(UploadDocResponse(
                    file_name=file_name,
                    kb_name=kb_name,
                    chunk_count=0,
                    total_tokens=0,
                    message="文件解析完成，但内容为空或未提取到有效文本"
                ))
                continue

            chunk_dicts = [c.to_dict() for c in chunks]
            total_tokens = sum(c.token_count for c in chunks)

            # 3. 写入 Chroma 向量库
            vector_store.add_chunks(kb_name, chunk_dicts)

            # 4. 写入 BM25 稀疏索引
            bm25_store.add_chunks(kb_name, chunk_dicts)

            responses.append(UploadDocResponse(
                file_name=file_name,
                kb_name=kb_name,
                chunk_count=len(chunks),
                total_tokens=total_tokens,
                message="文档解析与索引构建成功"
            ))
            logger.info(f"Successfully ingested '{file_name}' into KB '{kb_name}' ({len(chunks)} chunks, {total_tokens} tokens)")

        except Exception as e:
            logger.error(f"Failed to process file '{file_name}': {e}")
            responses.append(UploadDocResponse(
                file_name=file_name,
                kb_name=kb_name,
                chunk_count=0,
                total_tokens=0,
                message=f"处理失败: {str(e)}"
            ))

    return responses


@router.get("/{kb_name}/chunks", response_model=ListChunksResponse)
def list_chunks(
    kb_name: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    获取知识库中的切片列表（用于前端切片可视化预览）
    """
    all_chunks = bm25_store.get_all_chunks(kb_name)
    total = len(all_chunks)
    paged_chunks = all_chunks[offset:offset + limit]

    details = []
    for c in paged_chunks:
        details.append(ChunkDetail(
            chunk_id=c["chunk_id"],
            header_path=c.get("header_path", ""),
            doc_name=c.get("metadata", {}).get("file_name", ""),
            token_count=c.get("token_count", 0),
            content=c.get("content", ""),
            chunk_index=c.get("chunk_index", 0)
        ))

    return ListChunksResponse(
        kb_name=kb_name,
        total=total,
        chunks=details
    )
