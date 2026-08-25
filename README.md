# 🚀 RAG-LQW: 轻量级企业级混合检索知识库问答系统

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue?logo=python&logoColor=white" alt="Python Version" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-18.3+-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-5.0+-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/ChromaDB-VectorStore-orange" alt="ChromaDB" />
  <img src="https://img.shields.io/badge/MCP-Protocol%20Ready-purple" alt="MCP Ready" />
</p>

> **RAG-LQW** 是一个基于 **FastAPI + React 18 + ChromaDB + BM25 + Cross-Encoder Reranker** 构建的高性能、极简架构 RAG 知识库问答系统，支持智能标题层级切片、多会话隔离管理、交互式引用溯源与原生 MCP Server 协议。

---

## 🌟 核心特色

1. **统一文档结构化解析**：支持 `.docx`、`.txt`、`.md` 毫秒级文本解析，自动提取 Word 标题层级和表格为标准 Markdown 结构。
2. **标题面包屑智能切片**：自适应段落 Token 预算切片，自动在每个分块前注入父级标题面包屑路径（如 `[上下文: 部署 > 环境要求]`），彻底消除上下文断裂。
3. **混合多路召回 + RRF 融合**：
   - **Dense 向量检索**：基于 ChromaDB 持久化向量库与余弦相似度检索；
   - **Sparse 稀疏检索**：基于 BM25Plus 算法与 Jieba 中文分词检索专有名词与精确匹配；
   - **RRF 融合**：自动融合双路排名，筛选出 Top-20 高价值候选。
4. **Cross-Encoder 语义精排 & 噪音过滤**：集成 BGE-Reranker API 对候选块深度打分，前置意图识别过滤闲聊，置信度及格线剔除无关噪音。
5. **多知识库独立多会话管理**：三栏式现代化 UI，知识库与会话独立隔离，支持新建、搜索、编辑重命名、删除及 `localStorage` 本地持久化。
6. **交互式引用溯源**：在回答中自动插入 `[1]`、`[2]` 可点击角标，右侧滑出抽屉一键定位原文切片。
7. **原生 MCP Server 协议支持**：符合 Model Context Protocol 标准，无缝作为 Tool 接入 Cursor、Claude Desktop、Antigravity 等智能体。

---

## 🚀 快速开始

### 1. 激活虚拟环境
本项目在根目录下内置了虚拟环境 `.venv`：
- **Windows (PowerShell)**:
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
- **Windows (CMD)**:
  ```cmd
  .\.venv\Scripts\activate.bat
  ```

*(若需在全新环境安装依赖，运行 `pip install -r requirements.txt`)*

### 2. 配置环境变量
复制 `.env.example` 并重命名为 `.env`，填入你的 API 密钥：
```bash
cp .env.example .env
```

配置示例（以 SiliconFlow 为例）：
```ini
# LLM API 配置 (兼容 OpenAI / DeepSeek / 通义千问 / SiliconFlow)
OPENAI_BASE_URL=https://api.siliconflow.cn/v1
OPENAI_API_KEY=sk-your-key
LLM_MODEL=deepseek-ai/DeepSeek-V3

# Embedding API 配置
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_API_KEY=sk-your-key
EMBEDDING_MODEL=BAAI/bge-m3

# Reranker API 配置 (可选，留空则自动降级为 RRF 得分排序)
RERANKER_BASE_URL=https://api.siliconflow.cn/v1/rerank
RERANKER_API_KEY=sk-your-key
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
```

### 3. 一键启动服务（推荐）

本项目提供了全栈一键启动脚本，会自动检测环境配置、启动 FastAPI 后端（端口 8000）与 Vite 前端（端口 5173）：

- **方式一（双击或批处理）**：双击根目录下 `start.bat` 或在终端运行 `.\start.bat`
- **方式二（PowerShell）**：`.\start.ps1`
- **方式三（Python）**：`python run.py`

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
  npm install
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

本项目原生提供符合 **MCP 标准规范** 的 stdio 服务（`mcp_server.py`），可零代码一键接入 **Cursor、Claude Desktop、Antigravity、VS Code、Cline** 等 AI 编程智能体。

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
    "rag-lqw": {
      "command": "python",
      "args": ["F:\\rag-project\\rag-gk\\mcp_server.py"]
    }
  }
}
```

#### 接入 Claude Desktop (`claude_desktop_config.json`)：
```json
{
  "mcpServers": {
    "rag-lqw": {
      "command": "python",
      "args": ["F:/rag-project/rag-gk/mcp_server.py"]
    }
  }
}
```

---

## 📄 开源许可证
MIT License.
