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

      {/* 右侧滑出引用档案卡片 (Slide-over Drawer) */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border shadow-popover flex flex-col animate-slide-left">
        {/* Drawer Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between flex-shrink-0 bg-paper/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-ink-900 text-white flex items-center justify-center shadow-sm">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-ink-900">溯源引用档案</h3>
              <p className="text-[10px] text-ink-500 font-mono">共命中 {references.length} 个参考切片</p>
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

        {/* Reference Tabs (if multiple references) */}
        <div className="px-6 py-2.5 border-b border-border bg-paper flex items-center gap-2 overflow-x-auto flex-shrink-0">
          {references.map((ref) => (
            <button
              key={ref.ref_id}
              onClick={() => onSelectRef(ref.ref_id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                currentRef.ref_id === ref.ref_id
                  ? 'bg-ink-900 text-white shadow-card'
                  : 'bg-surface text-ink-500 hover:text-ink-900 hover:bg-subtle border border-border'
              }`}
            >
              <span>[文档{ref.ref_id}]</span>
              <span className="text-[10px] opacity-80 truncate max-w-[90px]">{ref.doc_name}</span>
            </button>
          ))}
        </div>

        {/* Main Drawer Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* Source Meta Card */}
          <div className="p-4 rounded-xl bg-paper border border-border space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-500 uppercase tracking-wider">来源文档</span>
              <div className={`text-[11px] px-2 py-0.5 rounded-full border font-mono font-semibold flex items-center gap-1 ${getScoreBadge(currentRef.score)}`}>
                <Award className="w-3 h-3" />
                <span>匹配度: {(currentRef.score * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="font-semibold text-ink-900 text-xs flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-ink-500 flex-shrink-0" />
              <span className="truncate">{currentRef.doc_name}</span>
            </div>

            {/* Breadcrumb Path */}
            {currentRef.header_path && (
              <div className="pt-2 border-t border-border">
                <div className="text-[11px] text-ink-500 mb-1 flex items-center gap-1 font-medium">
                  <Compass className="w-3 h-3 text-ink-500" />
                  <span>标题层级面包屑 (Context Path)</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-border text-xs text-ink-900 font-mono leading-relaxed">
                  {currentRef.header_path}
                </div>
              </div>
            )}
          </div>

          {/* Chunk Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                命中切片原文 (Chunk Content)
              </h4>
              <button
                onClick={() => handleCopy(currentRef.full_content)}
                className="text-xs text-ink-500 hover:text-ink-900 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-subtle"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制' : '复制原文'}</span>
              </button>
            </div>
            <div className="p-4 rounded-xl bg-paper border border-border text-xs text-ink-700 leading-relaxed font-mono whitespace-pre-wrap shadow-card">
              {currentRef.full_content}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-border bg-paper/60 text-center text-[11px] font-mono text-ink-400">
          双路召回 (NumPy + BM25) · Rerank Top-5 精排
        </div>
      </div>
    </div>
  );
};
