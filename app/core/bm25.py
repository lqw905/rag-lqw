# -*- coding: utf-8 -*-
import os
import pickle
import re
from typing import List, Dict, Any, Tuple
import jieba
from rank_bm25 import BM25Plus
from loguru import logger
from app.config import settings


def tokenize_chinese(text: str) -> List[str]:
    """使用 Jieba 分词并过滤标点符号"""
    if not text:
        return []
    tokens = [
        t.strip().lower()
        for t in jieba.cut(text)
        if t.strip() and not re.match(r'^[\s\.,!\?，。！？：；"\'\(\)\[\]{}、\-—_=`~<>/\\]+$', t)
    ]
    return tokens


class BM25Index:
    """单个知识库的 BM25 倒排索引封装（采用 BM25Plus 算法，避免小样本零分问题）"""
    def __init__(self, kb_name: str):
        self.kb_name = kb_name
        self.chunks: List[Dict[str, Any]] = []
        self.corpus_tokens: List[List[str]] = []
        self.bm25: BM25Plus | None = None

    def add_chunks(self, new_chunks: List[Dict[str, Any]]):
        for c in new_chunks:
            self.chunks.append(c)
            tokens = tokenize_chinese(c["content"])
            self.corpus_tokens.append(tokens)

        if self.corpus_tokens:
            self.bm25 = BM25Plus(self.corpus_tokens)

    def search(self, query: str, top_k: int = 20) -> List[Tuple[Dict[str, Any], float]]:
        if not self.bm25 or not self.chunks:
            return []

        query_tokens = tokenize_chinese(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)
        query_set = set(query_tokens)
        
        # 仅挑选确实命中了至少一个查询词的块
        ranked_items = []
        for idx, score in enumerate(scores):
            doc_token_set = set(self.corpus_tokens[idx])
            # 校验交集
            if query_set.intersection(doc_token_set):
                ranked_items.append((self.chunks[idx], float(score)))

        ranked_items.sort(key=lambda x: x[1], reverse=True)
        return ranked_items[:top_k]


class BM25Store:
    """全局 BM25 知识库管理与持久化"""
    def __init__(self, persist_dir: str = settings.BM25_PERSIST_DIR):
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        self.indices: Dict[str, BM25Index] = {}
        self._load_all_from_disk()

    def _get_index_path(self, kb_name: str) -> str:
        return os.path.join(self.persist_dir, f"{kb_name}.pkl")

    def _load_all_from_disk(self):
        for fname in os.listdir(self.persist_dir):
            if fname.endswith(".pkl"):
                kb_name = fname[:-4]
                path = os.path.join(self.persist_dir, fname)
                try:
                    with open(path, "rb") as f:
                        data = pickle.load(f)
                        idx = BM25Index(kb_name)
                        idx.chunks = data.get("chunks", [])
                        idx.corpus_tokens = data.get("corpus_tokens", [])
                        if idx.corpus_tokens:
                            idx.bm25 = BM25Plus(idx.corpus_tokens)
                        self.indices[kb_name] = idx
                    logger.info(f"Loaded BM25 index for '{kb_name}' with {len(idx.chunks)} chunks")
                except Exception as e:
                    logger.error(f"Failed to load BM25 index from {path}: {e}")

    def get_or_create_index(self, kb_name: str) -> BM25Index:
        if kb_name not in self.indices:
            self.indices[kb_name] = BM25Index(kb_name)
        return self.indices[kb_name]

    def add_chunks(self, kb_name: str, chunks: List[Dict[str, Any]]):
        idx = self.get_or_create_index(kb_name)
        idx.add_chunks(chunks)
        self.save(kb_name)

    def search(self, kb_name: str, query: str, top_k: int = 20) -> List[Tuple[Dict[str, Any], float]]:
        if kb_name not in self.indices:
            return []
        return self.indices[kb_name].search(query, top_k=top_k)

    def save(self, kb_name: str):
        if kb_name not in self.indices:
            return
        idx = self.indices[kb_name]
        path = self._get_index_path(kb_name)
        data = {
            "kb_name": kb_name,
            "chunks": idx.chunks,
            "corpus_tokens": idx.corpus_tokens
        }
        with open(path, "wb") as f:
            pickle.dump(data, f)
        logger.debug(f"Saved BM25 index for '{kb_name}' to {path}")

    def delete_kb(self, kb_name: str):
        if kb_name in self.indices:
            del self.indices[kb_name]
        path = self._get_index_path(kb_name)
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                logger.error(f"Failed to remove BM25 file {path}: {e}")

    def get_all_chunks(self, kb_name: str) -> List[Dict[str, Any]]:
        if kb_name not in self.indices:
            return []
        return self.indices[kb_name].chunks


# 全局单例
bm25_store = BM25Store()
