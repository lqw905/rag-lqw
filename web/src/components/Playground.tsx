import React, { useState, useEffect } from 'react';
import { Search, Compass, Award, Loader2, SlidersHorizontal, X } from 'lucide-react';
import type { SearchHit } from '../types';
import { api } from '../services/api';

interface PlaygroundProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKB: string;
}

export const Playground: React.FC<PlaygroundProps> = ({ isOpen, onClose, selectedKB }) => {
  const [query, setQuery] = useState('');
  const [denseTopK, setDenseTopK] = useState(20);
  const [sparseTopK, setSparseTopK] = useState(20);
  const [rerankTopN, setRerankTopN] = useState(5);
  const [enableRerank, setEnableRerank] = useState(true);

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 p-4 bg-ink-900/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[76vh] bg-paper border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between flex-shrink-0 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-ink-900 shadow-xs">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink-900">底层多路检索实验台 (Retrieval Playground)</h3>
                {selectedKB && (
                  <span className="inline-flex items-center gap-1 bg-subtle text-ink-900 border border-border px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>{selectedKB}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-500">直接调试底层密集向量检索（NumPy）、稀疏关键词检索（BM25）、RRF 融合及 Rerank 得分表现</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-900 hover:bg-subtle transition-colors cursor-pointer"
            title="关闭 (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Search Form Card */}
          <form onSubmit={handleSearch} className="p-4 rounded-xl bg-surface border border-border space-y-4 shadow-xs">
            <div className="flex gap-2.5">
              <input
                type="text"
                required
                autoFocus
                disabled={!selectedKB}
                placeholder={selectedKB ? '输入测试查询 Query（如: 楚渊的个人终端代码）...' : '请在左侧先选择知识库...'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-paper border border-border text-xs text-ink-900 rounded-xl px-3.5 py-2 focus:outline-none focus:border-stone-400 placeholder:text-ink-400 shadow-xs"
              />
              <button
                type="submit"
                disabled={!query.trim() || isLoading || !selectedKB}
                className="px-4 py-2 rounded-xl bg-ink-900 hover:bg-accent-hover disabled:opacity-40 font-semibold text-xs text-white flex items-center gap-2 shadow-xs transition-colors flex-shrink-0 cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>开始检索</span>
              </button>
            </div>

            {/* Parameter Sliders & Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-border/80 text-xs text-ink-700">
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
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          {/* Results List */}
          <div className="space-y-3 pt-1">
            {hits.length > 0 && (
              <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider flex items-center justify-between px-1">
                <span>检索命中结果 (共 {hits.length} 条)</span>
                <span>知识库: {selectedKB}</span>
              </div>
            )}

            {hits.map((hit) => (
              <div
                key={hit.chunk_id}
                className="p-4 rounded-xl bg-surface border border-border hover:border-stone-400 transition-all space-y-2.5 shadow-xs"
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
                  <div className="flex items-center gap-1.5 text-xs text-ink-700 font-mono bg-paper px-3 py-1 rounded-lg border border-border">
                    <Compass className="w-3.5 h-3.5 text-ink-500 flex-shrink-0" />
                    <span>{hit.header_path}</span>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-paper/60 border border-border text-xs text-ink-700 font-mono leading-relaxed whitespace-pre-wrap">
                  {hit.content}
                </div>
              </div>
            ))}

            {hits.length === 0 && !isLoading && !error && (
              <div className="py-12 text-center text-xs text-ink-400 font-serif italic">
                输入 Query 并点击「开始检索」以查看多路召回与重排切片详情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
