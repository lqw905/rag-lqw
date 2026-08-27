import React from 'react';
import { BookOpen, Sparkles, Database, Search, Cpu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { HealthInfo } from '../types';

interface HeaderProps {
  activeTab: 'chat' | 'playground';
  setActiveTab: (tab: 'chat' | 'playground') => void;
  healthInfo: HealthInfo | null;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  healthInfo,
  isSidebarCollapsed = false,
  onToggleSidebar
}) => {
  return (
    <header className="h-14 border-b border-border bg-paper/80 backdrop-blur-md px-5 flex items-center justify-between sticky top-0 z-30 relative select-none">
      {/* Brand Logo, Toggle & Name (Left) */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg hover:bg-subtle text-ink-500 hover:text-ink-900 transition-colors border border-border/60 hover:border-border shadow-card mr-0.5"
            title={isSidebarCollapsed ? "展开左侧栏 (Ctrl+B)" : "收起左侧栏 (Ctrl+B)"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}

        <div className="w-8 h-8 rounded-lg bg-ink-900 flex items-center justify-center text-white shadow-sm">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-ink-900 tracking-tight">RAG Studio</span>
            <span className="text-[10px] uppercase font-mono font-medium tracking-wider px-1.5 py-0.5 rounded bg-subtle text-ink-500 border border-border">
              v1.2
            </span>
          </div>
          <p className="text-[10px] text-ink-500 leading-none mt-0.5">企业可信知识库研读引擎</p>
        </div>
      </div>

      {/* Center Tab Switcher (绝对居中) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center bg-subtle p-1 rounded-xl border border-border shadow-card">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'chat'
              ? 'bg-surface text-ink-900 shadow-sm border border-border'
              : 'text-ink-500 hover:text-ink-900 hover:bg-surface/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>研读工作台</span>
        </button>
        <button
          onClick={() => setActiveTab('playground')}
          className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'playground'
              ? 'bg-surface text-ink-900 shadow-sm border border-border'
              : 'text-ink-500 hover:text-ink-900 hover:bg-surface/50'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>检索实验台</span>
        </button>
      </div>

      {/* Right Engine Status Badges (Right) */}
      <div className="flex items-center gap-2.5 text-xs">
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-ink-700 shadow-card">
          <Cpu className="w-3.5 h-3.5 text-ink-500" />
          <span className="text-ink-400">LLM:</span>
          <span className="font-mono text-ink-900 text-[11px]">{healthInfo?.llm_model || 'DeepSeek-V3'}</span>
        </div>
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-ink-700 shadow-card">
          <Database className="w-3.5 h-3.5 text-ink-500" />
          <span className="text-ink-400">存储:</span>
          <span className="text-[11px] font-mono text-ink-900">NumPy + BM25</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-card">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-medium font-mono">就绪</span>
        </div>
      </div>
    </header>
  );
};
