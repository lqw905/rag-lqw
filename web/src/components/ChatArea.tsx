import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { 
  Trash2, 
  BookOpen, 
  Copy, 
  Check, 
  CornerDownLeft,
  Edit3,
  Download,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  StopCircle
} from 'lucide-react';
import type { ChatMessage, ReferenceItem, ChunkDetail } from '../types';
import { api } from '../services/api';

interface ChatAreaProps {
  messages: ChatMessage[];
  sessionTitle: string;
  selectedKB: string;
  isStreaming: boolean;
  onSendMessage: (query: string) => void;
  onStopGeneration: () => void;
  onClearMessages: () => void;
  onOpenCitation: (refId: number, references?: ReferenceItem[]) => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      mdContent += `### ${m.role === 'user' ? '提问' : '研读回答'}\n\n${m.content}\n\n`;
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

  const renderMessageContent = (content: string, references?: ReferenceItem[]) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => (
            <p className="leading-relaxed mb-3 last:mb-0 text-ink-900">{renderChildrenWithCitations(children, references)}</p>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-ink-900">{renderChildrenWithCitations(children, references)}</li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const renderChildrenWithCitations = (children: React.ReactNode, references?: ReferenceItem[]): React.ReactNode => {
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

  // 动态根据当前选中的知识库切片内容生成相关联的探索问题
  const [dynamicQuestions, setDynamicQuestions] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedKB) {
      setDynamicQuestions([
        '请在左侧选择或创建一个目标知识库',
        '系统支持哪些文档格式的解析与切片？',
        'NumPy 向量检索与 BM25 是如何多路融合的？',
        '如何调用 Reranker 模块对候选切片进行二次精排？',
      ]);
      return;
    }

    let isMounted = true;
    api
      .listChunks(selectedKB, 20, 0)
      .then((res: { total?: number; chunks?: ChunkDetail[] }) => {
        if (!isMounted) return;
        const chunks: ChunkDetail[] = res.chunks || [];
        if (chunks.length === 0) {
          setDynamicQuestions([
            `知识库「${selectedKB}」暂无切片文档，请先在左侧上传文档`,
            '支持 Word (.docx)、Markdown (.md) 和纯文本 (.txt) 文件导入',
            '系统会自动提取 Word 标题层级转为 Markdown 面包屑',
            '表格将自动还原为结构化 Markdown 表格以防数据断裂',
          ]);
          return;
        }

        // 提取所有不同的文档名和有意义的面包屑标题
        const docNames: string[] = Array.from(new Set(chunks.map((c: ChunkDetail) => c.doc_name).filter(Boolean)));
        const headers: string[] = Array.from(
          new Set(
            chunks
              .map((c: ChunkDetail) => c.header_path)
              .filter(Boolean)
              .map((h: string) => h.replace(/^.*?>\s*/, '').trim()) // 提取叶子标题
              .filter((h: string) => h.length > 2)
          )
        );

        const generated: string[] = [];
        const firstDoc = docNames.length > 0 ? docNames[0].replace(/\.(md|docx|txt)$/i, '') : '';
        const secondDoc = docNames.length > 1 ? docNames[1].replace(/\.(md|docx|txt)$/i, '') : '';

        // 1. 文档概要类问题
        if (firstDoc) {
          generated.push(`请全面总结《${firstDoc}》的核心要点与关键结论。`);
        } else {
          generated.push(`请全面概述知识库「${selectedKB}」包含的主要内容。`);
        }

        // 2. 核心细节 / 背景经历 / 规范解析
        if (headers.length > 0) {
          generated.push(`请详细阐述【${headers[0]}】的具体细节与关键信息。`);
        } else if (secondDoc) {
          generated.push(`解析《${secondDoc}》中涉及的重点内容与核心规范。`);
        } else if (firstDoc) {
          generated.push(`梳理《${firstDoc}》中的核心技能、主要经历与关键成果。`);
        } else {
          generated.push(`提炼本知识库中的核心业务流程与设计规范。`);
        }

        // 3. 术语 / 对比 / 知识图谱
        if (docNames.length >= 2) {
          generated.push(`对比《${firstDoc}》与《${secondDoc}》在核心内容上的异同点。`);
        } else if (headers.length >= 2) {
          generated.push(`围绕【${headers[1]}】的内容，梳理其关键流程与注意事项。`);
        } else {
          generated.push(`基于知识库「${selectedKB}」，梳理一份核心术语与关键概念清单。`);
        }

        // 4. 常见问题 / 综合问答 / 实战应用
        if (headers.length >= 3) {
          generated.push(`在涉及【${headers[2]}】的场景下，有哪些最佳实践或处置建议？`);
        } else if (firstDoc) {
          generated.push(`针对《${firstDoc}》的核心内容提出 3 个深度问题并给出解答。`);
        } else {
          generated.push(`请根据当前知识库的资料，解答常见疑问并提供完整参考出处。`);
        }

        // 兜底保障：严格确保有且仅有 4 个完整且互不重复的示例问题
        const fallbacks = [
          `提炼当前知识库的结构框架与核心要义。`,
          `针对知识库内容进行深度问答与多角度关联推理。`,
          `梳理关键时间线、操作流程与标准规范清单。`,
          `解答常见技术或业务疑问并标注权威原文出处。`,
        ];
        for (const fb of fallbacks) {
          if (!generated.includes(fb) && generated.length < 4) {
            generated.push(fb);
          }
        }

        setDynamicQuestions(generated.slice(0, 4));
      })
      .catch(() => {
        if (!isMounted) return;
        setDynamicQuestions([
          `请全面概述知识库「${selectedKB}」包含的主要内容。`,
          `提炼本知识库中的核心业务流程与设计规范。`,
          `查找本知识库中的常见问题与标准处置 SOP。`,
          `对比分析本知识库不同章节间的逻辑关联。`,
        ]);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedKB]);

