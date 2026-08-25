import os
from typing import List, Dict, Any, Tuple, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
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
        
        # 批量请求（建议每次最多 128 条）
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
                batch_embeddings = [data.embedding for data in response.data]
                all_embeddings.extend(batch_embeddings)
            except Exception as e:
                logger.error(f"Embedding API call failed: {e}")
                raise e

        return all_embeddings

    def get_embedding(self, text: str) -> List[float]:
        return self.get_embeddings([text])[0]


class ChromaVectorStore:
    """ChromaDB 向量数据库管理器"""
    def __init__(self, persist_dir: str = settings.CHROMA_PERSIST_DIR):
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        
        # 初始化持久化客户端
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )

        self.embedder = OpenAIEmbeddingFunction(
            base_url=settings.get_embedding_base_url(),
            api_key=settings.get_embedding_api_key(),
            model=settings.EMBEDDING_MODEL,
            dimensions=settings.EMBEDDING_DIMENSIONS
        )

    def _get_collection_name(self, kb_name: str) -> str:
        # Chroma collection 必须为 3-63 字符的字母数字或下划线/连字符
        # 对非 ASCII 进行安全映射处理
        return f"kb_{kb_name}".replace("-", "_").lower()

    def get_or_create_collection(self, kb_name: str):
        col_name = self._get_collection_name(kb_name)
        return self.client.get_or_create_collection(
            name=col_name,
            metadata={"hnsw:space": "cosine", "kb_name": kb_name}
        )

    def add_chunks(self, kb_name: str, chunks: List[Dict[str, Any]]):
        if not chunks:
            return

        collection = self.get_or_create_collection(kb_name)
        
        ids = [c["chunk_id"] for c in chunks]
        documents = [c["content"] for c in chunks]
        
        # 将嵌套字典展平成 Chroma metadata 支持的标量类型
        metadatas = []
        for c in chunks:
            meta = {
                "chunk_id": c["chunk_id"],
                "doc_name": c.get("metadata", {}).get("file_name", ""),
                "header_path": c.get("header_path", ""),
                "token_count": c.get("token_count", 0),
                "chunk_index": c.get("chunk_index", 0),
                "raw_content": c.get("raw_content", "")[:1000]  # 限制长度
            }
            metadatas.append(meta)

        # 批量生成 Embedding 向量
        logger.info(f"Generating embeddings for {len(documents)} chunks in '{kb_name}'...")
        embeddings = self.embedder.get_embeddings(documents)

        # 写入 Chroma
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        logger.info(f"Successfully upserted {len(chunks)} chunks into Chroma collection '{col_name}'")

    def search(self, kb_name: str, query: str, top_k: int = 20) -> List[Tuple[Dict[str, Any], float]]:
        col_name = self._get_collection_name(kb_name)
        try:
            collection = self.client.get_collection(col_name)
        except Exception:
            return []

        # 编码 query
        query_embedding = self.embedder.get_embedding(query)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, collection.count()) if collection.count() > 0 else 0,
            include=["documents", "metadatas", "distances"]
        )

        search_results = []
        if results and results["ids"] and results["ids"][0]:
            ids = results["ids"][0]
            documents = results["documents"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0]

            for i in range(len(ids)):
                # cosine distance -> cosine similarity (1 - distance)
                sim = 1.0 - float(distances[i])
                chunk_dict = {
                    "chunk_id": ids[i],
                    "content": documents[i],
                    "header_path": metadatas[i].get("header_path", ""),
                    "metadata": metadatas[i]
                }
                search_results.append((chunk_dict, sim))

        return search_results

    def list_knowledge_bases(self) -> List[str]:
        cols = self.client.list_collections()
        kb_names = []
        for c in cols:
            kb_name = c.metadata.get("kb_name") if c.metadata else None
            if kb_name:
                kb_names.append(kb_name)
            else:
                kb_names.append(c.name.replace("kb_", ""))
        return kb_names

    def delete_knowledge_base(self, kb_name: str):
        col_name = self._get_collection_name(kb_name)
        try:
            self.client.delete_collection(col_name)
            logger.info(f"Deleted Chroma collection '{col_name}'")
        except Exception as e:
            logger.warning(f"Collection '{col_name}' not found for deletion: {e}")

    def get_chunk_count(self, kb_name: str) -> int:
        col_name = self._get_collection_name(kb_name)
        try:
            col = self.client.get_collection(col_name)
            return col.count()
        except Exception:
            return 0


# 全局单例
vector_store = ChromaVectorStore()
