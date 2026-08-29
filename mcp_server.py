#!/usr/bin/env python
"""
RAG-GK Model Context Protocol (MCP) Server
标准 stdio JSON-RPC 2.0 实现，兼容 2024-11-05 规范。
可无缝接入 Cursor, Claude Desktop, Antigravity, VS Code, Cline 等支持 MCP 的 AI Agent。
"""

import sys
import json
import os
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

# 将项目根目录加入 sys.path
ROOT_DIR = Path(__file__).parent.resolve()
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# 配置 loguru 日志仅输出到文件，严禁输出到 stdout（避免破坏 JSON-RPC 协议）
from loguru import logger
logger.remove()
log_path = ROOT_DIR / "data" / "mcp_server.log"
os.makedirs(log_path.parent, exist_ok=True)
logger.add(str(log_path), rotation="10 MB", level="INFO", encoding="utf-8")

from app.config import settings
from app.core.vector_store import vector_store
from app.core.bm25 import bm25_store
from app.core.retriever import retriever
from app.core.reranker import reranker_client
from app.core.generator import generator
from app.core.loader import DocumentLoader
from app.core.splitter import MarkdownHeaderSplitter


TOOLS = [
    {
        "name": "list_knowledge_bases",
        "description": "获取当前 RAG-GK 知识库系统中所有可用的知识库列表及已索引切片数量。",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "search_knowledge_base",
        "description": "在指定的项目/企业知识库中进行混合多路召回（NumPy 向量 + BM25 关键词 + BGE 语义精排），返回最相关的上下文切片、标题面包屑、来源文档和相关度得分。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "要检索的代码符号、技术概念、错误代码、业务规则或自然语言问题"
                },
                "kb_name": {
                    "type": "string",
                    "description": "目标知识库名称。若只有一个知识库可省略"
                },
                "top_k": {
                    "type": "integer",
                    "description": "返回最相关切片的数量（默认 5 条）",
                    "default": 5
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "ask_knowledge_base",
        "description": "基于知识库内容执行端到端 RAG 智能问答，自动检索最相关的背景文档并通过大模型进行综合分析解答，附带详细的引用参考来源。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "用户的问题或需求指令"
                },
                "kb_name": {
                    "type": "string",
                    "description": "目标知识库名称。若只有一个知识库可省略"
                }
            },
            "required": ["question"]
        }
    },
    {
        "name": "ingest_document",
        "description": "向知识库中导入并索引本地文件（支持 .docx, .txt, .md），自动提取标题面包屑与表格并构建双路向量/稀疏索引。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "要导入的本地文件绝对路径（如 'F:/docs/manual.docx'）"
                },
                "kb_name": {
                    "type": "string",
                    "description": "目标知识库名称"
                }
            },
            "required": ["file_path", "kb_name"]
        }
    }
]


def resolve_kb_name(kb_name: Optional[str]) -> str:
    kbs = vector_store.list_knowledge_bases()
    if kb_name and kb_name in kbs:
        return kb_name
    if kb_name:
        return kb_name
    if len(kbs) == 1:
        return kbs[0]
    if len(kbs) > 1:
        return kbs[0]
    raise ValueError("当前系统中尚无任何知识库，请先通过 `ingest_document` 创建或导入知识库。")


def handle_list_knowledge_bases(args: Dict[str, Any]) -> str:
    kbs = vector_store.list_knowledge_bases()
    if not kbs:
        return "当前系统中暂无知识库。你可以通过 `ingest_document` 导入文件创建知识库。"
    
    lines = ["### 📚 当前可用知识库列表：\n"]
    for name in kbs:
        cnt = vector_store.get_chunk_count(name)
        lines.append(f"- **{name}**: {cnt} 个已索引分块")
    return "\n".join(lines)


def handle_search_knowledge_base(args: Dict[str, Any]) -> str:
    query = args.get("query", "").strip()
    if not query:
        return "检索 query 不能为空。"

    kb_name = resolve_kb_name(args.get("kb_name"))
    top_k = int(args.get("top_k", 5))

    # 执行混合召回与精排
    results = retriever.retrieve(
        kb_name=kb_name,
        query=query,
        dense_top_k=20,
        sparse_top_k=20,
        rerank_top_n=top_k,
        enable_rerank=True
    )

    if not results:
        return f"在知识库 `{kb_name}` 中未检索到与 `{query}` 相关的内容。"

    lines = [f"### 🔍 知识库 `{kb_name}` 检索结果（共找到 {len(results)} 条最相关切片）：\n"]
    for item in results:
        rank = item.get("rank", 1)
        score = item.get("score", 0.0)
        doc_name = item.get("doc_name") or "未知文档"
        header = item.get("header_path") or "正文"
        content = item.get("content", "")

        lines.append(f"#### 📄 [切片 {rank}] 相关度得分: {score:.4f}")
        lines.append(f"- **来源文档**: `{doc_name}`")
        lines.append(f"- **标题路径**: `{header}`")
        lines.append("```markdown")
        lines.append(content.strip())
        lines.append("```\n")

    return "\n".join(lines)


