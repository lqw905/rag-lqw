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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 lg:p-8">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <span>切片与面包屑可视化预览</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 font-mono">
                  {kbName}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                共 {chunks.length} 个切片，估算总 Token 消耗：{totalTokens.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search filter */}
            <div className="relative w-64 hidden sm:block">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索切片内容/标题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content - Chunk List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/40">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
              <p className="text-sm">正在加载切片数据...</p>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <p className="text-sm">未找到匹配的切片</p>
            </div>
          ) : (
            filteredChunks.map((chunk, idx) => (
              <div
                key={chunk.chunk_id || idx}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20 font-mono text-[11px]">
                      #{chunk.chunk_index + 1}
                    </span>
                    <span className="text-slate-300">{chunk.doc_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                    <Hash className="w-3 h-3 text-slate-500" />
                    <span>{chunk.token_count} Tokens</span>
                  </div>
                </div>

                {chunk.header_path && (
                  <div className="flex items-center gap-1.5 text-xs text-brand-300/90 font-mono bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                    <Compass className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                    <span className="truncate">{chunk.header_path}</span>
                  </div>
                )}

                <div className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap bg-slate-950/40 p-3 rounded-xl border border-slate-900">
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
