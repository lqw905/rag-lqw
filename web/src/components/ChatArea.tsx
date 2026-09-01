import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { 
  Trash2, 
  CornerDownLeft,
  Download,
  CheckCircle2,
  ChevronRight,
  StopCircle,
  Plus
} from 'lucide-react';
import type { ChatMessage, ReferenceItem } from '../types';

interface ChatAreaProps {
  messages: ChatMessage[];
  sessionTitle: string;
  selectedKB: string;
  isStreaming: boolean;
  onSendMessage: (query: string) => void;
  onStopGeneration: () => void;
  onClearMessages: () => void;
  onOpenCitation: (refId: number, references?: ReferenceItem[]) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  sessionTitle,
  selectedKB,
  isStreaming,
  onSendMessage,
  onStopGeneration,
  onClearMessages,
  onOpenCitation,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleExportMarkdown = () => {
    if (messages.length === 0) {
      alert('当前会话暂无消息可导出');
      return;
    }
    let mdContent = `# ${sessionTitle}\n\n知识库: ${selectedKB}\n导出时间: ${new Date().toLocaleString()}\n\n---\n\n`;
    messages.forEach((m) => {
      if (m.role === 'user') {
        mdContent += `### 提问 (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n`;
      } else {
        mdContent += `### 回答\n\n${m.content}\n\n`;
        if (m.references && m.references.length > 0) {
          mdContent += `**参考依据**:\n`;
          m.references.forEach((r) => {
            mdContent += `- [${r.ref_id}] ${r.doc_name} (${r.header_path || '正文'}): ${r.snippet}\n`;
          });
          mdContent += `\n`;
        }
      }
      mdContent += `---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sessionTitle || '研读对话'}_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
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
    <div className="flex-1 flex flex-col h-screen bg-paper overflow-hidden relative">

      {/* 顶部轻量浮动操作胶囊（存在会话消息时浮现） */}
      {messages.length > 0 && (
        <div className="absolute top-3.5 right-4 z-20 flex items-center gap-1.5 bg-paper/90 backdrop-blur-md p-1 rounded-xl border border-border/80 shadow-xs animate-fade-in">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="flex items-center gap-1 text-ink-500 hover:text-ink-900 transition-colors px-2 py-1 rounded-lg hover:bg-subtle text-xs cursor-pointer"
            title="导出为 Markdown 报告"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">导出报告</span>
          </button>
          <button
            type="button"
            onClick={onClearMessages}
            disabled={isStreaming}
            className="flex items-center gap-1 text-ink-500 hover:text-rose-600 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 text-xs cursor-pointer disabled:opacity-40"
            title="清空当前会话上下文"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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

            {/* 居中核心输入胶囊卡片 */}
            <form 
              onSubmit={handleSubmit} 
              className="w-full bg-surface border border-border focus-within:border-stone-400 rounded-3xl p-3 sm:p-3.5 shadow-float transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-subtle text-ink-500 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="有问必答，深度检索私域知识库..."
                  className="w-full bg-transparent text-sm sm:text-base text-ink-900 placeholder:text-ink-400 focus:outline-none px-1"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  className="w-8 h-8 rounded-full bg-ink-900 hover:bg-accent-hover text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs cursor-pointer"
                  title="发送提问"
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
                      <div className="flex items-center justify-end text-[11px] font-mono text-ink-400 mb-1.5">
                        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
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
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="向知识库提出深度问题，或输入指令（支持多文档关联推理）..."
                className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none resize-none px-2 leading-relaxed"
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
