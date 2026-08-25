import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { 
  Square, 
  Trash2, 
  Sparkles, 
  Bot, 
  User, 
  BookOpen, 
  Copy, 
  Check, 
  CornerDownLeft,
  Edit3,
  Download,
  Lightbulb
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
  onOpenCitation: (refId: number) => void;
  onRenameSession?: (newTitle: string) => void;
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
  onRenameSession,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleVal, setEditTitleVal] = useState(sessionTitle);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditTitleVal(sessionTitle);
  }, [sessionTitle]);

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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveTitle = () => {
    if (editTitleVal.trim() && onRenameSession) {
      onRenameSession(editTitleVal.trim());
    }
    setIsEditingTitle(false);
  };

  const handleExportMarkdown = () => {
    if (messages.length === 0) {
      alert('当前会话暂无消息可导出');
      return;
    }
    let mdContent = `# ${sessionTitle}\n\n知识库: ${selectedKB}\n导出时间: ${new Date().toLocaleString()}\n\n---\n\n`;
    messages.forEach((m) => {
      mdContent += `### ${m.role === 'user' ? '👤 用户' : '🤖 AI 助手'}\n\n${m.content}\n\n`;
      if (m.references && m.references.length > 0) {
        mdContent += `**参考资料:**\n`;
        m.references.forEach((ref) => {
          mdContent += `- [${ref.ref_id}] ${ref.doc_name} > ${ref.header_path} (相关度: ${ref.score})\n`;
        });
        mdContent += `\n`;
      }
      mdContent += `---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionTitle.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMessageContent = (content: string, _references?: ReferenceItem[]) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => (
            <p className="leading-relaxed mb-2.5 last:mb-0">{renderChildrenWithCitations(children)}</p>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{renderChildrenWithCitations(children)}</li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const renderChildrenWithCitations = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      const parts = children.split(/(\[\d+\])/g);
      return parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const refId = parseInt(match[1], 10);
          return (
            <button
              key={index}
              onClick={() => onOpenCitation(refId)}
              className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 text-[11px] font-bold text-brand-300 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-400/30 rounded-md transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm align-baseline"
              title={`点击查看参考引用 [${refId}] 的原文与定位`}
            >
              [{refId}]
            </button>
          );
        }
        return part;
      });
    }

    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <React.Fragment key={i}>{renderChildrenWithCitations(child)}</React.Fragment>
      ));
    }

    return children;
  };

  const sampleQuestions = [
    '系统支持哪些文档格式的解析与切片？',
    'ChromaDB 向量检索与 BM25 是如何进行多路融合的？',
    'Word 文档中的标题和表格是如何被结构化提取的？',
    '如何调用 Reranker 模块对候选切片进行二次精排？',
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-slate-950 overflow-hidden relative">
      {/* 顶部会话标题与工具栏 */}
      <div className="h-12 border-b border-slate-800/80 px-5 flex items-center justify-between bg-slate-900/30 backdrop-blur-md flex-shrink-0 text-xs z-10">
        <div className="flex items-center gap-2.5 truncate max-w-xl">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={editTitleVal}
                onChange={(e) => setEditTitleVal(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                autoFocus
                className="bg-slate-950 border border-brand-500 text-white rounded px-2 py-1 text-xs focus:outline-none"
              />
              <button onClick={handleSaveTitle} className="text-brand-400 hover:text-brand-300 font-medium text-xs">
                保存
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center gap-1.5 cursor-pointer group truncate"
              title="点击编辑会话标题"
            >
              <span className="font-semibold text-slate-200 truncate max-w-md group-hover:text-brand-300 transition-colors">
                {sessionTitle || '新对话'}
              </span>
              <Edit3 className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </div>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono flex-shrink-0">
            {selectedKB || '未选库'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <>
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-900"
                title="导出为 Markdown 文件"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">导出记录</span>
              </button>
              <button
                onClick={onClearMessages}
                disabled={isStreaming}
                className="flex items-center gap-1 text-slate-400 hover:text-rose-400 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-900"
                title="清空当前会话消息"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">清空上下文</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 消息滚动主区域 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-6 animate-fade-in py-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-brand-500/20 ring-1 ring-white/20">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                {sessionTitle || '你好！我是 RAG-GK 知识库助手'}
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-md mx-auto">
                已绑定知识库：<strong className="text-brand-400 font-medium">{selectedKB || '请先选择知识库'}</strong>。
                支持标题面包屑注入、ChromaDB 向量 + BM25 混合召回与 Cross-Encoder 语义精排。
              </p>
            </div>

            {/* 快速提问建议 */}
            <div className="w-full space-y-2 text-left pt-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                推荐提问示例：
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isStreaming) onSendMessage(q);
                    }}
                    className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-300 hover:text-slate-100 text-left transition-all hover:shadow-lg shadow-black/20 flex items-start gap-2"
                  >
                    <span className="text-brand-400 font-mono mt-0.5">•</span>
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3.5 max-w-4xl mx-auto animate-fade-in ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center flex-shrink-0 shadow-md ring-1 ring-white/20 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`group relative rounded-2xl p-4 sm:p-5 max-w-[88%] sm:max-w-[82%] text-sm shadow-md ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-none shadow-brand-600/20'
                    : 'bg-slate-900/90 border border-slate-800/90 text-slate-200 rounded-bl-none shadow-black/30'
                }`}
              >
                {/* 消息文本内容 */}
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                ) : (
                  <div>
                    <div className="markdown-body">
                      {msg.content ? (
                        renderMessageContent(msg.content, msg.references)
                      ) : msg.isStreaming ? (
                        <div className="flex items-center gap-2 text-slate-400 py-1">
                          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                          <span className="text-xs">思考并检索知识库中...</span>
                        </div>
                      ) : null}
                    </div>

                    {/* 引用来源卡片条 */}
                    {msg.references && msg.references.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                        <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
                          <BookOpen className="w-3 h-3 text-brand-400" />
                          <span>参考资料 ({msg.references.length}):</span>
                        </div>
                        {msg.references.map((ref) => (
                          <button
                            key={ref.ref_id}
                            onClick={() => onOpenCitation(ref.ref_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-all shadow-sm"
                          >
                            <span className="font-bold text-brand-400">[{ref.ref_id}]</span>
                            <span className="truncate max-w-[120px]">{ref.doc_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 复制按钮 */}
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className="absolute right-2 top-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-all"
                  title="复制内容"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 shadow-md mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入框 */}
      <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!selectedKB}
            placeholder={
              selectedKB
                ? '向知识库提问（支持多轮对话，Enter 发送，Shift+Enter 换行）...'
                : '请先在左侧选择或创建一个知识库...'
            }
            className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-2xl pl-4 pr-24 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none shadow-xl"
          />

          <div className="absolute right-3.5 bottom-4.5 flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>停止</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !selectedKB}
                className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-medium flex items-center gap-1.5 shadow-lg shadow-brand-600/30 transition-all"
              >
                <span>发送</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
