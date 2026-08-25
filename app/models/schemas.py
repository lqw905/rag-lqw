from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# ----------------------------------------------------
# 知识库相关 Schemas
# ----------------------------------------------------

class CreateKBRequest(BaseModel):
    kb_name: str = Field(..., description="知识库名称（唯一标识）", json_schema_extra={"example": "my_docs"})
    description: Optional[str] = Field(None, description="知识库描述")


class KBItem(BaseModel):
    kb_name: str
    chunk_count: int
    description: Optional[str] = None


class ListKBResponse(BaseModel):
    knowledge_bases: List[KBItem]


class UploadDocResponse(BaseModel):
    file_name: str
    kb_name: str
    chunk_count: int
    total_tokens: int
    message: str


class ChunkDetail(BaseModel):
    chunk_id: str
    header_path: str
    doc_name: str
    token_count: int
    content: str
    chunk_index: int


class ListChunksResponse(BaseModel):
    kb_name: str
    total: int
    chunks: List[ChunkDetail]


# ----------------------------------------------------
# 检索与对话相关 Schemas
# ----------------------------------------------------

class SearchRequest(BaseModel):
    kb_name: str = Field(..., description="目标知识库名称")
    query: str = Field(..., description="检索查询文本")
    dense_top_k: Optional[int] = Field(20, description="向量检索召回量")
    sparse_top_k: Optional[int] = Field(20, description="BM25 检索召回量")
    rerank_top_n: Optional[int] = Field(5, description="Rerank 精排保留量")
    enable_rerank: Optional[bool] = Field(True, description="是否启用重排")


class SearchHit(BaseModel):
    rank: int
    chunk_id: str
    doc_name: str
    header_path: str
    score: float
    dense_rank: Optional[int] = None
    sparse_rank: Optional[int] = None
    content: str


class SearchResponse(BaseModel):
    kb_name: str
    query: str
    total_hits: int
    hits: List[SearchHit]


class ChatMessage(BaseModel):
    role: str = Field(..., description="角色: user 或 assistant")
    content: str = Field(..., description="对话内容")


class ChatCompletionRequest(BaseModel):
    kb_name: str = Field(..., description="目标知识库")
    query: str = Field(..., description="用户当前问题")
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="多轮对话历史")
    stream: Optional[bool] = Field(True, description="是否流式输出 (SSE)")
    top_n: Optional[int] = Field(5, description="检索参考切片数量")
    enable_rerank: Optional[bool] = Field(True, description="是否启用 Rerank")


class ReferenceItem(BaseModel):
    ref_id: int
    chunk_id: str
    doc_name: str
    header_path: str
    score: float
    snippet: str
    full_content: str


class ChatCompletionResponse(BaseModel):
    answer: str
    references: List[ReferenceItem]
    usage: Optional[Dict[str, int]] = None
