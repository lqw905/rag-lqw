# Lightweight RAG 架构设计文档 (RAG-GK)

## 1. 项目愿景与设计哲学

本项目旨在构建一个**高性能、极简架构、生产可用**的自研轻量级 RAG（Retrieval-Augmented Generation）知识库问答系统。

### 核心设计原则：
1. **汲取精华，去繁就简**：借鉴 RAGFlow 的核心优势（Markdown 结构化解析、混合多路召回、精排重排、引用溯源），舍弃其臃肿复杂的重型基础设施（自建 OCR/版面分析模型服务、十多种多引擎适配层等）。
2. **纯 API 驱动与极速文本流水线**：
   - 聚焦支持 `.docx`, `.txt`, `.md` 格式，纯 CPU 毫秒级解析；
   - LLM、Embedding、Reranker 全部通过通用 API（OpenAI 兼容协议）接入，实现计算与存储解耦。
3. **单节点持久化存储**：
   - 向量检索选用 **ChromaDB**（嵌入式持久化存储）；
   - 稀疏关键词检索选用 **BM25**（基于内存与磁盘轻量序列化持久化）。

---

## 2. 总体系统架构图

```
                          ┌────────────────────────┐
                          │ 用户 / API 客户端 (HTTP) │
                          └───────────┬────────────┘
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │        FastAPI 应用服务层            │
                   │  (Knowledge Base & Chat Controller)  │
                   └──────────────────┬───────────────────┘
                                      │
        ┌─────────────────────────────┴─────────────────────────────┐
        │                                                           │
        ▼ 【文档摄入链路 (Ingestion Pipeline)】                    ▼ 【检索与生成链路 (RAG Pipeline)】
┌───────────────────────────────┐                  ┌───────────────────────────────────────┐
│ 1. 统一解析器 (DocumentLoader) │                  │ 1. 查询预处理 (Query Parser)          │
│    - .docx ──► Markdown       │                  └──────────────────┬────────────────────┘
│    - .txt  ──► Markdown       │                                     │
│    - .md   ──► Markdown       │                  ┌──────────────────┴────────────────────┐
└───────────────┬───────────────┘                  │                                       │
                │                                  ▼                                       ▼
                ▼                          ┌────────────────┐                     ┌─────────────────┐
┌───────────────────────────────┐          │ Dense 向量检索 │                     │ Sparse 关键词检索│
│ 2. 标题层级切片器              │          │ (Embedding API │                     │ (BM25 Indexer)  │
│    (MarkdownHeaderSplitter)   │          │  + ChromaDB)   │                     └────────┬────────┘
│    - 面包屑标题注入           │          └───────┬────────┘                              │
│    - Token 预算自适应合并     │                  │                                       │
└───────────────┬───────────────┘                  └───────────────────┬───────────────────┘
                │                                                      │
                │                                                      ▼
                │                                      ┌─────────────────────────────────┐
                │                                      │ 2. 混合多路融合 (RRF / Weighted) │
                │                                      │    提取 Top-20 候选 Chunk       │
                │                                      └───────────────┬─────────────────┘
                │                                                      │
                │                                                      ▼
                │                                      ┌─────────────────────────────────┐
                │                                      │ 3. 语义精排 (Reranker API)      │
                │                                      │    评分筛选出 Top-5 强相关块    │
                │                                      └───────────────┬─────────────────┘
                │                                                      │
                ▼                                                      ▼
┌───────────────────────────────┐                      ┌─────────────────────────────────┐
│ 3. 向量化与索引构建           │                      │ 4. 组装 Prompt & Token 预算控制 │
│    - Embedding API            │                      │    - [文档X] 引用锚点注入       │
│    - 写入 Chroma 向量库       │                      │    - 历史多轮对话上下文拟合     │
│    - 写入本地 BM25 索引库     │                      └───────────────┬─────────────────┘
└───────────────────────────────┘                                      │
                                                                       ▼
                                                       ┌─────────────────────────────────┐
                                                       │ 5. LLM 生成与流式输出 (Stream)  │
                                                       │    - 智能引用标注与可信度验证   │
                                                       └─────────────────────────────────┘
```

---

## 3. 技术栈选型

| 层次 | 选型组件 | 选型理由 |
| :--- | :--- | :--- |
| **编程语言** | Python 3.10+ | 生态完备，类型标注规范 |
| **API 服务框架** | FastAPI + Uvicorn + Pydantic v2 | 异步高性能，自动生成 OpenAPI 文档，极简数据验证 |
| **文档解析库** | `python-docx` + 标准字符编码自动探测 | 纯 Python，毫秒级将 Word/文本转为统一 Markdown 结构 |
| **分块与分词** | 自研 `MarkdownHeaderSplitter` + `tiktoken` | 精确控制 Token 预算，保留父子标题上下文，避免语义碎片化 |
| **向量数据库** | **ChromaDB** | 零运维依赖、轻量嵌入式（支持本地目录持久化），查询速度快 |
| **稀疏检索** | **rank_bm25** + 中文分词（Jieba） | 补充专有名词、精确编码、数字查找的短板，与向量互补 |
| **Embedding API** | OpenAI 兼容接口 | 支持 OpenAI `text-embedding-3`, 通义千问, 智谱, SiliconFlow 等 |
| **Rerank API** | Cross-Encoder Reranker API | 接入 SiliconFlow / BGE / Jina Rerank API，极大提升 Top-5 准确率 |
| **LLM 接口** | OpenAI 兼容流式接口 | 支持 DeepSeek (V3/R1)、Qwen-Max、GPT-4o 等主流大模型 |

