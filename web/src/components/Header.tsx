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
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-1 ring-white/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-slate-100 tracking-tight">RAG-GK</span>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
              v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400">轻量级可信知识库问答引擎</p>
        </div>
      </div>

      {/* Center Tab Switcher */}
      <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 shadow-inner">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'chat'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          智能问答工作台
        </button>
        <button
          onClick={() => setActiveTab('playground')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'playground'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Search className="w-4 h-4" />
          检索实验台
        </button>
      </div>

      {/* Right Engine Status Badges */}
      <div className="flex items-center gap-3 text-xs">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-brand-400" />
          <span>LLM:</span>
          <span className="font-mono text-slate-100">{healthInfo?.llm_model || 'deepseek-chat'}</span>
        </div>
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Chroma + BM25</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>服务就绪</span>
        </div>
      </div>
    </header>
  );
};
