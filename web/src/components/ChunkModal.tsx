import React, { useState, useEffect } from 'react';
import { X, Layers, Search, Compass, Hash, Loader2 } from 'lucide-react';
import type { ChunkDetail } from '../types';
import { api } from '../services/api';

interface ChunkModalProps {
  isOpen: boolean;
  onClose: () => void;
  kbName: string;
}

export const ChunkModal: React.FC<ChunkModalProps> = ({ isOpen, onClose, kbName }) => {
  const [chunks, setChunks] = useState<ChunkDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && kbName) {
      setLoading(true);
      api
        .listChunks(kbName, 200, 0)
        .then((res) => setChunks(res.chunks || []))
        .catch((err) => console.error('Failed to load chunks:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, kbName]);

  if (!isOpen) return null;

  const filteredChunks = chunks.filter(
    (c) =>
      c.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.doc_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.header_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalTokens = chunks.reduce((acc, curr) => acc + (curr.token_count || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 lg:p-8 select-none">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-popover overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-paper/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-subtle border border-border text-ink-900 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-ink-900 flex items-center gap-2">
                <span>切片与面包屑结构预览</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-subtle text-ink-700 border border-border font-mono">
                  {kbName}
                </span>
              </h3>
              <p className="text-[11px] text-ink-500 font-mono">
                共 {chunks.length} 个切片 · 估算总 Token：{totalTokens.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search filter */}
            <div className="relative w-64 hidden sm:flex items-center">
              <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="搜索切片内容/标题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-paper border border-border text-xs text-ink-900 pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-stone-400 placeholder:text-ink-400"
              />
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-subtle text-ink-400 hover:text-ink-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content - Chunk List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-paper/40">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-ink-500 gap-3">
              <Loader2 className="w-6 h-6 text-ink-900 animate-spin" />
              <p className="text-xs font-mono">正在加载切片数据...</p>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-ink-400">
              <p className="text-xs">未找到匹配的切片</p>
            </div>
          ) : (
            filteredChunks.map((chunk, idx) => (
              <div
                key={chunk.chunk_id || idx}
                className="p-4 rounded-xl bg-surface border border-border space-y-2.5 shadow-card"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-subtle text-ink-700 border border-border font-mono text-[10px]">
                      #{chunk.chunk_index + 1}
                    </span>
                    <span className="text-ink-900 font-semibold">{chunk.doc_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-ink-500 font-mono text-[11px]">
                    <Hash className="w-3 h-3 text-ink-400" />
                    <span>{chunk.token_count} Tokens</span>
                  </div>
                </div>

                {chunk.header_path && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-700 font-mono bg-paper px-2.5 py-1.5 rounded-lg border border-border">
                    <Compass className="w-3.5 h-3.5 text-ink-500 flex-shrink-0" />
                    <span className="truncate">{chunk.header_path}</span>
                  </div>
                )}

                <div className="text-xs text-ink-700 font-mono leading-relaxed whitespace-pre-wrap bg-paper/60 p-3 rounded-lg border border-border/60">
                  {chunk.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
