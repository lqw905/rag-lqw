import React from 'react';
import { Bot, Sparkles, Database, Search, Cpu } from 'lucide-react';
import type { HealthInfo } from '../types';

interface HeaderProps {
  activeTab: 'chat' | 'playground';
  setActiveTab: (tab: 'chat' | 'playground') => void;
  healthInfo: HealthInfo | null;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, healthInfo }) => {
  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-5 flex items-center justify-between sticky top-0 z-30 relative select-none">
      {/* Brand Logo & Name (Left) */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-1 ring-white/20">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base text-slate-100 tracking-tight">RAG-GK</span>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
              v1.2
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-none mt-0.5">轻量级可信知识库引擎</p>
        </div>
      </div>

      {/* Center Tab Switcher (绝对数学居中) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center bg-slate-950/85 p-1 rounded-xl border border-slate-800 shadow-inner">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'chat'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>智能问答工作台</span>
        </button>
        <button
          onClick={() => setActiveTab('playground')}
          className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'playground'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>检索实验台</span>
        </button>
      </div>

      {/* Right Engine Status Badges (Right) */}
      <div className="flex items-center gap-2 text-xs">
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-slate-400">LLM:</span>
          <span className="font-mono text-slate-100 text-[11px]">{healthInfo?.llm_model || 'DeepSeek-V3'}</span>
        </div>
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">存储:</span>
          <span className="text-[11px] font-mono text-slate-200">ChromaDB + BM25</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium">就绪</span>
        </div>
      </div>
    </header>
  );
};
