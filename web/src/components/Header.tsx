import React from 'react';
import { BookOpen, PanelLeft } from 'lucide-react';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  isSidebarCollapsed = false,
  onToggleSidebar
}) => {
  return (
    <header className="h-12 border-b border-border bg-paper/80 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30 relative select-none">
      {/* Brand Logo, Toggle & Title (Left) */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-ink-900 flex items-center justify-center text-white shadow-xs">
          <BookOpen className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-ink-900 tracking-tight">RAG Studio</span>
        </div>

        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="ml-2 p-1 rounded-lg hover:bg-subtle text-ink-500 hover:text-ink-900 transition-colors border border-border/60 hover:border-border shadow-xs cursor-pointer"
            title={isSidebarCollapsed ? "展开左侧栏 (Ctrl+B)" : "收起左侧栏 (Ctrl+B)"}
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-ink-400 bg-subtle px-2 py-0.5 rounded border border-border">
          HYBRID RAG v1.0
        </span>
      </div>
    </header>
  );
};
