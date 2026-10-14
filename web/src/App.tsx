import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CitationDrawer } from './components/CitationDrawer';
import { ChunkModal } from './components/ChunkModal';
import { Playground } from './components/Playground';
import { WindowControls } from './components/WindowControls';
import type { KnowledgeBase, ChatSession, ChatMessage, ReferenceItem } from './types';
import { api } from './services/api';

const STORAGE_KEY = 'rag_gk_sessions_v1';
const SIDEBAR_COLLAPSED_KEY = 'rag_sidebar_collapsed';
const SIDEBAR_WIDTH_KEY = 'rag_sidebar_width';

export const App: React.FC = () => {
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<string>('');

  // Sidebar Collapsible & Resizable State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      return saved ? Math.max(220, Math.min(480, parseInt(saved, 10))) : 288;
    } catch {
      return 288;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleWidthChange = (newWidth: number) => {
    const clamped = Math.max(220, Math.min(480, newWidth));
    setSidebarWidth(clamped);
  };

  // Multi-Session State (Persisted in localStorage)
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Citation Drawer State
  const [isCitationOpen, setIsCitationOpen] = useState(false);
  const [activeReferences, setActiveReferences] = useState<ReferenceItem[]>([]);
  const [activeRefId, setActiveRefId] = useState<number | null>(null);

  // Retrieval Settings state (persisted to localStorage)
  const [minScore, setMinScore] = useState<number>(() => {
    const saved = localStorage.getItem('rag_min_score');
    return saved !== null ? parseFloat(saved) : 0.08;
  });
  const [topN, setTopN] = useState<number>(() => {
    const saved = localStorage.getItem('rag_top_n');
    return saved !== null ? parseInt(saved, 10) : 5;
  });
  const [enableRewrite, setEnableRewrite] = useState<boolean>(() => {
    const saved = localStorage.getItem('rag_enable_rewrite');
    return saved !== null ? saved === 'true' : true;
  });
  const [enableRerank, setEnableRerank] = useState<boolean>(() => {
    const saved = localStorage.getItem('rag_enable_rerank');
    return saved !== null ? saved === 'true' : true;
  });

  const handleMinScoreChange = (val: number) => {
    setMinScore(val);
    localStorage.setItem('rag_min_score', val.toString());
  };
  const handleTopNChange = (val: number) => {
    setTopN(val);
    localStorage.setItem('rag_top_n', val.toString());
  };
  const handleEnableRewriteChange = (val: boolean) => {
    setEnableRewrite(val);
    localStorage.setItem('rag_enable_rewrite', val.toString());
  };
  const handleEnableRerankChange = (val: boolean) => {
    setEnableRerank(val);
    localStorage.setItem('rag_enable_rerank', val.toString());
  };

  // Chunk Visualizer Modal State
  const [isChunkModalOpen, setIsChunkModalOpen] = useState(false);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save sessions to localStorage:', e);
    }
  }, [sessions]);

  // 1. Initial Load: Knowledge Bases
  const loadKBs = async () => {
    try {
      const kbs = await api.listKnowledgeBases();
      if (kbs.length === 0) {
        // 若系统完全无知识库，自动初始化默认知识库，保证开箱即用
        try {
          const defaultKB = await api.createKnowledgeBase('默认知识库', '系统初始化知识库');
          setKnowledgeBases([defaultKB]);
          setSelectedKB(defaultKB.kb_name);
        } catch (e) {
          console.error('Failed to auto-create default KB:', e);
          setKnowledgeBases([]);
        }
      } else {
        setKnowledgeBases(kbs);
        if (!selectedKB || !kbs.some((k) => k.kb_name === selectedKB)) {
          setSelectedKB(kbs[0].kb_name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch knowledge bases:', err);
    }
  };

  useEffect(() => {
    loadKBs();
  }, []);


  // Filter sessions for the currently selected Knowledge Base (Hide empty sessions from Sidebar)
  const currentKBSessions = useMemo(() => {
    if (!selectedKB) return [];
    return sessions.filter((s) => s.kb_name === selectedKB && s.messages.length > 0);
  }, [sessions, selectedKB]);

  // Active Session Object
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  // When selectedKB changes, auto-select or auto-create a session
  useEffect(() => {
    if (!selectedKB) return;
    const kbSessions = sessions.filter((s) => s.kb_name === selectedKB);
    if (kbSessions.length > 0) {
      if (!kbSessions.some((s) => s.id === activeSessionId)) {
        setActiveSessionId(kbSessions[0].id);
      }
    } else {
      // Auto create an initial session for this KB
      handleCreateSession(selectedKB);
    }
  }, [selectedKB]);

  // Create a new session
  const handleCreateSession = (kbName: string = selectedKB) => {
    if (!kbName) return;

    // 如果当前知识库已经有一个空对话（没有消息），直接切换过去，不再新建
    const existingEmptySession = sessions.find((s) => s.kb_name === kbName && s.messages.length === 0);
    if (existingEmptySession) {
      setActiveSessionId(existingEmptySession.id);
      setIsCitationOpen(false);
      return;
    }

    const newSessionId = 'session-' + Date.now();
    const newSession: ChatSession = {
      id: newSessionId,
      kb_name: kbName,
      title: '新对话 ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: Date.now(),
      updated_at: Date.now(),
      messages: [],
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    setIsCitationOpen(false);
  };

  // Rename a session
  const handleRenameSession = (sessionId: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle, updated_at: Date.now() } : s))
    );
  };

  // Delete a session
  const handleDeleteSession = (sessionId: string) => {
    if (!confirm('确定要删除此对话记录吗？')) return;
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      const remainingKB = remaining.filter((s) => s.kb_name === selectedKB);
      if (sessionId === activeSessionId) {
        if (remainingKB.length > 0) {
          setActiveSessionId(remainingKB[0].id);
        } else {
          // If no sessions left, create one
          setTimeout(() => handleCreateSession(selectedKB), 0);
        }
      }
      return remaining;
    });
  };

  // Clear all sessions for current KB
  const handleClearSessionsForKB = () => {
    if (!confirm(`确定清空知识库 "${selectedKB}" 下的所有对话记录吗？`)) return;
    setSessions((prev) => prev.filter((s) => s.kb_name !== selectedKB));
    setTimeout(() => handleCreateSession(selectedKB), 0);
  };

  // Send message and stream response into the active session
  const handleSendMessage = async (query: string) => {
    if (!selectedKB) {
      alert('请先在左侧选择或新建一个知识库！');
      return;
    }
    if (isStreaming) return;

    let targetSessionId = activeSessionId;
    let currentSession = sessions.find((s) => s.id === targetSessionId);
    let isFirstMessage = true;

    if (!targetSessionId || !currentSession) {
      targetSessionId = 'session-' + Date.now();
      const newSession: ChatSession = {
        id: targetSessionId,
        kb_name: selectedKB,
        title: query.slice(0, 20) + (query.length > 20 ? '...' : ''),
        created_at: Date.now(),
        updated_at: Date.now(),
        messages: [],
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(targetSessionId);
      currentSession = newSession;
      isFirstMessage = true;
    } else {
      isFirstMessage = currentSession.messages.length === 0;
    }

    const userMessageId = 'user-' + Date.now();
    const assistantMessageId = 'assistant-' + (Date.now() + 1);

    const userMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    const initialAssistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      references: [],
      isStreaming: true,
      timestamp: Date.now(),
    };

    // Auto-rename session if it's the first message
    const autoTitle = isFirstMessage && (currentSession?.title.startsWith('新对话') || currentSession?.title.startsWith('新研读'))
      ? query.slice(0, 20) + (query.length > 20 ? '...' : '')
      : currentSession?.title || '新对话';

    // Update session state with user message + empty assistant placeholder
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            title: autoTitle,
            updated_at: Date.now(),
            messages: [...s.messages, userMsg, initialAssistantMsg],
          };
        }
        return s;
      })
    );

    setIsStreaming(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Convert history format
    const history = (currentSession?.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await api.streamChat({
      kb_name: selectedKB,
      query,
      history,
      top_n: topN,
      enable_rerank: enableRerank,
      enable_rewrite: enableRewrite,
      min_score: minScore,
      signal: abortController.signal,
      onReferences: (references) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId ? { ...m, references } : m
                ),
              };
            }
            return s;
          })
        );
        setActiveReferences(references);
      },
      onDelta: (delta) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: m.content + delta } : m
                ),
              };
            }
            return s;
          })
        );
      },
      onDone: () => {
        setIsStreaming(false);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId ? { ...m, isStreaming: false } : m
                ),
              };
            }
            return s;
          })
        );
      },
      onError: (err) => {
        setIsStreaming(false);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: m.content + `\n\n> ⚠️ **错误**: ${err}`, isStreaming: false }
                    : m
                ),
              };
            }

            return s;
          })
        );
      },
    });
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleOpenCitation = (refId: number, refs?: ReferenceItem[]) => {
    if (refs && refs.length > 0) {
      setActiveReferences(refs);
    } else if (activeReferences.length === 0 && activeSession) {
      const msgWithRefs = [...activeSession.messages].reverse().find((m) => m.references && m.references.length > 0);
      if (msgWithRefs?.references) {
        setActiveReferences(msgWithRefs.references);
      }
    }
    setActiveRefId(refId);
    setIsCitationOpen(true);
  };

  return (
    <div className="h-screen w-screen bg-paper text-ink-900 flex overflow-hidden font-sans selection:bg-stone-200 selection:text-ink-900 relative">
      {/*
        桌面端无边框窗口的拖动带：窗口过程把窗口最顶部 36px 返回 HTCAPTION，
        从而实现拖动、双击最大化与 Win+方向键贴靠。
        高度必须与 desktop_launcher.py 的 TITLEBAR_HEIGHT 保持一致。

        ⚠ 必须用 absolute 浮在内容之上，不能参与普通流 —— 否则会把整个界面往下推 36px。
        ⚠ 右上角是自绘窗口按钮区：窗口过程会按 WINDOW_CONTROLS_WIDTH 把这一块排除在
          拖动带之外，所以放在这里的按钮可以正常点击。
      */}
      <div
        className="absolute top-0 left-0 right-0 h-9 z-40 select-none pointer-events-none"
        data-drag-region="true"
      />

      {/* 自绘窗口按钮：右上角（Windows 惯例位置）。浏览器里不渲染（无 pywebview API） */}
      <div className="absolute top-1 right-1 z-50">
        <WindowControls />
      </div>

      {/* flex-1 + min-h-0：确保子项严格被窗口高度约束，避免侧栏溢出把底部窗口按钮挤出可视区 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左侧可收起、可拖拽调节宽度的极简统一单栏 (上下撑到底) */}
        <Sidebar
          knowledgeBases={knowledgeBases}
          selectedKB={selectedKB}
          onSelectKB={(kb) => setSelectedKB(kb)}
          onRefreshKBs={loadKBs}
          onOpenChunkModal={() => setIsChunkModalOpen(true)}
          sessions={currentKBSessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            setActiveSessionId(id);
            const target = sessions.find((s) => s.id === id);
            if (target && target.messages.length > 0) {
              const lastAssistant = [...target.messages].reverse().find((m) => m.role === 'assistant' && m.references && m.references.length > 0);
              if (lastAssistant && lastAssistant.references) {
                setActiveReferences(lastAssistant.references);
              }
            }
          }}
          onCreateSession={() => handleCreateSession(selectedKB)}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
          onClearSessions={handleClearSessionsForKB}
          onOpenPlaygroundModal={() => setIsPlaygroundOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          width={sidebarWidth}
          onWidthChange={handleWidthChange}
        />

        {/* 右侧：始终专注主对话研读区 (上下撑到底，通体左右纯粹结构) */}
        <ChatArea
          messages={activeSession ? activeSession.messages : []}
          selectedKB={selectedKB}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          onOpenCitation={handleOpenCitation}
          minScore={minScore}
          onMinScoreChange={handleMinScoreChange}
          topN={topN}
          onTopNChange={handleTopNChange}
          enableRewrite={enableRewrite}
          onEnableRewriteChange={handleEnableRewriteChange}
          enableRerank={enableRerank}
          onEnableRerankChange={handleEnableRerankChange}
        />
      </div>

      {/* 侧边滑出：引用溯源抽屉 */}
      <CitationDrawer
        isOpen={isCitationOpen}
        onClose={() => setIsCitationOpen(false)}
        references={activeReferences}
        activeRefId={activeRefId}
        onSelectRef={(id) => setActiveRefId(id)}
      />

      {/* 检索实验台居中模态卡片 */}
      <Playground
        isOpen={isPlaygroundOpen}
        onClose={() => setIsPlaygroundOpen(false)}
        selectedKB={selectedKB}
      />

      {/* 切片透视模态框 */}
      <ChunkModal
        isOpen={isChunkModalOpen}
        onClose={() => setIsChunkModalOpen(false)}
        kbName={selectedKB}
      />
    </div>
  );
};

export default App;
