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
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Playground Header & Query Bar */}
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-brand-400" />
            <span>检索实验台 (Retrieval Playground)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            直接调试底层密集向量检索（Chroma）、稀疏关键词检索（BM25）、RRF 融合及 Cross-Encoder Rerank 得分表现。
          </p>
        </div>

        {/* Search Control Box */}
        <form onSubmit={handleSearch} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex gap-3">
            <input
              type="text"
              required
              disabled={!selectedKB}
              placeholder={selectedKB ? '输入测试查询 Query（如: 存储层架构设计）...' : '请在左侧先选择知识库...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 text-sm text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading || !selectedKB}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 font-medium text-sm text-white flex items-center gap-2 shadow-lg shadow-brand-600/30 transition-all flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>开始检索</span>
            </button>
          </div>

          {/* Parameter Sliders & Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-800/80 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">
                Dense 向量召回 (Top-K): <span className="text-brand-400 font-mono">{denseTopK}</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={denseTopK}
                onChange={(e) => setDenseTopK(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                BM25 稀疏召回 (Top-K): <span className="text-brand-400 font-mono">{sparseTopK}</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={sparseTopK}
                onChange={(e) => setSparseTopK(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                Rerank 最终输出 (Top-N): <span className="text-brand-400 font-mono">{rerankTopN}</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={rerankTopN}
                onChange={(e) => setRerankTopN(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>

            <div className="flex items-center sm:justify-end gap-2 pt-2 sm:pt-0">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={enableRerank}
                  onChange={(e) => setEnableRerank(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 bg-slate-950 border-slate-800"
                />
                <span>启用 Reranker 精排</span>
              </label>
            </div>
          </div>
        </form>

        {/* Error notice */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Results List */}
        <div className="space-y-4 pt-2">
          {hits.length > 0 && (
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>检索命中结果 (共 {hits.length} 条)</span>
              <span>知识库: {selectedKB}</span>
            </div>
          )}

          {hits.map((hit) => (
            <div
              key={hit.chunk_id}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-all space-y-3 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-300 font-bold text-xs flex items-center justify-center font-mono">
                    #{hit.rank}
                  </span>
                  <span className="text-sm font-semibold text-slate-200">{hit.doc_name}</span>
                </div>

                <div className="flex items-center gap-2">
                  {hit.dense_rank && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono">
                      Dense Rank: #{hit.dense_rank}
                    </span>
                  )}
                  {hit.sparse_rank && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                      BM25 Rank: #{hit.sparse_rank}
                    </span>
                  )}
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 font-mono font-medium flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    <span>Score: {hit.score}</span>
                  </span>
                </div>
              </div>

              {hit.header_path && (
                <div className="flex items-center gap-1.5 text-xs text-brand-300 font-mono bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <Compass className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                  <span>{hit.header_path}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                {hit.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
