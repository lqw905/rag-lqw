import React, { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    pywebview?: {
      api?: {
        minimize: () => Promise<void>;
        maximize: () => Promise<boolean>;
        is_maximized: () => Promise<boolean>;
        close: () => Promise<void>;
      };
    };
  }
}

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const checkMaximized = useCallback(() => {
    if (window.pywebview?.api?.is_maximized) {
      window.pywebview.api.is_maximized().then((res) => {
        if (typeof res === 'boolean') setIsMaximized(res);
      }).catch(() => {});
    } else {
      fetch('/api/window/state')
        .then((r) => r.json())
        .then((data) => {
          if (typeof data?.is_maximized === 'boolean') {
            setIsMaximized(data.is_maximized);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkMaximized();

    // Listen to window resize to automatically sync maximized state
    window.addEventListener('resize', checkMaximized);
    return () => window.removeEventListener('resize', checkMaximized);
  }, [checkMaximized]);

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.pywebview?.api?.minimize) {
      window.pywebview.api.minimize().catch(() => {});
    } else {
      fetch('/api/window/minimize', { method: 'POST' }).catch(() => {});
    }
  };

  const handleToggleMaximize = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (window.pywebview?.api?.maximize) {
      window.pywebview.api.maximize().then((res) => {
        if (typeof res === 'boolean') setIsMaximized(res);
      }).catch(() => {});
    } else {
      fetch('/api/window/maximize', { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data?.is_maximized === 'boolean') {
            setIsMaximized(data.is_maximized);
          }
        })
        .catch(() => {});
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.pywebview?.api?.close) {
      window.pywebview.api.close().catch(() => {});
    } else {
      fetch('/api/window/close', { method: 'POST' }).catch(() => {});
    }
  };

  return (
    <div className="h-9 w-full bg-white border-b border-gray-200/70 flex items-center justify-between select-none z-50 text-gray-700 flex-shrink-0">
      {/* 左侧及中央区域：pywebview 专属原生平滑拖拽区域，支持双击切换最大化/还原 */}
      <div
        className="pywebview-drag-region flex-1 h-full flex items-center pl-3 pr-2 cursor-default"
        onDoubleClick={handleToggleMaximize}
      >
        <span className="text-xs font-medium text-gray-700 tracking-tight">
          RAG-GK 知识库问答系统
        </span>
      </div>

      {/* 右侧窗口控制按键：隔离在拖拽区之外，点击灵敏流畅 */}
      <div
        className="flex items-center h-full no-drag"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 最小化按键 */}
        <button
          type="button"
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 transition-colors focus:outline-none"
          title="最小化"
          aria-label="最小化"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" className="fill-current">
            <rect width="10" height="1" />
          </svg>
        </button>

        {/* 最大化 / 还原按键 */}
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="w-11 h-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 transition-colors focus:outline-none"
          title={isMaximized ? "向下还原" : "最大化"}
          aria-label={isMaximized ? "向下还原" : "最大化"}
        >
          {isMaximized ? (
            // 还原图标（两个重叠矩形）
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M 2.5,2.5 L 2.5,0.5 L 9.5,0.5 L 9.5,7.5 L 7.5,7.5" />
              <rect x="0.5" y="2.5" width="7" height="7" />
            </svg>
          ) : (
            // 最大化图标（单个正方形矩形）
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          )}
        </button>

        {/* 关闭按键 */}
        <button
          type="button"
          onClick={handleClose}
          className="w-11 h-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#E81123] active:bg-[#C4101E] transition-colors focus:outline-none"
          title="关闭"
          aria-label="关闭"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M 0.5,0.5 L 9.5,9.5 M 9.5,0.5 L 0.5,9.5" />
          </svg>
        </button>
      </div>
    </div>
  );
};
