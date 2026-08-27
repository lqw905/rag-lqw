import os
import pickle
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from openai import OpenAI
from loguru import logger
from app.config import settings


class OpenAIEmbeddingFunction:
    """基于 OpenAI 兼容 API 的 Embedding 客户端"""
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        dimensions: Optional[int] = None
    ):
        self.client = OpenAI(base_url=base_url, api_key=api_key)
        self.model = model
        self.dimensions = dimensions

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        # 清洗换行符以优化 embedding 效果
        clean_texts = [t.replace("\n", " ").strip() for t in texts]
        
        # 批量请求（建议每次最多 64 条）
        batch_size = 64
        all_embeddings = []

        for i in range(0, len(clean_texts), batch_size):
            batch = clean_texts[i:i + batch_size]
            kwargs = {
                "input": batch,
                "model": self.model
            }
            if self.dimensions:
                kwargs["dimensions"] = self.dimensions

            try:
                response = self.client.embeddings.create(**kwargs)
            except Exception as e:
                # 若模型供应商（如硅基流动 SiliconFlow）不支持 dimensions 字段，自动降级移除参数重试
                if "dimensions" in kwargs:
                    logger.warning(f"Embedding API 不支持 dimensions 参数 ({e})，正在自动降级重试...")
                    kwargs.pop("dimensions", None)
                    try:
                        response = self.client.embeddings.create(**kwargs)
                    except Exception as retry_err:
                        logger.error(f"Embedding API 降级调用失败: {retry_err}")
                        raise retry_err
                else:
                    logger.error(f"Embedding API 调用失败: {e}")
                    raise e

            batch_embeddings = [data.embedding for data in response.data]
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    def get_embedding(self, text: str) -> List[float]:
        return self.get_embeddings([text])[0]


class VectorCollection:
    """单个知识库的向量集合（基于高精度 NumPy 余弦相似度计算与本地持久化）"""
    def __init__(self, kb_name: str, persist_dir: str):
        self.kb_name = kb_name
        self.persist_dir = persist_dir
        self.file_path = os.path.join(persist_dir, f"{kb_name}.pkl")
        self.chunk_ids: List[str] = []
        self.chunks: List[Dict[str, Any]] = []
        self.embeddings: np.ndarray | None = None  # shape: (N, D), normalized
        self._load()

    def _load(self):
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "rb") as f:
                    data = pickle.load(f)
                    self.chunk_ids = data.get("chunk_ids", [])
                    self.chunks = data.get("chunks", [])
                    raw_emb = data.get("embeddings")
                    if raw_emb is not None and len(raw_emb) > 0:
                        self.embeddings = np.array(raw_emb, dtype=np.float32)
                logger.info(f"Loaded Vector collection '{self.kb_name}' with {len(self.chunks)} chunks")
            except Exception as e:
                logger.error(f"Failed to load Vector collection '{self.kb_name}': {e}")

    def save(self):
        os.makedirs(self.persist_dir, exist_ok=True)
        data = {
            "kb_name": self.kb_name,
            "chunk_ids": self.chunk_ids,
            "chunks": self.chunks,
            "embeddings": self.embeddings
        }
        with open(self.file_path, "wb") as f:
            pickle.dump(data, f)
        logger.debug(f"Saved Vector collection '{self.kb_name}' ({len(self.chunks)} chunks)")

    def add(self, new_chunks: List[Dict[str, Any]], new_embeddings: List[List[float]]):
        if not new_chunks:
            return

        new_emb_arr = np.array(new_embeddings, dtype=np.float32)
        # L2 归一化，方便余弦相似度直接做矩阵点积
        norms = np.linalg.norm(new_emb_arr, axis=1, keepdims=True)
        norms[norms == 0] = 1e-12
        new_emb_norm = new_emb_arr / norms

        for c in new_chunks:
            self.chunk_ids.append(c["chunk_id"])
            self.chunks.append(c)

        if self.embeddings is None or len(self.embeddings) == 0:
            self.embeddings = new_emb_norm
        else:
            self.embeddings = np.vstack([self.embeddings, new_emb_norm])

        self.save()

    def search(self, query_emb: List[float], top_k: int = 20) -> List[Tuple[Dict[str, Any], float]]:
        if self.embeddings is None or len(self.chunks) == 0:
            return []

        q_arr = np.array(query_emb, dtype=np.float32)
        q_norm = np.linalg.norm(q_arr)
        if q_norm == 0:
            return []
        q_norm_vec = q_arr / q_norm

        # 矩阵点积计算余弦相似度
        scores = np.dot(self.embeddings, q_norm_vec)
        top_k = min(top_k, len(self.chunks))
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(scores[idx])
            results.append((self.chunks[idx], score))

        return results


