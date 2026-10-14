import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, PanelLeft, SlidersHorizontal, RotateCcw, X } from 'lucide-react';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  minScore: number;
  onMinScoreChange: (val: number) => void;
  topN: number;
  onTopNChange: (val: number) => void;
  enableRewrite: boolean;
  onEnableRewriteChange: (val: boolean) => void;
  enableRerank: boolean;
  onEnableRerankChange: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  isSidebarCollapsed = false,
  onToggleSidebar,
  minScore,
  onMinScoreChange,
  topN,
  onTopNChange,
  enableRewrite,
  onEnableRewriteChange,
  enableRerank,
  onEnableRerankChange,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  const handleResetDefaults = () => {
    onMinScoreChange(0.08);
    onTopNChange(5);
    onEnableRewriteChange(true);
    onEnableRerankChange(true);
  };

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

      <div className="flex items-center gap-2.5">
        {/* 检索参数快捷调节 Popover */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
              isSettingsOpen 
                ? 'bg-ink-900 text-white border-ink-900 shadow-xs' 
                : 'bg-subtle hover:bg-surface text-ink-700 border-border hover:border-stone-400'
            }`}
            title="自主调节 Rerank 过滤阈值、Top-N 与查询提纯"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>检索参数</span>
            <span className={`font-mono text-[10px] px-1 py-0.2 rounded border ${
              isSettingsOpen
                ? 'bg-stone-800 text-stone-200 border-stone-700'
                : 'bg-paper text-ink-900 border-border'
            }`}>
              阈值: {minScore.toFixed(2)}
            </span>
          </button>

          {isSettingsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-paper border border-border rounded-xl shadow-xl p-4 z-50 animate-scale-in text-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
                <div className="flex items-center gap-2 font-semibold text-ink-900 text-xs">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-stone-700" />
                  <span>对话检索过滤参数</span>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded text-ink-400 hover:text-ink-900 hover:bg-subtle cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 过滤阈值 Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-ink-700 font-medium">置信度过滤阈值 (Min Score):</label>
                  <span className="font-mono font-semibold text-ink-900 bg-subtle px-1.5 py-0.5 rounded border border-border">
                    {minScore.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.50"
                  step="0.01"
                  value={minScore}
                  onChange={(e) => onMinScoreChange(parseFloat(e.target.value))}
                  className="w-full accent-stone-900"
                />
                <p className="text-[10px] text-ink-400 leading-tight">
                  低于此分数的噪音切片将被自动剔除。设置为 0.00 则保留所有召回切片。
                </p>
              </div>

              {/* Top-N 数量 Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-ink-700 font-medium">参考切片数量 (Top-N):</label>
                  <span className="font-mono font-semibold text-ink-900 bg-subtle px-1.5 py-0.5 rounded border border-border">
                    {topN}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={topN}
                  onChange={(e) => onTopNChange(parseInt(e.target.value, 10))}
                  className="w-full accent-stone-900"
                />
              </div>

              {/* 开关选项 */}
              <div className="space-y-2 pt-1 border-t border-border/80">
                <label className="flex items-center justify-between cursor-pointer text-ink-700">
                  <span>启用 Reranker 语义精排</span>
                  <input
                    type="checkbox"
                    checked={enableRerank}
                    onChange={(e) => onEnableRerankChange(e.target.checked)}
                    className="w-4 h-4 rounded text-ink-900 accent-stone-900 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer text-ink-700">
                  <span>启用 LLM 提纯改写 (去噪)</span>
                  <input
                    type="checkbox"
                    checked={enableRewrite}
                    onChange={(e) => onEnableRewriteChange(e.target.checked)}
                    className="w-4 h-4 rounded text-ink-900 accent-stone-900 cursor-pointer"
                  />
                </label>
              </div>

              {/* 恢复默认值 */}
              <div className="pt-2 border-t border-border/80 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-[11px] text-ink-500 hover:text-ink-900 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>恢复系统默认值</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <span className="text-[10px] font-mono text-ink-400 bg-subtle px-2 py-0.5 rounded border border-border">
          HYBRID RAG v1.0
        </span>
      </div>
    </header>
  );
};
