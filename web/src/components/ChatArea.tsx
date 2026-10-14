import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { 
  CornerDownLeft,
  CheckCircle2,
  ChevronRight,
  StopCircle,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  X
} from 'lucide-react';
import type { ChatMessage, ReferenceItem } from '../types';

interface ChatAreaProps {
  messages: ChatMessage[];
  selectedKB: string;
  isStreaming: boolean;
  onSendMessage: (query: string) => void;
  onStopGeneration: () => void;
  onOpenCitation: (refId: number, references?: ReferenceItem[]) => void;
  minScore: number;
  onMinScoreChange: (val: number) => void;
  topN: number;
  onTopNChange: (val: number) => void;
  enableRewrite: boolean;
  onEnableRewriteChange: (val: boolean) => void;
  enableRerank: boolean;
  onEnableRerankChange: (val: boolean) => void;
}

interface RetrievalSettingsPopoverProps {
  minScore: number;
  onMinScoreChange: (val: number) => void;
  topN: number;
  onTopNChange: (val: number) => void;
  enableRewrite: boolean;
  onEnableRewriteChange: (val: boolean) => void;
  enableRerank: boolean;
  onEnableRerankChange: (val: boolean) => void;
  placement?: 'top' | 'bottom';
  align?: 'left' | 'right' | 'center';
}

