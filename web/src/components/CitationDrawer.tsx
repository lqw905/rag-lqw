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

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 0.5) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col animate-slide-left">
      {/* Drawer Header */}
      <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">引用来源溯源</h3>
            <p className="text-[11px] text-slate-400">共检索命中 {references.length} 个参考片段</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Reference Tabs (if multiple references) */}
      <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2 overflow-x-auto flex-shrink-0">
        {references.map((ref) => (
          <button
            key={ref.ref_id}
            onClick={() => onSelectRef(ref.ref_id)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              currentRef.ref_id === ref.ref_id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400/50'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>[文档{ref.ref_id}]</span>
            <span className="text-[10px] opacity-75 truncate max-w-[80px]">{ref.doc_name}</span>
          </button>
        ))}
      </div>

      {/* Main Drawer Content */}
      <div className="p-6 flex-1 overflow-y-auto space-y-5">
        {/* Source Meta Card */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-3 shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">来源文档</span>
            <div className={`text-xs px-2.5 py-0.5 rounded-full border font-mono font-medium flex items-center gap-1 ${getScoreColor(currentRef.score)}`}>
              <Award className="w-3 h-3" />
              <span>匹配分: {(currentRef.score * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-brand-400 flex-shrink-0" />
            <span className="truncate">{currentRef.doc_name}</span>
          </div>

          {/* Breadcrumb Path */}
          {currentRef.header_path && (
            <div className="pt-2 border-t border-slate-800/60">
              <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-1 font-medium">
                <Compass className="w-3 h-3 text-brand-400" />
                <span>标题层级面包屑 (Context Path)</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-brand-300 font-mono leading-relaxed">
                {currentRef.header_path}
              </div>
            </div>
          )}
        </div>

        {/* Chunk Content */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              命中切片原文 (Chunk Content)
            </h4>
            <button
              onClick={() => handleCopy(currentRef.full_content)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制原文'}</span>
            </button>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap selection:bg-brand-500/30 selection:text-brand-200 shadow-inner">
            {currentRef.full_content}
          </div>
        </div>
      </div>
    </div>
  );
};