class VectorStoreManager:
    """全局向量数据库管理器（轻量、跨平台稳定、高性能）"""
    def __init__(self, persist_dir: str = settings.CHROMA_PERSIST_DIR):
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        self.collections: Dict[str, VectorCollection] = {}
        
        self.embedder = OpenAIEmbeddingFunction(
            base_url=settings.get_embedding_base_url(),
            api_key=settings.get_embedding_api_key(),
            model=settings.EMBEDDING_MODEL,
            dimensions=settings.EMBEDDING_DIMENSIONS
        )
        self._load_all()

    def _load_all(self):
        if not os.path.exists(self.persist_dir):
            return
        for fname in os.listdir(self.persist_dir):
            if fname.endswith(".pkl"):
                kb_name = fname[:-4]
                self.collections[kb_name] = VectorCollection(kb_name, self.persist_dir)

    def get_or_create_collection(self, kb_name: str) -> VectorCollection:
        if kb_name not in self.collections:
            self.collections[kb_name] = VectorCollection(kb_name, self.persist_dir)
            self.collections[kb_name].save()
        return self.collections[kb_name]

    def add_chunks(self, kb_name: str, chunks: List[Dict[str, Any]]):
        if not chunks:
            return

        collection = self.get_or_create_collection(kb_name)
        documents = [c["content"] for c in chunks]

        # 批量生成 Embedding 向量
        logger.info(f"Generating embeddings for {len(documents)} chunks in '{kb_name}'...")
        embeddings = self.embedder.get_embeddings(documents)

        # 写入向量索引
        collection.add(chunks, embeddings)
        logger.info(f"Successfully ingested {len(chunks)} chunks into Vector collection '{kb_name}'")

    def search(self, kb_name: str, query: str, top_k: int = 20) -> List[Tuple[Dict[str, Any], float]]:
        if kb_name not in self.collections:
            self.get_or_create_collection(kb_name)

        collection = self.collections[kb_name]
        if not collection.chunks:
            return []

        # 编码 query
        query_embedding = self.embedder.get_embedding(query)
        return collection.search(query_embedding, top_k=top_k)

    def list_knowledge_bases(self) -> List[str]:
        # 综合考虑已有集合与 BM25 目录
        names = set(self.collections.keys())
        # 扫描磁盘文件
        if os.path.exists(self.persist_dir):
            for fname in os.listdir(self.persist_dir):
                if fname.endswith(".pkl"):
                    names.add(fname[:-4])
        # 扫描 BM25 索引目录
        if os.path.exists(settings.BM25_PERSIST_DIR):
            for fname in os.listdir(settings.BM25_PERSIST_DIR):
                if fname.endswith(".pkl"):
                    names.add(fname[:-4])
        return sorted(list(names))

    def delete_knowledge_base(self, kb_name: str):
        if kb_name in self.collections:
            col = self.collections.pop(kb_name)
            if os.path.exists(col.file_path):
                try:
                    os.remove(col.file_path)
                    logger.info(f"Deleted vector file: {col.file_path}")
                except Exception as e:
                    logger.error(f"Failed to delete {col.file_path}: {e}")

    def get_chunk_count(self, kb_name: str) -> int:
        if kb_name in self.collections:
            return len(self.collections[kb_name].chunks)
        # 从 BM25 补充查询
        try:
            from app.core.bm25 import bm25_store
            chunks = bm25_store.get_all_chunks(kb_name)
            if chunks:
                return len(chunks)
        except Exception:
            pass
        return 0


# 全局单例
vector_store = VectorStoreManager()