const RetrievalSettingsPopover: React.FC<RetrievalSettingsPopoverProps> = ({
  minScore,
  onMinScoreChange,
  topN,
  onTopNChange,
  enableRewrite,
  onEnableRewriteChange,
  enableRerank,
  onEnableRerankChange,
  placement = 'bottom',
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleResetDefaults = () => {
    onMinScoreChange(0.08);
    onTopNChange(5);
    onEnableRewriteChange(true);
    onEnableRerankChange(true);
  };

  let positionClasses = '';
  if (placement === 'top') {
    if (align === 'right') positionClasses = 'bottom-full mb-2 right-0';
    else if (align === 'center') positionClasses = 'bottom-full mb-2 left-1/2 -translate-x-1/2';
    else positionClasses = 'bottom-full mb-2 left-0';
  } else {
    if (align === 'left') positionClasses = 'top-full mt-2 left-0';
    else if (align === 'center') positionClasses = 'top-full mt-2 left-1/2 -translate-x-1/2';
    else positionClasses = 'top-full mt-2 right-0';
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer select-none ${
          isOpen
            ? 'bg-ink-900 text-white border-ink-900 shadow-xs'
            : 'bg-subtle hover:bg-surface text-ink-700 border-border hover:border-stone-400'
        }`}
        title="自主调节过滤阈值、Top-N 与查询提纯"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>检索参数</span>
        <span
          className={`font-mono text-[10px] px-1 py-0.2 rounded border ${
            isOpen
              ? 'bg-stone-800 text-stone-200 border-stone-700'
              : 'bg-paper text-ink-900 border-border'
          }`}
        >
          阈值: {minScore.toFixed(2)}
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute ${positionClasses} w-80 bg-paper border border-border rounded-xl shadow-2xl p-4 z-50 animate-scale-in text-xs space-y-4`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
            <div className="flex items-center gap-2 font-semibold text-ink-900 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-stone-700" />
              <span>对话检索过滤参数</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
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
              className="w-full accent-stone-900 cursor-pointer"
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
              className="w-full accent-stone-900 cursor-pointer"
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
  );
};

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  selectedKB,
  isStreaming,
  onSendMessage,
  onStopGeneration,
  onOpenCitation,
  minScore,
  onMinScoreChange,
  topN,
  onTopNChange,
  enableRewrite,
  onEnableRewriteChange,
  enableRerank,
  onEnableRerankChange,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const heroTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 动态根据输入内容自适应撑开高度（限制最大高度，超出时平滑滚动）
  const adjustHeight = (el: HTMLTextAreaElement | null, minH: number, maxH: number) => {
    if (!el) return;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const targetH = Math.min(Math.max(scrollH, minH), maxH);
    el.style.height = `${targetH}px`;
    el.style.overflowY = scrollH > maxH ? 'auto' : 'hidden';
  };

  useEffect(() => {
    if (messages.length === 0) {
      adjustHeight(heroTextareaRef.current, 28, 180);
    } else {
      adjustHeight(bottomTextareaRef.current, 36, 180);
    }
  }, [input, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    if (!selectedKB) {
      alert('请先在左侧选择或新建一个知识库！');
      return;
    }
    const query = input.trim();
    setInput('');
    onSendMessage(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const renderMessageContent = (content: string, references?: ReferenceItem[]) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => (
            <p className="leading-relaxed mb-4 text-ink-800 last:mb-0">
              {renderChildrenWithCitations(children, references)}
            </p>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed mb-1 text-ink-800">
              {renderChildrenWithCitations(children, references)}
            </li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const renderChildrenWithCitations = (
    children: React.ReactNode,
    references?: ReferenceItem[]
  ): React.ReactNode => {
    if (typeof children === 'string') {
      const parts = children.split(/(\[\d+\])/g);
      return parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const refId = parseInt(match[1], 10);
          return (
            <span
              key={index}
              onClick={() => onOpenCitation(refId, references)}
              className="footnote-pill"
              title={`查看参考引用 [${refId}] 的原文与定位`}
            >
              {refId}
            </span>
          );
        }
        return part;
      });
    }

    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <React.Fragment key={i}>{renderChildrenWithCitations(child, references)}</React.Fragment>
      ));
    }

    return children;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-paper overflow-hidden relative">

      {/* 顶部工具栏：顶格无缝贴齐，移除多余顶部留白 */}
      <div className="h-11 px-4 sm:px-6 border-b border-border/70 flex items-center justify-between flex-shrink-0 bg-paper/60 backdrop-blur-xs select-none z-20">
        <div className="flex items-center gap-2">
          {selectedKB ? (
            <span className="inline-flex items-center gap-1.5 bg-subtle text-ink-900 border border-border px-2.5 py-1 rounded-lg text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>{selectedKB}</span>
            </span>
          ) : (
            <span className="text-xs text-ink-400">未选择知识库</span>
          )}
        </div>

        {/* 顶部检索参数调节器 */}
        <RetrievalSettingsPopover
          minScore={minScore}
          onMinScoreChange={onMinScoreChange}
          topN={topN}
          onTopNChange={onTopNChange}
          enableRewrite={enableRewrite}
          onEnableRewriteChange={onEnableRewriteChange}
          enableRerank={enableRerank}
          onEnableRerankChange={onEnableRerankChange}
          placement="bottom"
          align="right"
        />
      </div>

      {/* 主工作区：自适应「居中 Hero 初始态」或「流式多轮对话态」 */}
      <div className={`flex-1 overflow-y-auto ${messages.length === 0 ? 'flex flex-col justify-center items-center p-4' : 'p-4 sm:p-8 space-y-8'}`}>
        
        {messages.length === 0 ? (
          /* =========================================================================
             对话刚建立时的居中 Hero 态（Gemini 风格：问候大标题 + 居中输入框）
             ========================================================================= */
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center animate-fade-in -mt-32 sm:-mt-40">
            
            {/* 顶端问候大标题 */}
            <h1 className="text-2xl sm:text-3xl font-medium text-ink-900 tracking-tight text-center mb-7">
              你今天在想些什么？
            </h1>

            {/* 居中核心输入胶囊卡片：内容超出时自适应撑开 */}
            <form 
              onSubmit={handleSubmit} 
              className="w-full bg-surface border border-border focus-within:border-stone-400 rounded-3xl p-3 sm:p-3.5 shadow-float transition-all"
            >
              <div className="flex items-end gap-2.5">
                <div className="w-8 h-8 rounded-full bg-subtle text-ink-500 flex items-center justify-center shrink-0 mb-0.5">
                  <Plus className="w-4 h-4" />
                </div>
                <textarea
                  ref={heroTextareaRef}
                  rows={1}
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedKB ? "输入问题... (Shift+Enter 换行，Enter 发送)" : "请选择知识库..."}
                  className="w-full bg-transparent text-sm sm:text-base text-ink-900 placeholder:text-ink-400 focus:outline-none resize-none px-1 py-1 leading-relaxed max-h-[180px]"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  className="w-8 h-8 rounded-full bg-ink-900 hover:bg-accent-hover text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs cursor-pointer mb-0.5"
                  title="发送提问 (Enter)"
                >
                  <CornerDownLeft className="w-4 h-4" />
                </button>
              </div>
            </form>

          </div>
        ) : (
          /* =========================================================================
             多轮对话正文流 (存在消息时自顶向下排版)
             ========================================================================= */
          <div className="max-w-3xl mx-auto space-y-8 w-full">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const hasRefs = message.references && message.references.length > 0;

              return (
                <div key={message.id} className="space-y-3 animate-fade-in">
                  {/* 用户提问渲染为典雅的章节标题 */}
                  {isUser ? (
                    <div className="pt-4 border-t border-border/80 first:border-t-0 first:pt-0">
                      <h3 className="text-lg font-semibold text-ink-900 font-sans tracking-tight leading-snug">
                        {message.content}
                      </h3>
                    </div>
                  ) : (
                    /* AI 回答渲染为研究简报卡片 */
                    <div className="bg-surface border border-border rounded-xl p-6 shadow-card space-y-4">
                      
                      {/* 顶部事实溯源横条 */}
                      {hasRefs && (
                        <div className="flex items-center justify-between pb-3.5 border-b border-border text-xs">
                          <div className="flex items-center space-x-2 text-ink-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="font-medium">
                              已依据私域文档精准检索确认
                            </span>
                          </div>
                          <button
                            onClick={() => onOpenCitation(message.references![0].ref_id, message.references)}
                            className="flex items-center space-x-1 text-xs font-semibold text-ink-900 hover:text-stone-600 transition-colors cursor-pointer"
                          >
                            <span>查看 {message.references!.length} 处引用源</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Markdown 正文 */}
                      <div className="markdown-body">
                        {renderMessageContent(message.content, message.references)}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-ink-900 animate-pulse ml-1 align-middle" />
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 底部悬浮输入坞（仅当有对话消息时显示于底部） */}
      {messages.length > 0 && (
        <div className="p-4 sm:p-6 bg-gradient-to-t from-paper via-paper to-transparent z-10 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            
            <form onSubmit={handleSubmit} className="bg-surface border border-border focus-within:border-stone-500 rounded-2xl p-3 shadow-float transition-all">
              <textarea
                ref={bottomTextareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入问题... (Shift+Enter 换行，Enter 发送)"
                className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none resize-none px-2 py-1 leading-relaxed max-h-[180px]"
              />

              <div className="flex items-center justify-between pt-2 px-1 text-xs border-t border-border/60">
                <div className="flex items-center space-x-2 text-ink-500">
                </div>

                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={onStopGeneration}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>停止</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="w-8 h-8 rounded-full bg-ink-900 hover:bg-accent-hover disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center shadow-xs transition-all cursor-pointer"
                      title="发送 (Enter)"
                    >
                      <CornerDownLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
