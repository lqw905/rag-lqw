import React from 'react';
import { X, ExternalLink, Copy, Check, BookOpen, Compass, Award } from 'lucide-react';
import type { ReferenceItem } from '../types';

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  references: ReferenceItem[];
  activeRefId: number | null;
  onSelectRef: (ref_id: number) => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({
  isOpen,
  onClose,
  references,
  activeRefId,
  onSelectRef,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || references.length === 0) return null;

  const currentRef = references.find((r) => r.ref_id === activeRefId) || references[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreBadge = (score: number) => {
    if (score >= 0.8) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 0.5) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-ink-500 bg-subtle border-border';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* 雾化磨砂背景遮罩 (Frosted Glass Backdrop Overlay) */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/25 backdrop-blur-sm transition-opacity duration-300 animate-fade-in cursor-pointer"
        title="点击背景关闭抽屉"
      />

      {/* 右侧滑出引用档案卡片 - 拓宽至 560px 舒适阅读区 */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] md:w-[580px] max-w-[100vw] bg-surface border-l border-border shadow-popover flex flex-col animate-slide-left">
        
        {/* Drawer Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between flex-shrink-0 bg-paper/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-ink-900 text-white flex items-center justify-center shadow-sm">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-ink-900">溯源引用档案 (Citations)</h3>
              <p className="text-[10px] text-ink-500 font-mono">共命中 {references.length} 处权威参考切片</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-subtle text-ink-400 hover:text-ink-900 transition-colors"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reference Tabs (拓宽并隐藏多余滚动条) */}
        <div className="px-5 py-2.5 border-b border-border bg-paper flex items-center gap-2 overflow-x-auto flex-shrink-0 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {references.map((ref) => {
            const isSelected = currentRef.ref_id === ref.ref_id;
            return (
              <button
                key={ref.ref_id}
                onClick={() => onSelectRef(ref.ref_id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap flex-shrink-0 ${
                  isSelected
                    ? 'bg-ink-900 text-white shadow-card ring-1 ring-ink-900'
                    : 'bg-surface text-ink-700 hover:text-ink-900 hover:bg-subtle border border-border shadow-card'
                }`}
                title={ref.doc_name}
              >
                <span className={`font-mono text-[11px] px-1 rounded ${isSelected ? 'bg-white/20' : 'bg-subtle text-ink-500'}`}>
                  REF #{ref.ref_id}
                </span>
                <span className="truncate max-w-[140px] text-xs">{ref.doc_name}</span>
                <span className={`text-[10px] font-mono font-medium ${isSelected ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  {(ref.score * 100).toFixed(0)}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Main Drawer Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* Source Meta Card - 完整展示文件名与路径，不截断 */}
          <div className="p-4.5 rounded-xl bg-paper border border-border space-y-3.5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">来源文档</span>
              <div className={`text-[11px] px-2.5 py-0.5 rounded-full border font-mono font-semibold flex items-center gap-1 ${getScoreBadge(currentRef.score)}`}>
                <Award className="w-3.5 h-3.5" />
                <span>综合相关度: {(currentRef.score * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* 文件名完整显示 */}
            <div className="font-semibold text-ink-900 text-sm flex items-start gap-2 pt-0.5">
              <ExternalLink className="w-4 h-4 text-ink-500 flex-shrink-0 mt-0.5" />
              <span className="break-all leading-snug">{currentRef.doc_name}</span>
            </div>

            {/* 面包屑层级路径完整显示 */}
            {currentRef.header_path && (
              <div className="pt-2 border-t border-border">
                <div className="text-[11px] text-ink-500 mb-1.5 flex items-center gap-1 font-medium">
                  <Compass className="w-3.5 h-3.5 text-ink-500" />
                  <span>标题层级面包屑 (Context Path)</span>
                </div>
                <div className="p-3 rounded-lg bg-surface border border-border text-xs text-ink-900 font-mono leading-relaxed break-words">
                  {currentRef.header_path}
                </div>
              </div>
            )}
          </div>

          {/* Chunk Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                命中切片原文 (Chunk Content)
              </h4>
              <button
                onClick={() => handleCopy(currentRef.full_content)}
                className="text-xs text-ink-500 hover:text-ink-900 flex items-center gap-1.5 transition-colors px-2.5 py-1 rounded-lg hover:bg-subtle border border-transparent hover:border-border"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制原文' : '复制原文'}</span>
              </button>
            </div>
            
            <div className="p-4.5 rounded-xl bg-paper border border-border text-xs text-ink-800 leading-relaxed font-mono whitespace-pre-wrap break-words shadow-card selection:bg-stone-200">
              {currentRef.full_content}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-3.5 border-t border-border bg-paper/60 flex items-center justify-between text-[11px] font-mono text-ink-400 px-6">
          <span>NumPy Vector + BM25 稀疏召回</span>
          <span>BGE-Reranker-v2 精排</span>
        </div>
      </div>
    </div>
  );
};
