import React, { useState } from 'react';
import { Search, Compass, Award, Loader2 } from 'lucide-react';
import type { SearchHit } from '../types';
import { api } from '../services/api';

interface PlaygroundProps {
  selectedKB: string;
}

export const Playground: React.FC<PlaygroundProps> = ({ selectedKB }) => {
  const [query, setQuery] = useState('');
  const [denseTopK, setDenseTopK] = useState(20);
  const [sparseTopK, setSparseTopK] = useState(20);
  const [rerankTopN, setRerankTopN] = useState(5);
  const [enableRerank, setEnableRerank] = useState(true);

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedKB) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.searchPlayground({
        kb_name: selectedKB,
        query: query.trim(),
        dense_top_k: denseTopK,
        sparse_top_k: sparseTopK,
        rerank_top_n: rerankTopN,
        enable_rerank: enableRerank,
      });
      setHits(res.hits || []);
    } catch (err: any) {
      setError(err.message || '检索失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] bg-paper overflow-y-auto p-6 space-y-6 select-none">
      {/* Playground Header & Query Bar */}
      <div className="max-w-4xl mx-auto w-full space-y-5">
        <div>
          <h2 className="text-base font-semibold text-ink-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-ink-900" />
            <span>底层多路检索实验台 (Retrieval Playground)</span>
          </h2>
          <p className="text-xs text-ink-500 mt-1">
            直接调试底层密集向量检索（NumPy）、稀疏关键词检索（BM25）、RRF 融合及 Cross-Encoder Rerank 得分表现。
          </p>
        </div>

        {/* Search Control Box */}
        <form onSubmit={handleSearch} className="p-5 rounded-2xl bg-surface border border-border space-y-4 shadow-card">
          <div className="flex gap-3">
            <input
              type="text"
              required
              disabled={!selectedKB}
              placeholder={selectedKB ? '输入测试查询 Query（如: 楚渊的个人终端代码）...' : '请在左侧先选择知识库...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-paper border border-border text-xs text-ink-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-stone-400 placeholder:text-ink-400"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading || !selectedKB}
              className="px-5 py-2.5 rounded-xl bg-ink-900 hover:bg-accent-hover disabled:opacity-40 font-semibold text-xs text-white flex items-center gap-2 shadow-card transition-all flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>开始检索</span>
            </button>
          </div>

          {/* Parameter Sliders & Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-border text-xs text-ink-700">
            <div>
              <label className="block text-ink-500 mb-1">
                Dense 向量召回 (Top-K): <span className="text-ink-900 font-mono font-semibold">{denseTopK}</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={denseTopK}
                onChange={(e) => setDenseTopK(Number(e.target.value))}
                className="w-full accent-stone-900"
              />
            </div>

            <div>
              <label className="block text-ink-500 mb-1">
                BM25 稀疏召回 (Top-K): <span className="text-ink-900 font-mono font-semibold">{sparseTopK}</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={sparseTopK}
                onChange={(e) => setSparseTopK(Number(e.target.value))}
                className="w-full accent-stone-900"
              />
            </div>

            <div>
              <label className="block text-ink-500 mb-1">
                Rerank 最终输出 (Top-N): <span className="text-ink-900 font-mono font-semibold">{rerankTopN}</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={rerankTopN}
                onChange={(e) => setRerankTopN(Number(e.target.value))}
                className="w-full accent-stone-900"
              />
            </div>

            <div className="flex items-center sm:justify-end gap-2 pt-2 sm:pt-0">
              <label className="flex items-center gap-2 cursor-pointer text-ink-700 font-medium">
                <input
                  type="checkbox"
                  checked={enableRerank}
                  onChange={(e) => setEnableRerank(e.target.checked)}
                  className="w-4 h-4 rounded text-ink-900 focus:ring-stone-400 bg-paper border-border"
                />
                <span>启用 Reranker 精排</span>
              </label>
            </div>
          </div>
        </form>

        {/* Error notice */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        {/* Results List */}
        <div className="space-y-3.5 pt-2">
          {hits.length > 0 && (
            <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider flex items-center justify-between">
              <span>检索命中结果 (共 {hits.length} 条)</span>
              <span>知识库: {selectedKB}</span>
            </div>
          )}

          {hits.map((hit) => (
            <div
              key={hit.chunk_id}
              className="p-5 rounded-xl bg-surface border border-border hover:border-stone-400 transition-all space-y-3 shadow-card"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-ink-900 text-white font-bold text-[10px] flex items-center justify-center font-mono">
                    #{hit.rank}
                  </span>
                  <span className="text-xs font-semibold text-ink-900">{hit.doc_name}</span>
                </div>

                <div className="flex items-center gap-2">
                  {hit.dense_rank && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-subtle border border-border text-ink-700 font-mono">
                      Dense: #{hit.dense_rank}
                    </span>
                  )}
                  {hit.sparse_rank && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-subtle border border-border text-ink-700 font-mono">
                      BM25: #{hit.sparse_rank}
                    </span>
                  )}
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-semibold flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    <span>Score: {hit.score}</span>
                  </span>
                </div>
              </div>

              {hit.header_path && (
                <div className="flex items-center gap-1.5 text-xs text-ink-700 font-mono bg-paper px-3 py-1.5 rounded-lg border border-border">
                  <Compass className="w-3.5 h-3.5 text-ink-500 flex-shrink-0" />
                  <span>{hit.header_path}</span>
                </div>
              )}

              <div className="p-3.5 rounded-lg bg-paper/60 border border-border text-xs text-ink-700 font-mono leading-relaxed whitespace-pre-wrap">
                {hit.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
