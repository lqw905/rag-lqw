import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Upload, 
  Trash2, 
  Layers, 
  Database,
  Loader2,
  MessageSquare,
  Edit3,
  Search,
  X,
  ChevronDown
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
  // Inline KB Create State
  const [isCreatingKB, setIsCreatingKB] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDesc, setNewKBDesc] = useState('');

  // KB List Collapsible State (默认收起)
  const [isKBListCollapsed, setIsKBListCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('rag_kblist_collapsed');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleKBList = () => {
    setIsKBListCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('rag_kblist_collapsed', String(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [targetUploadKB, setTargetUploadKB] = useState<string | null>(null);
  const [dragOverKB, setDragOverKB] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session Search & Rename State
  const [sessionSearch, setSessionSearch] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Drag Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

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
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let lastWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current || !onWidthChange) return;
      lastWidth = moveEvent.clientX;
      onWidthChange(lastWidth);
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      try {
        const clamped = Math.max(220, Math.min(480, lastWidth));
        localStorage.setItem('rag_sidebar_width', String(clamped));
      } catch (err) {
        console.error(err);
      }
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
      const createdName = newKBName.trim();
      setNewKBName('');
      setNewKBDesc('');
      onRefreshKBs();
      onSelectKB(createdName);
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

  const triggerUploadForKB = (kb_name: string) => {
    setTargetUploadKB(kb_name);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (files: FileList | File[], targetKB?: string) => {
    const activeKB = targetKB || targetUploadKB || selectedKB;
    if (!activeKB) {
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
      const resList = await api.uploadDocuments(activeKB, fileArray);
      const totalChunks = resList.reduce((acc: number, curr: any) => acc + (curr.chunk_count || 0), 0);
      const failed = resList.filter((r: any) => (r.chunk_count || 0) === 0);

      if (failed.length > 0 && totalChunks === 0) {
        setUploadMessage({
          text: `导入未生成有效切片：${failed.map((f: any) => f.message || '未知原因').join('; ')}`,
          type: 'error',
        });
      } else if (failed.length > 0) {
        setUploadMessage({
          text: `部分成功 (${totalChunks} 切片)，${failed.length} 个未切片：${failed.map((f: any) => f.file_name).join('; ')}`,
          type: 'error',
        });
      } else {
        setUploadMessage({
          text: `成功向「${activeKB}」导入 ${fileArray.length} 个文档 (${totalChunks} 切片)！`,
          type: 'success',
        });
      }
      onRefreshKBs();
    } catch (err: any) {
      setUploadMessage({ text: err.message || '上传处理失败', type: 'error' });
    } finally {
      setIsUploading(false);
      setTargetUploadKB(null);
    }
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      onRenameSession(id, editingTitle.trim());
    }
    setEditingSessionId(null);
  };

  return (
    <>
      <aside 
        style={{ 
          width: isCollapsed ? 0 : `${width}px`,
          borderRightWidth: isCollapsed ? 0 : '1px',
          opacity: isCollapsed ? 0 : 1
        }}
        className={`relative bg-paper border-border flex-shrink-0 z-20 h-[calc(100vh-3rem)] overflow-hidden ${
          isResizing ? 'select-none' : 'transition-[width,opacity] duration-300 ease-in-out'
        }`}
      >
        <div style={{ width: isCollapsed ? `${width}px` : '100%' }} className="flex flex-col justify-between h-full">
        
          {/* 上半部分：知识库管理与会话搜索区 */}
          <div className="p-3.5 space-y-3.5 flex-shrink-0 border-b border-border/80">
            
            {/* 1. 知识库列表区域 */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-ink-500 uppercase tracking-wider mb-2">
                <button
                  type="button"
                  onClick={handleToggleKBList}
                  className="flex items-center gap-1.5 hover:text-ink-900 transition-colors cursor-pointer group text-left max-w-[calc(100%-4rem)] truncate"
                  title={isKBListCollapsed ? '点击展开完整知识库列表' : '点击收起知识库列表'}
                >
                  <ChevronDown className={`w-3.5 h-3.5 text-ink-400 group-hover:text-ink-900 transition-transform duration-200 shrink-0 ${isKBListCollapsed ? '-rotate-90' : ''}`} />
                  <Database className="w-3.5 h-3.5 text-ink-700 shrink-0" />
                  <span className="font-semibold text-ink-700 shrink-0">知识库</span>
                  
                  {/* 收起状态下，直接在文字旁边展示当前使用的知识库 Tag 胶囊 */}
                  {isKBListCollapsed && selectedKB ? (
                    <span className="inline-flex items-center gap-1 bg-surface text-ink-900 border border-border px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium truncate shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 animate-pulse-subtle" />
                      <span className="truncate max-w-[90px]">{selectedKB}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-normal text-ink-400">({knowledgeBases.length})</span>
                  )}
                </button>
                <button 
                  onClick={() => {
                    if (isKBListCollapsed) setIsKBListCollapsed(false);
                    setIsCreatingKB(!isCreatingKB);
                  }}
                  className="text-ink-700 hover:text-ink-900 font-semibold transition-all flex items-center gap-1 p-1 rounded hover:bg-subtle cursor-pointer shrink-0"
                  title="新建知识库"
                >
                  <Plus className={`w-3.5 h-3.5 transition-transform ${isCreatingKB ? 'rotate-45' : ''}`} />
                  <span className="text-xs">新建</span>
                </button>
              </div>

              {/* 行内快速新建知识库表单 */}
              {isCreatingKB && (
                <form onSubmit={handleCreateKB} className="p-2.5 rounded-xl bg-surface border border-border space-y-2 mb-2 shadow-card animate-fade-in">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="知识库标识 (英文/拼音)..."
                    value={newKBName}
                    onChange={(e) => setNewKBName(e.target.value)}
                    className="w-full bg-paper border border-border rounded-lg px-2.5 py-1 text-xs text-ink-900 focus:outline-none focus:border-stone-500 placeholder:text-ink-400"
                  />
                  <input
                    type="text"
                    placeholder="描述说明 (可选)..."
                    value={newKBDesc}
                    onChange={(e) => setNewKBDesc(e.target.value)}
                    className="w-full bg-paper border border-border rounded-lg px-2.5 py-1 text-[11px] text-ink-900 focus:outline-none focus:border-stone-500 placeholder:text-ink-400"
                  />
                  <div className="flex justify-end gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingKB(false)}
                      className="px-2 py-0.5 text-[11px] text-ink-500 hover:text-ink-900"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-0.5 text-[11px] font-semibold bg-ink-900 text-white rounded-md hover:bg-accent-hover shadow-xs transition-colors"
                    >
                      创建
                    </button>
                  </div>
                </form>
              )}

              {/* 仅在展开态展示全部知识库直列项 */}
              {!isKBListCollapsed && (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5 animate-fade-in">
                  {knowledgeBases.length === 0 ? (
                    <div 
                      onClick={() => setIsCreatingKB(true)}
                      className="bg-surface border border-dashed border-border rounded-xl px-3 py-3 text-center text-xs text-ink-500 cursor-pointer hover:border-stone-400 transition-colors"
                    >
                      + 点击新建首个知识库
                    </div>
                  ) : (
                    knowledgeBases.map((kb) => {
                      const isSelected = selectedKB === kb.kb_name;
                      const isDragged = dragOverKB === kb.kb_name;
                      return (
                        <div
                          key={kb.kb_name}
                          onClick={() => onSelectKB(kb.kb_name)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverKB(kb.kb_name);
                          }}
                          onDragLeave={() => setDragOverKB(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverKB(null);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              onSelectKB(kb.kb_name);
                              handleFileUpload(e.dataTransfer.files, kb.kb_name);
                            }
                          }}
                          className={`group/kb rounded-xl px-2.5 py-2 transition-all cursor-pointer flex items-center justify-between border ${
                            isDragged
                              ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                              : isSelected
                              ? 'bg-surface border-border shadow-card ring-1 ring-ink-900/10'
                              : 'bg-transparent border-transparent hover:bg-subtle/70 text-ink-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate flex-1 min-w-0 pr-1">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-emerald-600' : 'bg-stone-300'}`} />
                            <span className={`text-xs truncate ${isSelected ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                              {kb.kb_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* 默认常驻切片数量，Hover 时切换为快捷操作按钮 */}
                            <span className="text-[10px] font-mono text-ink-500 bg-subtle px-1.5 py-0.5 rounded border border-border/80 group-hover/kb:hidden">
                              {kb.chunk_count} 切片
                            </span>

                            <div className="hidden group-hover/kb:flex items-center gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerUploadForKB(kb.kb_name);
                                }}
                                className="p-1 rounded hover:bg-stone-200 text-ink-500 hover:text-ink-900 transition-colors"
                                title={`向 ${kb.kb_name} 上传文档 (.docx/.md/.txt)`}
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                              {kb.chunk_count > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectKB(kb.kb_name);
                                    onOpenChunkModal();
                                  }}
                                  className="p-1 rounded hover:bg-stone-200 text-ink-500 hover:text-ink-900 transition-colors"
                                  title="切片透视预览"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteKB(kb.kb_name);
                                }}
                                className="p-1 rounded hover:bg-rose-100 text-ink-400 hover:text-rose-600 transition-colors"
                                title="删除知识库"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* 上传解析反馈与提示 */}
              {isUploading && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-subtle text-xs text-ink-700 animate-pulse border border-border">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-900 shrink-0" />
                  <span className="truncate">正在解析并生成双路向量/稀疏索引...</span>
                </div>
              )}

              {uploadMessage && (
                <div className={`mt-2 p-2 rounded-lg text-xs flex items-center justify-between border ${
                  uploadMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <span className="truncate pr-1">{uploadMessage.text}</span>
                  <button onClick={() => setUploadMessage(null)} className="text-current opacity-60 hover:opacity-100 shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* 2. 搜索与新建对话 */}
            <div className="pt-1 flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="搜索研读历史..."
                  className="w-full bg-surface border border-border text-xs text-ink-900 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-stone-400 placeholder:text-ink-400 shadow-card"
                />
              </div>
              <button
                onClick={onCreateSession}
                className="flex items-center justify-center bg-surface hover:bg-subtle border border-border rounded-lg p-1.5 shrink-0 shadow-card hover:border-stone-400 transition-all group"
                title="新建当前库的研读对话"
              >
                <Plus className="w-4 h-4 text-ink-700 group-hover:text-ink-900 transition-transform group-hover:rotate-90" />
              </button>
            </div>

          </div>

          {/* 中部：选中知识库的历史对话列表 */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
            <div className="flex items-center justify-between px-1">
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
              <div className="text-center py-8 text-ink-400 text-xs font-serif italic">
                {sessionSearch ? '未搜索到相关会话' : '暂无对话，点击上方「+」新建'}
              </div>
            ) : (
              <div className="space-y-1">
                {todaySessions.length > 0 && (
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
                  </div>
                )}

                {earlierSessions.length > 0 && (
                  <div className="space-y-1 pt-2">
                    <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-1">
                      更早之前
                    </div>
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
            )}
          </div>

          {/* 底部：用户信息与状态栏 */}
          <div className="p-3 border-t border-border bg-paper flex items-center justify-between text-xs text-ink-500 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-stone-300 flex items-center justify-center text-[10px] font-bold text-ink-700">
                LQ
              </div>
              <span className="text-xs font-semibold text-ink-900">工程研究员</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              MCP READY
            </span>
          </div>

        </div>

        {/* 侧边隐形极细调节把手 (Delicate Hairline Resizer) */}
        {onWidthChange && !isCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute -right-[3px] top-0 bottom-0 w-[6px] cursor-col-resize z-30 group"
            title="左右拖拽调节侧边栏宽度"
          >
            <div
              className={`w-[2px] h-full mx-auto transition-colors duration-150 ${
                isResizing
                  ? 'bg-stone-500 opacity-100'
                  : 'bg-stone-400/60 opacity-0 group-hover:opacity-100'
              }`}
            />
          </div>
        )}
      </aside>

      {/* 隐藏的文件上传 input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files, targetUploadKB || selectedKB);
          }
        }}
      />
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