---

## 4. 核心技术方案细节

### 4.1 文档解析与统一中间格式 (Markdown as IR)
无论输入是 `.docx`, `.txt` 还是 `.md`，第一道工序全部转换为标准的 Markdown 格式：
1. **`.docx` 解析**：
   - 提取段落样式（`Heading 1/2/3`）映射为 `#`, `##`, `###`；
   - 提取表格对象（`Table`）映射为标准 Markdown 表格；
   - 提取普通文本段落。
2. **`.txt` 解析**：
   - 自动探测文件编码（UTF-8, GBK, GB2312, UTF-16）；
   - 按双换行识别自然段落。
3. **`.md` 解析**：
   - 保留原生 Markdown 语法。

### 4.2 结构化切片策略 (Header Breadcrumb + Token Merge)
- **标题面包屑注入**：每个分块（Chunk）的头部自动拼接该块所属的完整标题路径（例如 `[上下文: 系统架构 > 存储层 > 向量库选型]`），确保块在向量化和检索时具备完整的语义背景。
- **Token 预算合并**：以自然段落为基本单位，依据 `chunk_size`（推荐 500~800 Tokens）和 `chunk_overlap`（推荐 10%~15%）进行自适应合并，避免在句子中间硬截断。

### 4.3 检索机制：双路召回 + RRF 融合 + Cross-Encoder 重排
1. **Dense 检索**：Query 通过 Embedding API 编码后在 ChromaDB 中检索余弦距离最近的 Top-$K_1$（如 20 个）。
2. **Sparse 检索**：Query 分词后在当前知识库的 BM25 倒排索引中检索得分最高的 Top-$K_2$（如 20 个）。
3. **混合融合（Reciprocal Rank Fusion, RRF）**：
   $$RRF\_Score(d) = \frac{1}{60 + \text{Rank}_{dense}(d)} + \frac{1}{60 + \text{Rank}_{sparse}(d)}$$
   根据综合排名去重后取 Top-20 候选集。
4. **Reranker 精排**：
   将 `(Query, Chunk)` 候选对输入到 Cross-Encoder Reranker API，获取深度语义打分，最终截取 Top-N（如 Top 3~5）提供给大模型。

### 4.4 生成与引用机制 (Prompt-based In-Context Citations)
- **上下文拼接规范**：
  ```markdown
  参考资料：
  [文档1] (标题: 部署指南 > 环境依赖)
  系统运行需要 Python 3.10 以上环境...

  [文档2] (标题: 架构设计 > 向量存储)
  ChromaDB 用于存储文档向量...
  ```
- **生成约束**：在 System Prompt 中要求 LLM：
  1. 严格基于参考资料回答；
  2. 凡涉及参考资料中的事实陈述、参数、结论，必须在句末标注引用角标 `[1]` 或 `[2]`；
  3. 若参考资料不足以回答，明确声明未知，杜绝幻觉。

---

## 5. 项目工程结构规划

```
rag-gk/
├── .gitignore               # Git 忽略配置（已忽略 docs/, chroma_db/, .env 等）
├── requirements.txt         # 核心 Python 依赖
├── README.md                # 项目简介与启动指南
├── config.py                # 全局配置管理（Pydantic BaseSettings + .env）
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 启动入口与路由注册
│   ├── api/
│   │   ├── __init__.py
│   │   ├── kb_router.py     # 知识库管理接口（创建/上传/列出/删除）
│   │   └── chat_router.py   # 对话问答接口（单轮/多轮/流式输出）
│   ├── core/
│   │   ├── __init__.py
│   │   ├── loader.py        # 统一文档加载器 (.docx, .txt, .md -> Markdown)
│   │   ├── splitter.py      # Markdown 标题面包屑自适应分块器
│   │   ├── bm25.py          # BM25 稀疏检索索引构建与持久化
│   │   ├── vector_store.py  # ChromaDB 向量库封装与管理
│   │   ├── retriever.py     # 混合多路召回 + RRF 融合
│   │   ├── reranker.py      # Rerank API 封装与重排过滤
│   │   └── generator.py     # Prompt 组装与 LLM 对话生成（流式生成）
│   └── models/
│       ├── __init__.py
│       └── schemas.py       # 请求与响应 Pydantic 模型
└── docs/                    # [已 Git 忽略] 设计文档与开发笔记
    └── DESIGN.md            # 系统架构设计文档
```

---

## 6. RESTful API 接口定义预览

### 知识库管理 API
- `POST /api/v1/kb/create`：创建新知识库（指定 Embedding 模型与距离度量）
- `POST /api/v1/kb/{kb_name}/upload`：上传并解析文档（支持单文件/多文件，返回 Chunk 数量）
- `GET  /api/v1/kb/list`：查询所有知识库及文档列表
- `DELETE /api/v1/kb/{kb_name}`：删除知识库与索引数据

### 问答与检索 API
- `POST /api/v1/chat/completions`：RAG 智能对话问答（支持 `stream=True` 流式响应，输出回答正文与引用来源明细）
- `POST /api/v1/retrieval/search`：仅检索测试接口（便于调试向量与 BM25 召回效果及 Reranker 得分）