  const sampleQuestions = dynamicQuestions;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-paper overflow-hidden relative">
      {/* 顶部会话标题与工具栏 */}
      <div className="h-12 border-b border-border px-6 flex items-center justify-between bg-paper/90 backdrop-blur-md flex-shrink-0 text-xs z-10 select-none">
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
                className="bg-surface border border-stone-400 text-ink-900 rounded px-2 py-1 text-xs focus:outline-none"
              />
              <button onClick={handleSaveTitle} className="text-ink-900 font-semibold text-xs">
                保存
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center gap-1.5 cursor-pointer group truncate"
              title="点击编辑会话标题"
            >
              <span className="font-semibold text-ink-900 truncate max-w-md group-hover:text-stone-600 transition-colors">
                {sessionTitle || '研读对话'}
              </span>
              <Edit3 className="w-3.5 h-3.5 text-ink-400 group-hover:text-ink-900 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </div>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-subtle text-ink-700 border border-border font-mono flex-shrink-0">
            {selectedKB || '未选择知识库'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <>
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1 text-ink-500 hover:text-ink-900 transition-colors px-2.5 py-1 rounded-lg hover:bg-subtle"
                title="导出为 Markdown 报告"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">导出研读报告</span>
              </button>
              <button
                onClick={onClearMessages}
                disabled={isStreaming}
                className="flex items-center gap-1 text-ink-500 hover:text-rose-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-rose-50"
                title="清空当前会话消息"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">清空上下文</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 消息滚动主区域 (Editorial Document Flow) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8 animate-fade-in py-12">
            <div className="w-12 h-12 rounded-2xl bg-ink-900 text-white flex items-center justify-center shadow-md">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ink-900 tracking-tight">
                {sessionTitle || 'RAG Studio 知识研读工作台'}
              </h2>
              <p className="text-xs text-ink-500 leading-relaxed max-w-md mx-auto">
                已挂载目标知识库：<strong className="text-ink-900 font-semibold">{selectedKB || '请先在左侧选择知识库'}</strong>。<br />
                支持多文档关联、表格解析、标题层级面包屑注入与严密防幻觉生成。
              </p>
            </div>

            {/* 快速探索卡片 */}
            <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(q)}
                  className="p-3.5 rounded-xl bg-surface border border-border hover:border-stone-400 text-xs font-medium text-ink-900 hover:text-ink-900 transition-all shadow-card hover:shadow-float flex items-start justify-between group text-left"
                >
                  <span className="leading-relaxed pr-2">{q}</span>
                  <ArrowUpRight className="w-4 h-4 text-ink-400 group-hover:text-ink-900 flex-shrink-0 mt-0.5 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const hasRefs = message.references && message.references.length > 0;

              return (
                <div key={message.id} className="space-y-3 animate-fade-in">
                  {/* 用户提问渲染为典雅的章节标题 */}
                  {isUser ? (
                    <div className="pt-4 border-t border-border/80 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between text-[11px] font-mono text-ink-400 uppercase tracking-wider mb-1.5">
                        <span>提问</span>
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
                      <div className="flex items-center justify-between pb-3.5 border-b border-border text-xs">
                        <div className="flex items-center space-x-2 text-ink-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-medium">
                            {hasRefs ? '已依据私域文档精准检索确认' : '通用逻辑回应'}
                          </span>
                        </div>
                        {hasRefs && (
                          <button
                            onClick={() => onOpenCitation(message.references![0].ref_id, message.references)}
                            className="flex items-center space-x-1 text-xs font-semibold text-ink-900 hover:text-stone-600 transition-colors cursor-pointer"
                          >
                            <span>查看 {message.references!.length} 处引用源</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Markdown 正文 */}
                      <div className="markdown-body">
                        {renderMessageContent(message.content, message.references)}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-ink-900 animate-pulse ml-1 align-middle" />
                        )}
                      </div>

                      {/* 底部动作工具栏 */}
                      <div className="pt-3.5 border-t border-border flex items-center justify-between text-xs text-ink-500">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="hover:text-ink-900 flex items-center space-x-1 transition-colors"
                          >
                            {copiedId === message.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700">已复制</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>复制回答</span>
                              </>
                            )}
                          </button>
                        </div>
                        <span className="font-mono text-[11px]">
                          {message.isStreaming ? '正在生成中...' : '已完成'}
                        </span>
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

      {/* 底部悬浮极简指令输入坞 (Floating Studio Command Dock) */}
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
                <span className="font-mono text-[11px]">Shift + Enter 换行</span>
                <span>·</span>
                <span className="font-mono text-[11px]">Enter 发送</span>
              </div>

              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStopGeneration}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm transition-all"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>停止生成</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="bg-ink-900 hover:bg-accent-hover disabled:opacity-40 disabled:pointer-events-none text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <span>提问</span>
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="text-center text-[11px] text-ink-400 mt-2 font-serif italic">
            严谨可信问答 · 每一处事实均由 BGE-Reranker 交叉注意力验证
          </div>
        </div>
      </div>
    </div>
  );
};
