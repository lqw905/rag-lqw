import re
import uuid
from typing import List, Dict, Any, Optional
from loguru import logger

try:
    import tiktoken
    _ENCODER = tiktoken.get_encoding("cl100k_base")
except Exception:
    _ENCODER = None


def count_tokens(text: str) -> int:
    """计算文本 Token 数"""
    if _ENCODER:
        try:
            return len(_ENCODER.encode(text))
        except Exception:
            pass
    # 启发式估算: 中文约 1.5 token/字，英文约 0.75 token/词
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    other_chars = len(text) - chinese_chars
    return int(chinese_chars * 1.5 + other_chars * 0.3)


class Chunk:
    """分块数据结构"""
    def __init__(
        self,
        chunk_id: str,
        content: str,
        raw_content: str,
        header_path: str,
        token_count: int,
        chunk_index: int,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.chunk_id = chunk_id
        self.content = content  # 包含 [上下文: 标题面包屑] 的完整文本（用于检索和生成）
        self.raw_content = raw_content  # 原始段落文本
        self.header_path = header_path
        self.token_count = token_count
        self.chunk_index = chunk_index
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "content": self.content,
            "raw_content": self.raw_content,
            "header_path": self.header_path,
            "token_count": self.token_count,
            "chunk_index": self.chunk_index,
            "metadata": self.metadata
        }


