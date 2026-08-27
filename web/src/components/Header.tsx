import React from 'react';
import { BookOpen, Sparkles, Search, PanelLeft } from 'lucide-react';
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
    <header className="h-12 border-b border-border bg-paper/80 backdrop-blur-md px-5 flex items-center justify-between sticky top-0 z-30 relative select-none">
      {/* Brand Logo, Toggle & Name (Left) */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg hover:bg-subtle text-ink-500 hover:text-ink-900 transition-colors border border-border/60 hover:border-border shadow-card mr-0.5"
            title={isSidebarCollapsed ? "展开左侧栏 (Ctrl+B)" : "收起左侧栏 (Ctrl+B)"}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        <div className="w-8 h-8 rounded-lg bg-ink-900 flex items-center justify-center text-white shadow-sm">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-ink-900 tracking-tight">RAG Studio</span>
          </div>
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

    </header>
  );
};
