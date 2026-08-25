from typing import List, Dict, Any, Tuple
from loguru import logger
from app.config import settings
from app.core.vector_store import vector_store
from app.core.bm25 import bm25_store
from app.core.reranker import reranker_client


class HybridRetriever:
    """
    混合检索器：
    1. 并发/顺序调用 Dense 向量检索与 Sparse BM25 检索；
    2. 使用 RRF (Reciprocal Rank Fusion) 融合双路排名；
    3. 调用 Reranker 进行交叉注意力打分，输出 Top-N。
    """

    def __init__(self, rrf_k: int = settings.RRF_K):
        self.rrf_k = rrf_k

    def retrieve(
        self,
        kb_name: str,
        query: str,
        dense_top_k: int = settings.DENSE_TOP_K,
        sparse_top_k: int = settings.SPARSE_TOP_K,
        rerank_top_n: int = settings.RERANK_TOP_N,
        enable_rerank: bool = True
    ) -> List[Dict[str, Any]]:
        """
        核心检索流程
        """
        # 1. 向量密集检索
        try:
            dense_hits = vector_store.search(kb_name, query, top_k=dense_top_k)
        except Exception as e:
            logger.error(f"Dense vector search failed: {e}")
            dense_hits = []

        # 2. BM25 稀疏关键词检索
        try:
            sparse_hits = bm25_store.search(kb_name, query, top_k=sparse_top_k)
        except Exception as e:
            logger.error(f"BM25 search failed: {e}")
            sparse_hits = []

        if not dense_hits and not sparse_hits:
            logger.warning(f"No search results found in KB '{kb_name}' for query: {query}")
            return []

        # 3. RRF (Reciprocal Rank Fusion) 双路融合打分
        # chunk_id -> { "chunk": chunk_dict, "rrf_score": float, "dense_rank": int, "sparse_rank": int }
        fusion_map: Dict[str, Dict[str, Any]] = {}

        # 处理 Dense 排名
        for rank, (chunk, score) in enumerate(dense_hits, start=1):
            cid = chunk["chunk_id"]
            rrf_val = 1.0 / (self.rrf_k + rank)
            fusion_map[cid] = {
                "chunk": chunk,
                "rrf_score": rrf_val,
                "dense_rank": rank,
                "dense_score": score,
                "sparse_rank": None,
                "sparse_score": None
            }

        # 处理 Sparse 排名
        for rank, (chunk, score) in enumerate(sparse_hits, start=1):
            cid = chunk["chunk_id"]
            rrf_val = 1.0 / (self.rrf_k + rank)
            if cid in fusion_map:
                fusion_map[cid]["rrf_score"] += rrf_val
                fusion_map[cid]["sparse_rank"] = rank
                fusion_map[cid]["sparse_score"] = score
            else:
                fusion_map[cid] = {
                    "chunk": chunk,
                    "rrf_score": rrf_val,
                    "dense_rank": None,
                    "dense_score": None,
                    "sparse_rank": rank,
                    "sparse_score": score
                }

        # 按 RRF 得分降序排序，选出前 N 个候选块进入 Rerank
        sorted_fusion = sorted(
            fusion_map.values(),
            key=lambda x: x["rrf_score"],
            reverse=True
        )

        candidate_tuples: List[Tuple[Dict[str, Any], float]] = [
            (item["chunk"], item["rrf_score"]) for item in sorted_fusion
        ]

        # 4. Reranker 精排
        if enable_rerank and candidate_tuples:
            final_hits = reranker_client.rerank(
                query=query,
                candidates=candidate_tuples,
                top_n=rerank_top_n
            )
        else:
            final_hits = candidate_tuples[:rerank_top_n]

        # 5. 组装标准化输出结构
        results = []
        for rank, (chunk, final_score) in enumerate(final_hits, start=1):
            cid = chunk["chunk_id"]
            fusion_info = fusion_map.get(cid, {})
            
            result_item = {
                "rank": rank,
                "chunk_id": cid,
                "content": chunk["content"],
                "header_path": chunk.get("header_path", ""),
                "doc_name": chunk.get("metadata", {}).get("doc_name") or chunk.get("metadata", {}).get("file_name", ""),
                "score": round(final_score, 4),
                "dense_rank": fusion_info.get("dense_rank"),
                "sparse_rank": fusion_info.get("sparse_rank"),
                "metadata": chunk.get("metadata", {})
            }
            results.append(result_item)

        return results


# 全局单例
retriever = HybridRetriever()