class MarkdownHeaderSplitter:
    """
    标题感知递归切片器：
    1. 识别 Markdown 的 #, ##, ###, #### 标题层级；
    2. 维护标题栈（Breadcrumbs 面包屑）；
    3. 按段落划分，根据 chunk_size 和 chunk_overlap 自适应合并；
    4. 自动将标题路径注入为 Chunk 前缀（[上下文: 主标题 > 子标题]）。
    """

    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 80):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, markdown_text: str, doc_metadata: Optional[Dict[str, Any]] = None) -> List[Chunk]:
        if not markdown_text or not markdown_text.strip():
            return []

        doc_metadata = doc_metadata or {}
        lines = markdown_text.splitlines()

        # 第一步：根据标题切分为逻辑段落组
        # 结构: [ {"headers": ["Title 1", "Sub 2"], "text_blocks": ["paragraph 1", "paragraph 2"]} ]
        sections = []
        current_headers: Dict[int, str] = {}  # level -> title
        current_paragraphs: List[str] = []

        def get_current_breadcrumb() -> str:
            levels = sorted(current_headers.keys())
            return " > ".join([current_headers[lvl] for lvl in levels if current_headers[lvl]])

        for line in lines:
            header_match = re.match(r'^(#{1,6})\s+(.*)$', line.strip())
            if header_match:
                # 遇到新标题，先沉淀前面的段落
                if current_paragraphs:
                    text_joined = "\n\n".join(current_paragraphs).strip()
                    if text_joined:
                        sections.append({
                            "breadcrumb": get_current_breadcrumb(),
                            "text": text_joined
                        })
                    current_paragraphs = []

                level = len(header_match.group(1))
                title = header_match.group(2).strip()

                # 清理比当前 level 更深或相等的旧标题
                for lvl in list(current_headers.keys()):
                    if lvl >= level:
                        del current_headers[lvl]
                current_headers[level] = title
            else:
                if line.strip():
                    current_paragraphs.append(line.strip())

        # 收集末尾段落
        if current_paragraphs:
            text_joined = "\n\n".join(current_paragraphs).strip()
            if text_joined:
                sections.append({
                    "breadcrumb": get_current_breadcrumb(),
                    "text": text_joined
                })

        # 第二步：对每一个 section 内部，按自然段落与 Token 预算进行合并与 Overlap 处理
        chunks: List[Chunk] = []
        chunk_idx = 0

        for sec in sections:
            breadcrumb = sec["breadcrumb"]
            raw_text = sec["text"]
            
            # 按双换行拆分成自然小段
            paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
            if not paragraphs:
                continue

            current_chunk_paras = []
            current_tokens = 0

            for p in paragraphs:
                p_tokens = count_tokens(p)

                # 如果单个段落本身就超过了 chunk_size，需要强行按句或定长切开
                if p_tokens > self.chunk_size:
                    # 先把前面积攒的 chunk 存下来
                    if current_chunk_paras:
                        chunk_text = "\n\n".join(current_chunk_paras)
                        chunks.append(self._create_chunk(chunk_text, breadcrumb, chunk_idx, doc_metadata))
                        chunk_idx += 1
                        current_chunk_paras = []
                        current_tokens = 0

                    # 拆分大段落
                    sub_chunks = self._split_large_paragraph(p, breadcrumb, chunk_idx, doc_metadata)
                    for sc in sub_chunks:
                        chunks.append(sc)
                        chunk_idx += 1
                    continue

                if current_tokens + p_tokens <= self.chunk_size:
                    current_chunk_paras.append(p)
                    current_tokens += p_tokens
                else:
                    # 达到预算上限，封包
                    chunk_text = "\n\n".join(current_chunk_paras)
                    chunks.append(self._create_chunk(chunk_text, breadcrumb, chunk_idx, doc_metadata))
                    chunk_idx += 1

                    # 保留 overlap（取最后一个段落作为下一个 chunk 的开头，若合适）
                    if self.chunk_overlap > 0 and len(current_chunk_paras) > 1 and count_tokens(current_chunk_paras[-1]) < self.chunk_overlap:
                        current_chunk_paras = [current_chunk_paras[-1], p]
                        current_tokens = count_tokens(current_chunk_paras[0]) + p_tokens
                    else:
                        current_chunk_paras = [p]
                        current_tokens = p_tokens

            if current_chunk_paras:
                chunk_text = "\n\n".join(current_chunk_paras)
                chunks.append(self._create_chunk(chunk_text, breadcrumb, chunk_idx, doc_metadata))
                chunk_idx += 1

        return chunks

    def _create_chunk(self, raw_content: str, breadcrumb: str, index: int, doc_metadata: Dict[str, Any]) -> Chunk:
        cid = str(uuid.uuid4())
        # 注入标题路径面包屑作为前缀
        if breadcrumb:
            enriched_content = f"[上下文: {breadcrumb}]\n{raw_content}"
        else:
            enriched_content = raw_content

        tok_cnt = count_tokens(enriched_content)
        meta = dict(doc_metadata)
        meta["breadcrumb"] = breadcrumb
        meta["chunk_index"] = index

        return Chunk(
            chunk_id=cid,
            content=enriched_content,
            raw_content=raw_content,
            header_path=breadcrumb,
            token_count=tok_cnt,
            chunk_index=index,
            metadata=meta
        )

    def _split_large_paragraph(self, long_text: str, breadcrumb: str, start_index: int, doc_metadata: Dict[str, Any]) -> List[Chunk]:
        """将超长段落按标点符号切分"""
        sentences = re.split(r'([。？！\n\.\?!])', long_text)
        merged_sentences = []
        for i in range(0, len(sentences) - 1, 2):
            merged_sentences.append(sentences[i] + sentences[i + 1])
        if len(sentences) % 2 == 1 and sentences[-1]:
            merged_sentences.append(sentences[-1])

        sub_chunks = []
        cur_text = ""
        cur_idx = start_index

        for s in merged_sentences:
            if not s.strip():
                continue
            if count_tokens(cur_text + s) <= self.chunk_size:
                cur_text += s
            else:
                if cur_text:
                    sub_chunks.append(self._create_chunk(cur_text.strip(), breadcrumb, cur_idx, doc_metadata))
                    cur_idx += 1
                cur_text = s

        if cur_text.strip():
            sub_chunks.append(self._create_chunk(cur_text.strip(), breadcrumb, cur_idx, doc_metadata))

        return sub_chunks
