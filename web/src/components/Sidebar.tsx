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
  SlidersHorizontal,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Check,
  BookOpen,
  PanelLeft
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
  onOpenPlaygroundModal: () => void;
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
  onOpenPlaygroundModal,
  isCollapsed = false,
  onToggleCollapse,
  width = 288,
  onWidthChange,
}) => {
  // Knowledge Base Hub Modal State (居中卡片式管理中心)
  const [isKBHubModalOpen, setIsKBHubModalOpen] = useState(false);
  const [kbFilterQuery, setKbFilterQuery] = useState('');

  // Create KB Modal State
  const [isCreateKBModalOpen, setIsCreateKBModalOpen] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDesc, setNewKBDesc] = useState('');
  const [createKBFiles, setCreateKBFiles] = useState<File[]>([]);
  const [isCreateDragging, setIsCreateDragging] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  // Dedicated Upload Modal State (for existing KBs)
  const [uploadModalKB, setUploadModalKB] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const dedicatedFileInputRef = useRef<HTMLInputElement>(null);

  // Dedicated Spotlight Search Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Submitting / Status feedback inside modals
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Quick drag-and-drop state on hub cards
  const [dragOverKB, setDragOverKB] = useState<string | null>(null);

  // Inline Session Rename State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Drag Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  // Global shortcuts:
  // - ⌘K / Ctrl+K: 新建对话
  // - ⌘F / Ctrl+F / ⌘P: 打开对话搜索页面
  // - ⌘B / Ctrl+B: 收起/展开侧边栏
  // - Escape: 关闭任何打开的模态卡片
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isKBHubModalOpen) setIsKBHubModalOpen(false);
        if (isSearchModalOpen) setIsSearchModalOpen(false);
        if (isCreateKBModalOpen) setIsCreateKBModalOpen(false);
        if (uploadModalKB) setUploadModalKB(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onCreateSession();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setSearchModalQuery('');
        setIsSearchModalOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && onToggleCollapse) {
        e.preventDefault();
        onToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateSession, onToggleCollapse, isCreateKBModalOpen, uploadModalKB, isSearchModalOpen, isKBHubModalOpen]);

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

  // Format date helper for search list and recent sessions
  const formatFriendlyDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;

    if (timestamp >= today) {
      return '今天';
    } else if (timestamp >= yesterday) {
      return '昨天';
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  };

  // Filtered sessions for the search modal
  const modalFilteredSessions = useMemo(() => {
    if (!searchModalQuery.trim()) return sessions;
    const q = searchModalQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchModalQuery]);

  // Filtered Knowledge Bases for the Hub modal
  const filteredKBs = useMemo(() => {
    if (!kbFilterQuery.trim()) return knowledgeBases;
    const q = kbFilterQuery.toLowerCase();
    return knowledgeBases.filter((k) => 
      k.kb_name.toLowerCase().includes(q) || 
      (k.description && k.description.toLowerCase().includes(q))
    );
  }, [knowledgeBases, kbFilterQuery]);

  // Filter supported files helper
  const filterSupportedFiles = (files: FileList | File[]) => {
    return Array.from(files).filter((f) => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.docx') || ext.endsWith('.txt') || ext.endsWith('.md');
    });
  };

  // Handle Create KB (with optional initial files)
  const handleCreateKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKBName.trim()) return;

    setIsSubmitting(true);
    setModalFeedback(null);

    try {
      const kbName = newKBName.trim();
      await api.createKnowledgeBase(kbName, newKBDesc.trim());

      if (createKBFiles.length > 0) {
        await api.uploadDocuments(kbName, createKBFiles);
      }

      onRefreshKBs();
      onSelectKB(kbName);

      setNewKBName('');
      setNewKBDesc('');
      setCreateKBFiles([]);
      setIsCreateKBModalOpen(false);
    } catch (err: any) {
      setModalFeedback({ text: err.message || '创建知识库失败', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Dedicated Upload to an existing KB
  const handleDedicatedUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModalKB) return;
    if (uploadFiles.length === 0) {
      setModalFeedback({ text: '请先选择要上传的文档文件', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setModalFeedback(null);

    try {
      const resList = await api.uploadDocuments(uploadModalKB, uploadFiles);
      const totalChunks = resList.reduce((acc: number, curr: any) => acc + (curr.chunk_count || 0), 0);
      const failed = resList.filter((r: any) => (r.chunk_count || 0) === 0);

      if (failed.length > 0 && totalChunks === 0) {
        setModalFeedback({
          text: `未生成有效切片：${failed.map((f: any) => f.message || '未知原因').join('; ')}`,
          type: 'error',
        });
      } else {
        setModalFeedback({
          text: `成功导入 ${uploadFiles.length} 个文档，生成 ${totalChunks} 个有效索引切片！`,
          type: 'success',
        });
        onRefreshKBs();
        setTimeout(() => {
          setUploadFiles([]);
          setUploadModalKB(null);
          setModalFeedback(null);
        }, 1200);
      }
    } catch (err: any) {
      setModalFeedback({ text: err.message || '上传处理失败', type: 'error' });
    } finally {
      setIsSubmitting(false);
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
        className={`relative bg-paper border-border flex-shrink-0 z-20 h-screen overflow-hidden ${
          isResizing ? 'select-none' : 'transition-[width,opacity] duration-300 ease-in-out'
        }`}
      >
        <div style={{ width: isCollapsed ? `${width}px` : '100%' }} className="flex flex-col justify-between h-full">
        
          {/* 侧边栏顶端：品牌 Logo 与折叠按钮 (h-11) */}
          <div className="h-11 px-3 flex items-center justify-between border-b border-border/80 flex-shrink-0 select-none">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-ink-900 flex items-center justify-center text-white shadow-xs">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-xs text-ink-900 tracking-tight">RAG Studio</span>
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-subtle transition-colors cursor-pointer"
                title="收起侧边栏 (Ctrl+B)"
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 顶部主指令列表（4 大统一、等高、无内嵌折叠的标准单行条目） */}
          <div className="p-2.5 space-y-0.5 flex-shrink-0 border-b border-border/80">
            
            {/* 1. 知识库统一条目 (固定 h-9 等高，点击唤出居中知识库管理中心卡片) */}
            <button
              type="button"
              onClick={() => {
                setKbFilterQuery('');
                setIsKBHubModalOpen(true);
              }}
              className="h-9 w-full px-2.5 rounded-lg flex items-center justify-between text-xs font-medium text-ink-700 hover:text-ink-900 hover:bg-subtle border border-transparent transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                <Database className="w-4 h-4 text-ink-500 group-hover:text-ink-900 shrink-0 transition-colors" />
                <span>知识库</span>
                {selectedKB && (
                  <span className="inline-flex items-center gap-1 bg-subtle text-ink-900 border border-border/80 px-1.5 h-5 rounded text-[10px] font-mono font-medium truncate shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                    <span className="truncate max-w-[80px]">{selectedKB}</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1">HUB</span>
            </button>

            {/* 2. 发起新对话统一条目 (固定 h-9 等高) */}
            <button
              type="button"
              onClick={onCreateSession}
              className="h-9 w-full px-2.5 rounded-lg flex items-center justify-between text-xs font-medium text-ink-700 hover:text-ink-900 hover:bg-subtle border border-transparent transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Edit3 className="w-4 h-4 text-ink-500 group-hover:text-ink-900 shrink-0 transition-colors" />
                <span>发起新对话</span>
              </div>
              <span className="text-[10px] font-mono text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1">⌘K</span>
            </button>

            {/* 3. 搜索对话内容统一条目 (固定 h-9 等高，点击唤出居中搜索页面) */}
            <button
              type="button"
              onClick={() => {
                setSearchModalQuery('');
                setIsSearchModalOpen(true);
              }}
              className="h-9 w-full px-2.5 rounded-lg flex items-center justify-between text-xs font-medium text-ink-700 hover:text-ink-900 hover:bg-subtle border border-transparent transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Search className="w-4 h-4 text-ink-500 group-hover:text-ink-900 shrink-0 transition-colors" />
                <span>搜索对话内容</span>
              </div>
              <span className="text-[10px] font-mono text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1">⌘F</span>
            </button>

            {/* 4. 检索实验台统一条目 (固定 h-9 等高，点击唤出居中卡片) */}
            <button
              type="button"
              onClick={onOpenPlaygroundModal}
              className="h-9 w-full px-2.5 rounded-lg flex items-center justify-between text-xs font-medium text-ink-700 hover:text-ink-900 hover:bg-subtle border border-transparent transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 truncate">
                <SlidersHorizontal className="w-4 h-4 text-ink-500 group-hover:text-ink-900 shrink-0 transition-colors" />
                <span>检索实验台</span>
              </div>
              <span className="text-[10px] font-mono text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1">LAB</span>
            </button>

          </div>

          {/* 中部：历史对话列表（纯净平铺连续条目） */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">
                近期研读记录
              </span>
              {sessions.length > 0 && (
                <button
                  onClick={onClearSessions}
                  className="text-[10px] text-ink-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="清空当前知识库的所有会话记录"
                >
                  清空
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-8 text-ink-400 text-xs font-serif italic">
                暂无对话，点击上方「发起新对话」
              </div>
            ) : (
              <div className="space-y-0.5">
                {sessions.map((s) => (
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

        {/* 侧边隐形极细调节把手 */}
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

      {/* 📚 知识库管理中心模态卡片（Spotlight 风格） */}
      {isKBHubModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 p-4 bg-ink-900/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsKBHubModalOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[76vh] bg-paper border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
          >
            {/* 卡片头部 */}
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between flex-shrink-0 bg-surface/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-emerald-600 shadow-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">私域知识库管理中心 (Knowledge Hub)</h3>
                  <p className="text-[11px] text-ink-500">管理混合索引知识库、快速切换当前活跃库与追加导入文档</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setModalFeedback(null);
                    setIsCreateKBModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-ink-900 hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新建知识库</span>
                </button>
                <button
                  onClick={() => setIsKBHubModalOpen(false)}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink-900 hover:bg-subtle transition-colors cursor-pointer"
                  title="关闭 (ESC)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 搜索/过滤栏 */}
            <div className="p-3 border-b border-border/80 bg-paper">
              <div className="relative flex items-center bg-surface border border-border rounded-xl px-3 py-1.5 focus-within:border-stone-400 transition-colors shadow-xs">
                <Search className="w-3.5 h-3.5 text-ink-400 mr-2 shrink-0 pointer-events-none" />
                <input
                  type="text"
                  value={kbFilterQuery}
                  onChange={(e) => setKbFilterQuery(e.target.value)}
                  placeholder="搜索知识库名称或描述..."
                  className="w-full bg-transparent text-xs text-ink-900 placeholder:text-ink-400 focus:outline-none"
                />
                {kbFilterQuery && (
                  <button
                    onClick={() => setKbFilterQuery('')}
                    className="text-ink-400 hover:text-ink-900 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 知识库卡片列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredKBs.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-400 font-serif italic space-y-2">
                  <p>{kbFilterQuery ? `未找到与 “${kbFilterQuery}” 匹配的知识库` : '暂无知识库'}</p>
                  <button
                    onClick={() => {
                      setModalFeedback(null);
                      setIsCreateKBModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-surface border border-border text-ink-800 hover:bg-subtle text-xs font-semibold cursor-pointer"
                  >
                    + 点击创建首个私域知识库
                  </button>
                </div>
              ) : (
                filteredKBs.map((kb) => {
                  const isSelected = selectedKB === kb.kb_name;
                  const isDragged = dragOverKB === kb.kb_name;

                  return (
                    <div
                      key={kb.kb_name}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverKB(kb.kb_name);
                      }}
                      onDragLeave={() => setDragOverKB(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverKB(null);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          const validFiles = filterSupportedFiles(e.dataTransfer.files);
                          if (validFiles.length > 0) {
                            setUploadModalKB(kb.kb_name);
                            setUploadFiles(validFiles);
                            setModalFeedback(null);
                          }
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                        isDragged
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : isSelected
                          ? 'bg-surface border-border shadow-xs ring-1 ring-emerald-600/30'
                          : 'bg-surface/50 border-border hover:border-stone-400 hover:bg-surface'
                      }`}
                    >
                      {/* 左侧：活跃状态 & 基础信息 */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectKB(kb.kb_name);
                          }}
                          className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono flex items-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : 'bg-paper text-ink-600 hover:text-ink-900 border border-border hover:border-stone-400'
                          }`}
                          title={isSelected ? '当前正在使用的知识库' : '点击切换至此知识库'}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>当前使用</span>
                            </>
                          ) : (
                            <span>切换使用</span>
                          )}
                        </button>

                        <div className="space-y-0.5 truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-ink-900 font-mono">{kb.kb_name}</span>
                          </div>
                          <p className="text-[11px] text-ink-500 truncate">
                            {kb.description || '暂无描述信息'}
                          </p>
                        </div>
                      </div>

                      {/* 右侧：切片指标与快捷操作 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-ink-600 bg-paper px-2 py-1 rounded-lg border border-border">
                          {kb.chunk_count} 个切片
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectKB(kb.kb_name);
                              setUploadModalKB(kb.kb_name);
                              setUploadFiles([]);
                              setModalFeedback(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-paper hover:bg-subtle text-ink-700 hover:text-ink-900 border border-border text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="上传文档至此知识库"
                          >
                            <Upload className="w-3 h-3" />
                            <span>上传</span>
                          </button>

                          {kb.chunk_count > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectKB(kb.kb_name);
                                onOpenChunkModal();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-paper hover:bg-subtle text-ink-700 hover:text-ink-900 border border-border text-xs flex items-center gap-1 transition-colors cursor-pointer"
                              title="切片透视分析"
                            >
                              <Layers className="w-3 h-3" />
                              <span>透视</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteKB(kb.kb_name)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-ink-400 hover:text-rose-600 transition-colors cursor-pointer"
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
          </div>
        </div>
      )}

      {/* 🔍 全局居中搜索对话页面（Spotlight / Command Palette 风格） */}
      {isSearchModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 p-4 bg-ink-900/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsSearchModalOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-paper border border-border rounded-2xl p-5 shadow-2xl space-y-4 animate-scale-in"
          >
            {/* 顶端搜索输入框 */}
            <div className="relative flex items-center bg-surface border border-border rounded-xl px-3.5 py-2.5 shadow-xs focus-within:border-stone-400 transition-colors">
              <Search className="w-4 h-4 text-ink-400 mr-2.5 shrink-0 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                value={searchModalQuery}
                onChange={(e) => setSearchModalQuery(e.target.value)}
                placeholder="搜索对话内容..."
                className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
              {searchModalQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchModalQuery('')}
                  className="p-1 text-ink-400 hover:text-ink-900 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-[10px] font-mono text-ink-400 bg-subtle px-1.5 py-0.5 rounded border border-border">
                  ESC 关闭
                </span>
              )}
            </div>

            {/* 对话结果清单列表 */}
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
              <div className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider px-2 pt-1">
                {searchModalQuery ? `搜索结果 (${modalFilteredSessions.length})` : '近期对话'}
              </div>

              {modalFilteredSessions.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-400 font-serif italic">
                  未找到与 “{searchModalQuery}” 相关的对话记录
                </div>
              ) : (
                modalFilteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session.id);
                      setIsSearchModalOpen(false);
                    }}
                    className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs group ${
                      session.id === activeSessionId
                        ? 'bg-surface border border-border text-ink-900 font-semibold shadow-xs'
                        : 'hover:bg-subtle text-ink-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                      <MessageSquare className="w-4 h-4 text-ink-400 group-hover:text-ink-900 shrink-0" />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <span className="text-[11px] font-mono text-ink-400 shrink-0">
                      {formatFriendlyDate(session.updated_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. 居中新建知识库卡片（含内置文档上传区） */}
      {isCreateKBModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 p-4 bg-ink-900/40 backdrop-blur-xs animate-fade-in"
          onClick={() => {
            if (!isSubmitting) setIsCreateKBModalOpen(false);
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-paper border border-border rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-ink-900 shadow-xs">
                  <Database className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">新建私域知识库</h3>
                  <p className="text-[11px] text-ink-500">创建并导入文档以构建双路向量/稀疏索引</p>
                </div>
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => setIsCreateKBModalOpen(false)}
                className="p-1.5 rounded-lg text-ink-400 hover:text-ink-900 hover:bg-subtle transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKB} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-700">
                  知识库标识 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  disabled={isSubmitting}
                  placeholder="例如: tech_manuals 或 project_v1"
                  value={newKBName}
                  onChange={(e) => setNewKBName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-ink-900 focus:outline-none focus:border-stone-500 placeholder:text-ink-400 shadow-xs disabled:bg-subtle"
                />
                <p className="text-[10px] text-ink-400">建议使用小写英文字母、数字或下划线命名</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink-700">
                  描述说明 <span className="text-ink-400 font-normal">(可选)</span>
                </label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  placeholder="例如: 包含核心业务规范与接口手册"
                  value={newKBDesc}
                  onChange={(e) => setNewKBDesc(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-ink-900 focus:outline-none focus:border-stone-500 placeholder:text-ink-400 shadow-xs disabled:bg-subtle"
                />
              </div>

              {/* 内置文档上传区 */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-medium text-ink-700">
                  导入文档 <span className="text-ink-400 font-normal">(可选，支持批量)</span>
                </label>
                
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsCreateDragging(true);
                  }}
                  onDragLeave={() => setIsCreateDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsCreateDragging(false);
                    if (e.dataTransfer.files) {
                      const valid = filterSupportedFiles(e.dataTransfer.files);
                      setCreateKBFiles((prev) => [...prev, ...valid]);
                    }
                  }}
                  onClick={() => createFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
                    isCreateDragging 
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20' 
                      : 'border-border hover:border-stone-400 bg-surface/60'
                  }`}
                >
                  <Upload className="w-4 h-4 mx-auto text-ink-400 mb-1" />
                  <p className="text-xs text-ink-700 font-medium">点击选择或拖拽文件至此</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">支持 .docx、.txt、.md 格式</p>
                </div>

                <input
                  ref={createFileInputRef}
                  type="file"
                  multiple
                  accept=".docx,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      const valid = filterSupportedFiles(e.target.files);
                      setCreateKBFiles((prev) => [...prev, ...valid]);
                    }
                  }}
                />

                {/* 已选文件列表徽章 */}
                {createKBFiles.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1 pt-1">
                    {createKBFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between px-2 py-1 bg-surface border border-border rounded-lg text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                          <span className="truncate text-ink-800 text-[11px]">{file.name}</span>
                          <span className="text-[10px] font-mono text-ink-400">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreateKBFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-ink-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 异常反馈提示 */}
              {modalFeedback && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                  modalFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {modalFeedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsCreateKBModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-ink-600 hover:text-ink-900 hover:bg-subtle rounded-xl transition-colors font-medium cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-ink-900 text-white rounded-xl hover:bg-accent-hover shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>正在构建索引...</span>
                    </>
                  ) : (
                    <span>确认创建</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 居中上传文档卡片（向已有知识库追加导入文档） */}
      {uploadModalKB && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 p-4 bg-ink-900/40 backdrop-blur-xs animate-fade-in"
          onClick={() => {
            if (!isSubmitting) setUploadModalKB(null);
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-paper border border-border rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-ink-900 shadow-xs">
                  <Upload className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-900">上传文档至知识库</h3>
                    <span className="font-mono text-[10px] text-ink-700 bg-subtle px-1.5 py-0.5 rounded border border-border">
                      {uploadModalKB}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500">导入文档将自动切片并生成向量/BM25混合索引</p>
                </div>
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => setUploadModalKB(null)}
                className="p-1.5 rounded-lg text-ink-400 hover:text-ink-900 hover:bg-subtle transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDedicatedUpload} className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsUploadDragging(true);
                }}
                onDragLeave={() => setIsUploadDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsUploadDragging(false);
                  if (e.dataTransfer.files) {
                    const valid = filterSupportedFiles(e.dataTransfer.files);
                    setUploadFiles((prev) => [...prev, ...valid]);
                  }
                }}
                onClick={() => dedicatedFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isUploadDragging 
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20' 
                    : 'border-border hover:border-stone-400 bg-surface/60'
                }`}
              >
                <Upload className="w-6 h-6 mx-auto text-ink-400 mb-1.5" />
                <p className="text-xs text-ink-700 font-medium">点击选择文档，或将文件拖拽至此区域</p>
                <p className="text-[11px] text-ink-400 mt-1">支持 Word (.docx)、Markdown (.md) 与纯文本 (.txt)</p>
              </div>

              <input
                ref={dedicatedFileInputRef}
                type="file"
                multiple
                accept=".docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    const valid = filterSupportedFiles(e.target.files);
                    setUploadFiles((prev) => [...prev, ...valid]);
                  }
                }}
              />

              {/* 待上传文件列表 */}
              {uploadFiles.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
                    待导入文档清单 ({uploadFiles.length})
                  </div>
                  {uploadFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs shadow-xs">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                        <span className="truncate text-ink-900 font-medium">{file.name}</span>
                        <span className="text-[10px] font-mono text-ink-400">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-ink-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 反馈提示 */}
              {modalFeedback && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                  modalFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {modalFeedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setUploadModalKB(null)}
                  className="px-3.5 py-1.5 text-xs text-ink-600 hover:text-ink-900 hover:bg-subtle rounded-xl transition-colors font-medium cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || uploadFiles.length === 0}
                  className="px-4 py-1.5 text-xs font-semibold bg-ink-900 text-white rounded-xl hover:bg-accent-hover shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>正在解析与切片...</span>
                    </>
                  ) : (
                    <span>开始导入与切片</span>
                  )}
                </button>
              </div>
            </form>
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
      className={`h-9 w-full px-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between group text-xs font-medium ${
        isActive
          ? 'bg-surface border border-border text-ink-900 font-semibold shadow-xs'
          : 'hover:bg-subtle text-ink-700 hover:text-ink-900 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-1">
        <MessageSquare
          className={`w-4 h-4 flex-shrink-0 ${
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
              className="p-1 rounded hover:bg-stone-200 text-ink-400 hover:text-ink-900 transition-colors cursor-pointer"
              title="重命名会话"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-rose-100 text-ink-400 hover:text-rose-600 transition-colors cursor-pointer"
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
