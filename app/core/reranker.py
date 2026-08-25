import httpx
from typing import List, Dict, Any, Tuple
from loguru import logger
from app.config import settings


class RerankerClient:
    """
    Reranker 客户端：
    调用在线 Cross-Encoder Rerank API（支持 SiliconFlow / Jina / BGE API），
    若未配置 API Key 或请求异常，自动平滑回退（Fallback）到基于初筛融合分数的排序。
    """

    def __init__(
        self,
        base_url: str = settings.RERANKER_BASE_URL,
        api_key: str = settings.RERANKER_API_KEY,
        model: str = settings.RERANKER_MODEL
    ):
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    def rerank(
        self,
        query: str,
        candidates: List[Tuple[Dict[str, Any], float]],
        top_n: int = 5
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        输入: candidates 为 [(chunk_dict, initial_score), ...]
        输出: 重排后筛选出的 [(chunk_dict, rerank_score), ...]
        """
        if not candidates:
            return []

        # 若候选块数量小于等于 top_n，直接归一化并返回
        if len(candidates) <= top_n and not self.api_key:
            return candidates

        # 检查是否配置了 Reranker API
        if not self.api_key or not self.base_url:
            logger.debug("Reranker API key not configured, using fusion scores as fallback.")
            return candidates[:top_n]

        documents = [c[0]["content"] for c in candidates]

        payload = {
            "model": self.model,
            "query": query,
            "documents": documents,
            "top_n": min(top_n, len(documents)),
            "return_documents": False
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(self.base_url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    reranked = []
                    for item in results:
                        orig_idx = item["index"]
                        score = float(item["relevance_score"])
                        reranked.append((candidates[orig_idx][0], score))
                    
                    logger.info(f"Successfully reranked {len(candidates)} candidates down to {len(reranked)}")
                    return reranked
                else:
                    logger.warning(f"Reranker API returned status {resp.status_code}: {resp.text}. Falling back to fusion scores.")
                    return candidates[:top_n]
        except Exception as e:
            logger.warning(f"Reranker API request failed: {e}. Falling back to fusion scores.")
            return candidates[:top_n]


# 全局单例
reranker_client = RerankerClient()
