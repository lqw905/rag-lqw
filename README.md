# RAG-GK: 轻量级可信知识库问答系统

RAG-GK 是一个基于 **FastAPI + ChromaDB + BM25 + API模型** 构建的高性能、极简架构 RAG 知识库问答后端。

## 🌟 核心特色

1. **统一文档解析**：支持 `.docx`、`.txt`、`.md` 毫秒级文本解析，自动提取 Word 标题层级和表格为标准 Markdown 结构。
2. **结构化标题切片**：自适应段落 Token 预算切片，自动在每个分块前注入父级标题面包屑路径（如 `[上下文: 部署 > 环境要求]`），确保语义不丢失。
3. **混合多路召回 + RRF 融合**：
   - **Dense 向量检索**：基于 ChromaDB 持久化向量库与余弦相似度检索；
   - **Sparse 稀疏检索**：基于 BM25Plus 算法与 Jieba 中文分词检索专有名词与精确匹配；
   - **RRF 融合**：自动融合双路排名，筛选出 Top-20 高价值候选。
4. **Cross-Encoder 语义精排**：支持接入 SiliconFlow / BGE / Jina Rerank API，对候选块进行深度打分筛选出 Top-5。
5. **流式问答与精准引用溯源**：在回答中自动插入 `[1]`、`[2]` 角标，并流式输出详细的引用来源元数据（文档名、标题路径、相关度得分、原文片段）。

---

## 🚀 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 配置环境变量
复制 `.env.example` 并重命名为 `.env`，填入你的 API 密钥：
```bash
cp .env.example .env
```

配置示例：
```ini
# LLM API 配置 (兼容 OpenAI / DeepSeek / 通义千问 / SiliconFlow)
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_API_KEY=sk-your-key
LLM_MODEL=deepseek-chat

# Embedding API 配置
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_MODEL=text-embedding-3-small

# Reranker API 配置 (可选，留空则自动降级为 RRF 得分排序)
RERANKER_BASE_URL=https://api.siliconflow.cn/v1/rerank
RERANKER_API_KEY=sk-your-rerank-key
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
```

### 3. 启动后端服务
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
启动后访问接口文档：[http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 运行测试套件
```bash
python -X utf8 -m pytest tests/test_pipeline.py -v
```

---

## 📡 API 接口总览

- `GET  /health`：健康检查与当前模型配置信息
- `POST /api/v1/kb/create`：创建新知识库
- `GET  /api/v1/kb/list`：获取知识库列表与文档切片统计
- `POST /api/v1/kb/{kb_name}/upload`：上传并切片索引文件（`.docx`, `.txt`, `.md`）
- `GET  /api/v1/kb/{kb_name}/chunks`：获取切片列表与面包屑详情（用于前端切片可视化）
- `DELETE /api/v1/kb/{kb_name}`：删除知识库及其向量与稀疏索引
- `POST /api/v1/retrieval/search`：检索测试接口（直接返回各路召回与重排结果）
- `POST /api/v1/chat/completions`：RAG 智能对话问答（支持 SSE 流式传输 `stream=True`）
