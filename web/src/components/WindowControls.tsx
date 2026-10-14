import React, { useCallback, useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

/**
 * 自绘窗口按钮（最小化 / 最大化·还原 / 关闭）。
 *
 * 桌面端以 frameless 模式运行，系统标题栏已被移除（见 desktop_launcher.py 的
 * install_frameless_hooks），因此这三个按钮由页面自己提供；在普通浏览器里
 * window.pywebview 不存在，整块按钮不渲染，避免出现无效控件。
 *
 * ⚠ 必须放在"顶部拖动带"之外（App.tsx 的 h-9 那条）。窗口过程把顶部 36px 返回
 * HTCAPTION，落在那一带的元素收不到点击事件 —— 这就是本组件挂在左侧栏底部的原因。
 */

interface PywebviewApi {
  minimize: () => Promise<void>;
  toggle_maximize: () => Promise<boolean>;
  is_maximized: () => Promise<boolean>;
  close_window: () => Promise<void>;
}

const getApi = (): PywebviewApi | null => {
  const api = (window as unknown as { pywebview?: { api?: PywebviewApi } }).pywebview?.api;
  return api && typeof api.minimize === 'function' ? api : null;
};

/**
 * 开发用：在普通浏览器里也能渲染出按钮，便于单独调样式与截图。
 * 用法 ?mockWindowControls=1 —— 真实桌面端不要加这个参数。
 */
const isMocked = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('mockWindowControls') === '1';
  } catch {
    return false;
  }
};

const mockApi: PywebviewApi = {
  minimize: async () => {},
  toggle_maximize: async () => false,
  is_maximized: async () => false,
  close_window: async () => {},
};

// 尺寸需与 desktop_launcher.py 的 WINDOW_CONTROLS_WIDTH 对齐：3×30 + 2×2 间距 + 左右内边距 ≈ 102px
const BTN =
  'w-[30px] h-[26px] flex items-center justify-center rounded-md transition-colors ' +
  'cursor-pointer text-ink-400 hover:text-ink-900 hover:bg-subtle';

export const WindowControls: React.FC = () => {
  const [api, setApi] = useState<PywebviewApi | null>(() => (isMocked() ? mockApi : null));
  const [isMaximized, setIsMaximized] = useState(false);

  // pywebview 注入 window.pywebview 是异步的，需要轮询等待
  useEffect(() => {
    if (isMocked()) return;
    let cancelled = false;
    let tries = 0;

    const probe = () => {
      if (cancelled) return;
      const found = getApi();
      if (found) {
        setApi(found);
        found
          .is_maximized()
          .then((v) => !cancelled && setIsMaximized(!!v))
          .catch(() => {});
        return;
      }
      if (tries++ < 40) setTimeout(probe, 100);
    };
    probe();

    return () => {
      cancelled = true;
    };
  }, []);

  // 用户用双击顶部带 / Win+方向键 / 拖动边缘改变状态时，同步按钮图标
  useEffect(() => {
    if (!api) return;
    const timer = setInterval(() => {
      api
        .is_maximized()
        .then((v) => setIsMaximized((prev) => (prev === !!v ? prev : !!v)))
        .catch(() => {});
    }, 600);
    return () => clearInterval(timer);
  }, [api]);

  const handleMinimize = useCallback(() => {
    api?.minimize().catch(() => {});
  }, [api]);

  const handleToggleMaximize = useCallback(() => {
    api?.toggle_maximize().then((v) => setIsMaximized(!!v)).catch(() => {});
  }, [api]);

  const handleClose = useCallback(() => {
    api?.close_window().catch(() => {});
  }, [api]);

  if (!api) return null;

  // 尺寸与 desktop_launcher.py 的 WINDOW_CONTROLS_WIDTH 对齐：3×30 + 2×2 间距 ≈ 94px
  return (
    <div className="flex flex-row items-center gap-0.5 select-none px-1">
      <button type="button" onClick={handleMinimize} className={BTN} title="最小化">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={handleToggleMaximize}
        className={BTN}
        title={isMaximized ? '向下还原' : '最大化'}
      >
        {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
      </button>
      <button
        type="button"
        onClick={handleClose}
        className={`${BTN} hover:!bg-red-500 hover:!text-white`}
        title="关闭"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default WindowControls;