def handle_ask_knowledge_base(args: Dict[str, Any]) -> str:
    question = args.get("question", "").strip()
    if not question:
        return "问题内容不能为空。"

    kb_name = resolve_kb_name(args.get("kb_name"))

    # 1. 混合检索
    results = retriever.retrieve(
        kb_name=kb_name,
        query=question,
        dense_top_k=20,
        sparse_top_k=20,
        rerank_top_n=settings.RERANK_TOP_N,
        enable_rerank=True
    )

    if not results:
        return f"在知识库 `{kb_name}` 中未找到相关参考文档，无法基于知识库回答该问题。"

    # 2. 调用 LLM 生成解答
    chunks_for_gen = [
        {
            "chunk_id": r.get("chunk_id", ""),
            "content": r.get("content", ""),
            "header_path": r.get("header_path", ""),
            "doc_name": r.get("doc_name", ""),
            "score": r.get("score", 0.0),
            "raw_content": r.get("content", "")
        }
        for r in results
    ]

    gen_res = generator.generate_sync(query=question, retrieved_chunks=chunks_for_gen)
    answer_text = gen_res.get("answer", "")
    references = gen_res.get("references", [])

    # 3. 组装输出
    lines = [f"### 🤖 知识库问答解答（参考 `{kb_name}`）：\n"]
    lines.append(answer_text.strip())
    if references:
        lines.append("\n\n---\n#### 📌 引用参考来源：")
        for ref in references:
            idx = ref.get("ref_id", "")
            doc = ref.get("doc_name", "")
            hdr = ref.get("header_path", "")
            scr = ref.get("score", 0.0)
            lines.append(f"- **[{idx}]** `{doc}` > `{hdr}` (相关度: {scr:.3f})")

    return "\n".join(lines)


def handle_ingest_document(args: Dict[str, Any]) -> str:
    file_path = args.get("file_path", "").strip()
    kb_name = args.get("kb_name", "").strip()

    if not file_path or not os.path.exists(file_path):
        return f"错误：文件路径不存在 `{file_path}`"
    if not kb_name:
        return "错误：目标知识库名称不能为空"

    # 1. 解析文件
    content, doc_meta = DocumentLoader.load(file_path)
    doc_meta["kb_name"] = kb_name

    # 2. 切片
    splitter = MarkdownHeaderSplitter(chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)
    chunks = splitter.split_text(content, doc_metadata=doc_meta)

    if not chunks:
        return f"文件 `{os.path.basename(file_path)}` 已解析，但未生成任何有效切片。"

    chunk_dicts = [c.to_dict() for c in chunks]

    # 3. 写入双路索引
    vector_store.add_chunks(kb_name, chunk_dicts)
    bm25_store.add_chunks(kb_name, chunk_dicts)

    return f"✅ 成功将 `{os.path.basename(file_path)}` 导入知识库 `{kb_name}`！共生成并索引了 {len(chunks)} 个结构化切片。"


TOOL_HANDLERS = {
    "list_knowledge_bases": handle_list_knowledge_bases,
    "search_knowledge_base": handle_search_knowledge_base,
    "ask_knowledge_base": handle_ask_knowledge_base,
    "ingest_document": handle_ingest_document,
}


def process_request(request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    req_id = request.get("id")
    method = request.get("method")
    params = request.get("params", {})

    # 1. 初始化握手
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "rag-gk-mcp",
                    "version": "1.0.0"
                }
            }
        }

    # 2. 握手确认通知
    if method == "notifications/initialized":
        return None

    # 3. ping 保活
    if method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {}
        }

    # 4. 列出可用工具
    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS
            }
        }

    # 5. 调用工具
    if method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        handler = TOOL_HANDLERS.get(tool_name)
        if not handler:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": f"未知工具: {tool_name}"}],
                    "isError": True
                }
            }

        try:
            result_text = handler(arguments)
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": result_text}],
                    "isError": False
                }
            }
        except Exception as e:
            err_msg = f"执行工具 '{tool_name}' 出错: {str(e)}\n{traceback.format_exc()}"
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": err_msg}],
                    "isError": True
                }
            }

    # 其他未实现的方法
    if req_id is not None:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }
    return None


def main():
    # 强制将 stdin/stdout 设置为 utf-8 文本流
    if sys.platform == "win32":
        import io
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            resp = process_request(req)
            if resp is not None:
                sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
                sys.stdout.flush()
        except Exception as e:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": f"Parse error: {str(e)}"
                }
            }
            sys.stdout.write(json.dumps(err_resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
