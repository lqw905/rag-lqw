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

### 1. 激活虚拟环境
本项目已在根目录下创建了专属虚拟环境 `.venv`：
- **Windows (PowerShell)**:
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
- **Windows (CMD)**:
  ```cmd
  .\.venv\Scripts\activate.bat
  ```

*(若需重新安装依赖，运行 `.\.venv\Scripts\pip install -r requirements.txt`)*

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

### 3. 一键启动服务（推荐）

本项目提供了全栈一键启动脚本，会自动检测环境配置、启动 FastAPI 后端（端口 8000）与 Vite 前端（端口 5173）：

- **方式一（双击或批处理）**：双击根目录下 `start.bat` 或在终端运行 `.\start.bat`
- **方式二（PowerShell）**：`.\start.ps1`
- **方式三（Python）**：`.\.venv\Scripts\python run.py`

启动后在浏览器打开：
- 🌐 前端交互界面：[http://localhost:5173](http://localhost:5173)
- 📡 后端接口与文档：[http://localhost:8000/docs](http://localhost:8000/docs)

*(按 `Ctrl + C` 可一键安全退出所有前后端进程)*

---

### 4. 手动分步启动（可选）

- **启动后端**：
  ```bash
  .\.venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```
- **启动前端**：
  ```bash
  cd web
  npm run dev
  ```

---

## 🧪 运行测试套件
```bash
.\.venv\Scripts\python -X utf8 -m pytest tests/test_pipeline.py -v
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

---

## 🔌 MCP (Model Context Protocol) 智能体接入

本项目原生提供符合 **MCP 标准规范** 的 stdio 服务（[mcp_server.py](file:///f:/rag-project/rag-gk/mcp_server.py)），可零代码一键接入 **Cursor、Claude Desktop、Antigravity、VS Code、Cline** 等 AI 编程智能体。

### 1. 提供的 MCP 工具列表

- 🔍 `search_knowledge_base`：在知识库中进行混合多路召回与 BGE 语义精排，返回带面包屑和相关度得分的上下文。
- 🤖 `ask_knowledge_base`：直接针对知识库进行端到端智能问答与引用溯源。
- 📚 `list_knowledge_bases`：查看当前系统中所有可用知识库与切片数量。
- 📥 `ingest_document`：从本地路径直接导入并索引 `.docx`、`.txt`、`.md` 文档。

### 2. 客户端配置示例

#### 接入 Cursor (`.cursor/mcp.json` 或设置中的 MCP)：
```json
{
  "mcpServers": {
    "rag-gk": {
      "command": "f:\\rag-project\\rag-gk\\.venv\\Scripts\\python.exe",
      "args": ["f:\\rag-project\\rag-gk\\mcp_server.py"]
    }
  }
}
```

#### 接入 Claude Desktop (`claude_desktop_config.json`)：
```json
{
  "mcpServers": {
    "rag-gk": {
      "command": "f:/rag-project/rag-gk/.venv/Scripts/python.exe",
      "args": ["f:/rag-project/rag-gk/mcp_server.py"]
    }
  }
}
```
