import type { KnowledgeBase, ChunkDetail, ReferenceItem, SearchResponse, HealthInfo } from '../types';

export const api = {
  // 1. 系统健康检查
  async getHealth(): Promise<HealthInfo> {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  // 2. 知识库列表
  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    const res = await fetch('/api/v1/kb/list');
    if (!res.ok) throw new Error('Failed to list knowledge bases');
    const data = await res.json();
    return data.knowledge_bases;
  },

  // 3. 创建知识库
  async createKnowledgeBase(kb_name: string, description?: string): Promise<KnowledgeBase> {
    const res = await fetch('/api/v1/kb/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kb_name, description }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Create KB failed' }));
      throw new Error(err.detail || '创建知识库失败');
    }
    return res.json();
  },

  // 4. 删除知识库
  async deleteKnowledgeBase(kb_name: string): Promise<void> {
    const res = await fetch(`/api/v1/kb/${encodeURIComponent(kb_name)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('删除知识库失败');
  },

  // 5. 上传并切片文档
  async uploadDocuments(
    kb_name: string,
    files: File[],
    chunkSize: number = 600,
    chunkOverlap: number = 80
  ) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('chunk_size', String(chunkSize));
    formData.append('chunk_overlap', String(chunkOverlap));

    const res = await fetch(`/api/v1/kb/${encodeURIComponent(kb_name)}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || '文档上传与索引失败');
    }
    return res.json();
  },

  // 6. 获取切片列表
  async listChunks(kb_name: string, limit: number = 100, offset: number = 0): Promise<{ total: number; chunks: ChunkDetail[] }> {
    const res = await fetch(`/api/v1/kb/${encodeURIComponent(kb_name)}/chunks?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error('获取切片列表失败');
    return res.json();
  },

  // 7. 检索测试台 (Playground)
  async searchPlayground(params: {
    kb_name: string;
    query: string;
    dense_top_k?: number;
    sparse_top_k?: number;
    rerank_top_n?: number;
    enable_rerank?: boolean;
  }): Promise<SearchResponse> {
    const res = await fetch('/api/v1/retrieval/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Search failed' }));
      throw new Error(err.detail || '检索查询失败');
    }
    return res.json();
  },

  // 8. SSE 流式对话问答
  async streamChat(params: {
    kb_name: string;
    query: string;
    history: { role: string; content: string }[];
    top_n?: number;
    enable_rerank?: boolean;
    onReferences: (references: ReferenceItem[]) => void;
    onDelta: (delta: string) => void;
    onDone: (totalTokens?: number) => void;
    onError: (err: string) => void;
    signal?: AbortSignal;
  }) {
    let settled = false;
    const finish = (totalTokens?: number) => {
      if (settled) return;
      settled = true;
      params.onDone(totalTokens);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      params.onError(message);
    };

    try {
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kb_name: params.kb_name,
          query: params.query,
          history: params.history,
          stream: true,
          top_n: params.top_n ?? 5,
          enable_rerank: params.enable_rerank ?? true,
        }),
        signal: params.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Chat request failed' }));
        fail(err.detail || '对话请求失败');
        return;
      }

      if (!response.body) {
        fail('ReadableStream not supported by browser');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'references') {
              params.onReferences(event.references || []);
            } else if (event.type === 'content' || event.type === 'delta') {
              params.onDelta(event.delta || event.content || '');
            } else if (event.type === 'done') {
              finish(event.total_tokens);
            } else if (event.type === 'error') {
              fail(event.message || event.error || 'LLM 生成错误');
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', jsonStr, e);
          }
        }
      }

      finish();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        finish();
      } else {
        fail(e.message || '网络连接异常');
      }
    }
  },
};
