import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Upload, 
  Trash2, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Loader2,
  MessageSquare,
  Edit3,
  Search,
  X
} from 'lucide-react';
import type { KnowledgeBase, ChatSession } from '../types';
import { api } from '../services/api';

interface SidebarProps {
  knowledgeBases: KnowledgeBase[];
  selectedKB: string;
  onSelectKB: (kb_name: string) => void;
  onRefreshKBs: () => void;
  onOpenChunkModal: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onClearSessions: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  onWidthChange?: (newWidth: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  knowledgeBases,
  selectedKB,
  onSelectKB,
  onRefreshKBs,
  onOpenChunkModal,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onClearSessions,
  isCollapsed = false,
  onToggleCollapse,
  width = 288,
  onWidthChange,
}) => {
  // KB Manager Modal State
  const [isKBModalOpen, setIsKBModalOpen] = useState(false);
  const [isCreatingKB, setIsCreatingKB] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDesc, setNewKBDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session Search & Rename State
  const [sessionSearch, setSessionSearch] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Drag Resizing State
  const isResizingRef = useRef(false);

  const currentKB = knowledgeBases.find((k) => k.kb_name === selectedKB);

  // Global shortcut: ⌘K or Ctrl+K to create a new session; ⌘B or Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onCreateSession();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && onToggleCollapse) {
        e.preventDefault();
        onToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateSession, onToggleCollapse]);

  // Handle Drag Resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current || !onWidthChange) return;
      onWidthChange(moveEvent.clientX);
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions;
    const q = sessionSearch.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sessionSearch]);

  // Group sessions by Today vs Earlier
  const { todaySessions, earlierSessions } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const todayList: ChatSession[] = [];
    const earlierList: ChatSession[] = [];

    filteredSessions.forEach((s) => {
      if (s.updated_at >= todayTimestamp) {
        todayList.push(s);
      } else {
        earlierList.push(s);
      }
    });

    return { todaySessions: todayList, earlierSessions: earlierList };
  }, [filteredSessions]);

  const handleCreateKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKBName.trim()) return;

    try {
      await api.createKnowledgeBase(newKBName.trim(), newKBDesc.trim());
      setIsCreatingKB(false);
      setNewKBName('');
      setNewKBDesc('');
      onRefreshKBs();
      onSelectKB(newKBName.trim());
    } catch (err: any) {
      alert(err.message || '创建知识库失败');
    }
  };

  const handleDeleteKB = async (kb_name: string) => {
    if (!confirm(`确定要删除知识库 "${kb_name}" 及其全部索引数据吗？`)) return;
    try {
      await api.deleteKnowledgeBase(kb_name);
      onRefreshKBs();
      if (selectedKB === kb_name) {
        const remaining = knowledgeBases.filter((k) => k.kb_name !== kb_name);
        if (remaining.length > 0) {
          onSelectKB(remaining[0].kb_name);
        } else {
          onSelectKB('');
        }
      }
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!selectedKB) {
      alert('请先选择或创建一个知识库！');
      return;
    }
    const fileArray = Array.from(files).filter((f) => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.docx') || ext.endsWith('.txt') || ext.endsWith('.md');
    });

    if (fileArray.length === 0) {
      setUploadMessage({ text: '仅支持上传 .docx, .txt, .md 文件', type: 'error' });
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const resList = await api.uploadDocuments(selectedKB, fileArray);
      const totalChunks = resList.reduce((acc: number, curr: any) => acc + (curr.chunk_count || 0), 0);
      const failed = resList.filter((r: any) => (r.chunk_count || 0) === 0);

      if (failed.length > 0 && totalChunks === 0) {
        setUploadMessage({
          text: `导入未生成有效切片：${failed.map((f: any) => f.message || '未知原因').join('; ')}`,
          type: 'error',
        });
      } else if (failed.length > 0) {
        setUploadMessage({
          text: `部分导入成功 (${totalChunks} 切片)，但有 ${failed.length} 个文档未生成切片：${failed.map((f: any) => f.file_name + ' (' + f.message + ')').join('; ')}`,
          type: 'error',
        });
      } else {
        setUploadMessage({
          text: `成功导入 ${fileArray.length} 个文档，生成 ${totalChunks} 个有效切片！`,
          type: 'success',
        });
      }
      onRefreshKBs();
    } catch (err: any) {
      setUploadMessage({ text: err.message || '上传处理失败', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      onRenameSession(id, editingTitle.trim());
    }
    setEditingSessionId(null);
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <>
      <aside 
        style={{ width: `${width}px` }}
        className="relative bg-paper border-r border-border flex flex-col justify-between select-none flex-shrink-0 z-20 h-[calc(100vh-3.5rem)] transition-all duration-75"
      >
        
        {/* 顶部区域：新建对话与知识库卡片 */}
        <div className="p-4 space-y-4">
          
          {/* 新建研读对话主按钮 */}
          <button
            onClick={onCreateSession}
            className="w-full bg-surface hover:bg-subtle text-ink-900 border border-border rounded-xl py-2 px-3 text-xs font-semibold flex items-center justify-center gap-2 shadow-card hover:border-stone-400 transition-all group"
          >
            <Plus className="w-4 h-4 text-ink-700 group-hover:text-ink-900 transition-transform group-hover:rotate-90" />
            <span>新建研读对话</span>
          </button>

          {/* 挂载知识库卡片 */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-500 uppercase tracking-wider mb-2">
              <span>挂载知识库</span>
              <button 
                onClick={() => setIsKBModalOpen(true)}
                className="text-ink-700 hover:text-ink-900 font-semibold transition-colors flex items-center gap-1"
                title="管理知识库与上传文档"
              >
                <span>管理</span>
              </button>
            </div>

            {currentKB ? (
              <div 
                onClick={() => setIsKBModalOpen(true)}
                className="bg-surface border border-border hover:border-stone-400 rounded-xl p-3 shadow-card space-y-2 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0"></span>
                    <span className="text-xs font-semibold text-ink-900 truncate group-hover:text-stone-700">
                      {currentKB.kb_name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-ink-700 bg-subtle px-1.5 py-0.5 rounded border border-border flex-shrink-0">
                    {currentKB.chunk_count} 切片
                  </span>
                </div>
                <div className="text-[11px] text-ink-500 flex justify-between items-center pt-1 border-t border-border/60">
                  <span className="font-mono text-[10px]">NumPy + BM25</span>
                  <span className="text-emerald-700 font-mono text-[10px] font-semibold">已就绪</span>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setIsKBModalOpen(true)}
                className="bg-surface border border-dashed border-border rounded-xl p-3 text-center text-xs text-ink-500 cursor-pointer hover:border-stone-400"
              >
                暂无挂载知识库，点击添加
              </div>
            )}
          </div>

          {/* 会话搜索框 */}
          <div className="pt-1">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="搜索研读历史..."
                className="w-full bg-surface border border-border text-xs text-ink-900 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-stone-400 placeholder:text-ink-400 shadow-card"
              />
            </div>
          </div>

        </div>

        {/* 中部：历史对话列表 */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3 min-h-0">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">
              近期研读记录
            </span>
            {sessions.length > 0 && (
              <button
                onClick={onClearSessions}
                className="text-[10px] text-ink-400 hover:text-rose-600 transition-colors"
                title="清空当前知识库的所有会话记录"
              >
                清空
              </button>
            )}
          </div>

          {filteredSessions.length === 0 ? (
            <div className="text-center py-6 text-ink-400 text-xs font-serif italic">
              {sessionSearch ? '未搜索到相关会话' : '暂无对话，点击上方新建'}
            </div>
          ) : (
            <div className="space-y-1">
              {todaySessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  isEditing={s.id === editingSessionId}
                  editTitle={editingTitle}
                  setEditTitle={setEditingTitle}
                  onSelect={() => onSelectSession(s.id)}
                  onStartRename={(e) => {
                    e.stopPropagation();
                    setEditingSessionId(s.id);
                    setEditingTitle(s.title);
                  }}
                  onSaveRename={() => handleSaveRename(s.id)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                />
              ))}

              {earlierSessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  isEditing={s.id === editingSessionId}
                  editTitle={editingTitle}
                  setEditTitle={setEditingTitle}
                  onSelect={() => onSelectSession(s.id)}
                  onStartRename={(e) => {
                    e.stopPropagation();
                    setEditingSessionId(s.id);
                    setEditingTitle(s.title);
                  }}
                  onSaveRename={() => handleSaveRename(s.id)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部：用户信息与状态栏 */}
        <div className="p-3 border-t border-border bg-paper/60 space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-stone-300 flex items-center justify-center text-[10px] font-bold text-ink-700">
                LQ
              </div>
              <span className="text-xs font-semibold text-ink-900">工程研究员</span>
            </div>
            <span className="text-[11px] font-mono text-ink-500">v1.2.0</span>
          </div>
        </div>

        {/* 侧边拖拽调节宽度把手 (Resizable Drag Handle) */}
        {onWidthChange && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-stone-400/30 active:bg-stone-900/40 transition-colors z-30 group flex items-center justify-center"
            title="左右拖拽调节侧边栏宽度"
          >
            <div className="w-0.5 h-6 bg-stone-300 group-hover:bg-stone-600 rounded-full transition-colors opacity-0 group-hover:opacity-100" />
          </div>
        )}
      </aside>

      {/* ========================================================================= */}
      {/* 知识库管理与文档上传全功能模态框 (KB & Document Manager Modal) */}
      {/* ========================================================================= */}
      {isKBModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-popover overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-paper/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-ink-900 text-white flex items-center justify-center shadow-sm">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-ink-900">知识库与文档管理中心</h3>
                  <p className="text-[11px] text-ink-500 font-mono">切换目标知识库、上传切片文档或预览索引状态</p>
                </div>
              </div>
              <button
                onClick={() => setIsKBModalOpen(false)}
                className="p-1 rounded-lg hover:bg-subtle text-ink-400 hover:text-ink-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* 1. 知识库选择与新建 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink-700 uppercase tracking-wider">
                    知识库列表 ({knowledgeBases.length})
                  </label>
                  <button
                    onClick={() => setIsCreatingKB(!isCreatingKB)}
                    className="text-xs font-semibold text-ink-900 hover:text-accent-hover flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新建知识库</span>
                  </button>
                </div>

                {isCreatingKB && (
                  <form onSubmit={handleCreateKB} className="p-4 rounded-xl bg-paper border border-border space-y-3 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                          知识库标识 (英文/拼音) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="例如: tech_manuals"
                          value={newKBName}
                          onChange={(e) => setNewKBName(e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-ink-900 focus:outline-none focus:border-stone-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-700 mb-1">描述（可选）</label>
                        <input
                          type="text"
                          placeholder="例如: 核心系统规程"
                          value={newKBDesc}
                          onChange={(e) => setNewKBDesc(e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-ink-900 focus:outline-none focus:border-stone-400"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingKB(false)}
                        className="px-3 py-1 text-xs text-ink-500 hover:text-ink-900"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1 text-xs font-semibold bg-ink-900 text-white rounded-lg hover:bg-accent-hover shadow-sm"
                      >
                        确认创建
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {knowledgeBases.map((kb) => (
                    <div
                      key={kb.kb_name}
                      onClick={() => onSelectKB(kb.kb_name)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedKB === kb.kb_name
                          ? 'border-ink-900 bg-paper shadow-card ring-1 ring-ink-900'
                          : 'border-border bg-surface hover:border-stone-400 shadow-card'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${selectedKB === kb.kb_name ? 'bg-emerald-600' : 'bg-stone-300'}`} />
                          <span className="font-semibold text-xs text-ink-900 truncate">{kb.kb_name}</span>
                        </div>
                        <p className="text-[11px] text-ink-500 font-mono mt-0.5">{kb.chunk_count} 个切片</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {selectedKB === kb.kb_name && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsKBModalOpen(false);
                              onOpenChunkModal();
                            }}
                            className="p-1.5 rounded-lg bg-subtle hover:bg-stone-200 text-ink-700 text-xs flex items-center gap-1 transition-colors"
                            title="切片预览"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteKB(kb.kb_name);
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-ink-400 hover:text-rose-600 transition-colors"
                          title="删除知识库"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. 当前选中知识库的文档上传 */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-ink-700 uppercase tracking-wider">
                    向「<strong className="text-ink-900 font-mono">{selectedKB || '未选择'}</strong>」上传并切片文档
                  </h4>
                  {currentKB && currentKB.chunk_count > 0 && (
                    <button
                      onClick={() => {
                        setIsKBModalOpen(false);
                        onOpenChunkModal();
                      }}
                      className="text-xs font-semibold text-ink-900 hover:underline flex items-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>查看当前切片明细</span>
                    </button>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) {
                      handleFileUpload(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-ink-900 bg-subtle'
                      : 'border-border hover:border-stone-400 bg-paper/60 hover:bg-paper shadow-card'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFileUpload(e.target.files);
                      }
                    }}
                  />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 py-3">
                      <Loader2 className="w-6 h-6 text-ink-900 animate-spin" />
                      <p className="text-xs text-ink-900 font-semibold">正在解析 Word/Markdown 结构并生成向量...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-ink-700 shadow-card border border-border">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-ink-900">点击或拖拽文件到此处完成切片入库</p>
                        <p className="text-[11px] text-ink-400 mt-0.5 font-mono">支持 Word (.docx), Markdown (.md), 文本 (.txt)</p>
                      </div>
                    </>
                  )}
                </div>

                {uploadMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 animate-fade-in ${
                      uploadMessage.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {uploadMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                    )}
                    <span className="leading-relaxed">{uploadMessage.text}</span>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border bg-paper/50 flex items-center justify-between text-xs text-ink-500">
              <span className="font-mono text-[11px]">BGE-M3 + BGE-Reranker-v2</span>
              <button
                onClick={() => setIsKBModalOpen(false)}
                className="px-4 py-1.5 rounded-xl font-semibold bg-ink-900 text-white hover:bg-accent-hover shadow-sm transition-all"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSelect: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSaveRename: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  onSelect,
  onStartRename,
  onSaveRename,
  onDelete,
}) => {
  const timeStr = new Date(session.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      onClick={onSelect}
      className={`px-2.5 py-2 rounded-xl cursor-pointer transition-all flex items-center justify-between group text-xs ${
        isActive
          ? 'bg-surface border border-border text-ink-900 font-semibold shadow-card'
          : 'hover:bg-subtle text-ink-700 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
        <MessageSquare
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isActive ? 'text-ink-900' : 'text-ink-400 group-hover:text-ink-700'
          }`}
        />
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={onSaveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveRename();
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-paper border border-stone-400 text-ink-900 rounded px-1.5 py-0.5 text-xs focus:outline-none"
          />
        ) : (
          <span className="truncate font-medium text-ink-900">{session.title}</span>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-mono text-ink-400 group-hover:hidden">{timeStr}</span>
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={onStartRename}
              className="p-1 rounded hover:bg-stone-200 text-ink-400 hover:text-ink-900 transition-colors"
              title="重命名会话"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-rose-100 text-ink-400 hover:text-rose-600 transition-colors"
              title="删除会话"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
