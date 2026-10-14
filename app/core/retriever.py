import re
from typing import List, Dict, Any, Tuple, Optional
from loguru import logger
from app.config import settings
from app.core.vector_store import vector_store
from app.core.bm25 import bm25_store
from app.core.reranker import reranker_client
from app.core.query_rewriter import query_rewriter, is_chitchat, CHITCHAT_PATTERNS


class HybridRetriever:
    """
    混合检索器：
    1. 前置意图识别：识别日常打招呼/闲聊并跳过检索；
    2. 轻量 LLM 查询提纯（Query Rewriting）：去除口语与宽泛修饰词噪声，提炼核心检索实体；
    3. 并发/顺序调用 Dense 向量检索与 Sparse BM25 检索；
    4. 使用 RRF (Reciprocal Rank Fusion) 融合双路排名；
    5. 调用 Reranker 进行交叉注意力打分，并通过置信度阈值过滤无效噪音，输出 Top-N。
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
        enable_rerank: bool = True,
        enable_rewrite: Optional[bool] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        min_score: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        核心检索流程
        """
        query_str = query.strip()
        if not query_str:
            return []

        # 1. 意图识别：若为纯问候/闲聊，直接跳过检索，返回空切片
        if is_chitchat(query_str):
            logger.info(f"Query '{query_str}' recognized as chitchat. Skipping KB retrieval.")
            return []

        # 2. 查询提纯与改写（去噪提纯核心检索实体）
        should_rewrite = enable_rewrite if enable_rewrite is not None else settings.ENABLE_QUERY_REWRITE
        search_query = query_str
        if should_rewrite:
            try:
                search_query = query_rewriter.rewrite(query_str, chat_history=chat_history)
            except Exception as e:
                logger.warning(f"Query rewrite failed: {e}, falling back to original query")
                search_query = query_str

        # 3. 向量密集检索
        try:
            dense_hits = vector_store.search(kb_name, search_query, top_k=dense_top_k)
        except Exception as e:
            logger.error(f"Dense vector search failed: {e}")
            dense_hits = []

        # 4. BM25 稀疏关键词检索
        try:
            sparse_hits = bm25_store.search(kb_name, search_query, top_k=sparse_top_k)
        except Exception as e:
            logger.error(f"BM25 search failed: {e}")
            sparse_hits = []

        if not dense_hits and not sparse_hits:
            logger.warning(f"No search results found in KB '{kb_name}' for query: {search_query}")
            return []

        # 4. RRF (Reciprocal Rank Fusion) 双路融合打分
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

        # 5. Reranker 精排
        if enable_rerank and candidate_tuples:
            final_hits = reranker_client.rerank(
                query=search_query,
                candidates=candidate_tuples,
                top_n=rerank_top_n
            )
        else:
            final_hits = candidate_tuples[:rerank_top_n]

        # 6. 置信度阈值过滤：剔除相关度过低（低于 min_score）的噪音切片
        threshold = min_score if min_score is not None else settings.RERANK_MIN_SCORE
        # 仅当使用了 Reranker 计算出的真实语义分数时才执行阈值过滤（Reranker 分数一般在 0~1 之间）
        if enable_rerank and reranker_client.api_key:
            filtered_hits = [(chunk, score) for chunk, score in final_hits if score >= threshold]
            if len(filtered_hits) < len(final_hits):
                logger.info(f"Filtered out {len(final_hits) - len(filtered_hits)} low-score chunks (threshold: {threshold})")
            
            # 软保底机制：若全部被阈值过滤，但候选块确实有内容且最高分高于软保底线（>= 0.02），保留最高分的 1 个切片避免彻底落空
            if not filtered_hits and final_hits and final_hits[0][1] >= 0.02:
                logger.info(f"Soft fallback: retained top-1 chunk with score {final_hits[0][1]:.4f}")
                filtered_hits = [final_hits[0]]

            final_hits = filtered_hits

        # 7. 组装标准化输出结构
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
                "search_query": search_query,
                "metadata": chunk.get("metadata", {})
            }
            results.append(result_item)

        return results


# 全局单例
retriever = HybridRetriever()
