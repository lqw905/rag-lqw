import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SessionList } from './components/SessionList';
import { ChatArea } from './components/ChatArea';
import { CitationDrawer } from './components/CitationDrawer';
import { ChunkModal } from './components/ChunkModal';
import { Playground } from './components/Playground';
import type { KnowledgeBase, ChatSession, ChatMessage, ReferenceItem, HealthInfo } from './types';
import { api } from './services/api';

const STORAGE_KEY = 'rag_gk_sessions_v1';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'playground'>('chat');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<string>('');
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);

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

  // 1. Initial Load: Health & Knowledge Bases
  const loadKBs = async () => {
    try {
      const kbs = await api.listKnowledgeBases();
      setKnowledgeBases(kbs);
      if (kbs.length > 0 && (!selectedKB || !kbs.some((k) => k.kb_name === selectedKB))) {
        setSelectedKB(kbs[0].kb_name);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge bases:', err);
    }
  };

  useEffect(() => {
    api.getHealth().then(setHealthInfo).catch(console.warn);
    loadKBs();
  }, []);

  // Filter sessions for the currently selected Knowledge Base
  const currentKBSessions = useMemo(() => {
    if (!selectedKB) return [];
    return sessions.filter((s) => s.kb_name === selectedKB);
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

  // Clear messages in current active session
  const handleClearCurrentMessages = () => {
    if (!confirm('确定要清空当前对话中的消息吗？')) return;
    if (!activeSessionId) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [], updated_at: Date.now() } : s))
    );
    setIsCitationOpen(false);
  };

  // Send message and stream response into the active session
  const handleSendMessage = async (query: string) => {
    if (!selectedKB || !activeSessionId || isStreaming) return;

    const currentSession = sessions.find((s) => s.id === activeSessionId);
    const isFirstMessage = !currentSession || currentSession.messages.length === 0;

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
    const autoTitle = isFirstMessage && currentSession?.title.startsWith('新对话')
      ? query.slice(0, 20) + (query.length > 20 ? '...' : '')
      : currentSession?.title || '对话';

    // Update session state with user message + empty assistant placeholder
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
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
      signal: abortController.signal,
      onReferences: (references) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
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
            if (s.id === activeSessionId) {
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
            if (s.id === activeSessionId) {
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
            if (s.id === activeSessionId) {
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

  const handleOpenCitation = (refId: number) => {
    setActiveRefId(refId);
    setIsCitationOpen(true);
  };

  return (
    <div className="min-h-screen bg-paper text-ink-900 flex flex-col font-sans selection:bg-stone-200 selection:text-ink-900">
      {/* 顶部导航栏 */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        healthInfo={healthInfo}
      />

      {/* 主体三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 一栏：知识库管理侧边栏 (256px) */}
        <Sidebar
          knowledgeBases={knowledgeBases}
          selectedKB={selectedKB}
          onSelectKB={(kb) => setSelectedKB(kb)}
          onRefreshKBs={loadKBs}
          onOpenChunkModal={() => setIsChunkModalOpen(true)}
        />

        {/* 二栏：会话列表管理 (260px) */}
        {activeTab === 'chat' && (
          <SessionList
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
          />
        )}

        {/* 三栏：主对话交互区 或 检索对比 Playground */}
        {activeTab === 'chat' ? (
          <ChatArea
            messages={activeSession ? activeSession.messages : []}
            sessionTitle={activeSession ? activeSession.title : ''}
            selectedKB={selectedKB}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            onClearMessages={handleClearCurrentMessages}
            onOpenCitation={handleOpenCitation}
            onRenameSession={(title) => activeSessionId && handleRenameSession(activeSessionId, title)}
          />
        ) : (
          <Playground selectedKB={selectedKB} />
        )}

        {/* 侧边滑出：引用溯源抽屉 */}
        <CitationDrawer
          isOpen={isCitationOpen}
          onClose={() => setIsCitationOpen(false)}
          references={activeReferences}
          activeRefId={activeRefId}
          onSelectRef={(id) => setActiveRefId(id)}
        />
      </div>

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
