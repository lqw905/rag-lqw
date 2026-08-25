import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CitationDrawer } from './components/CitationDrawer';
import { ChunkModal } from './components/ChunkModal';
import { Playground } from './components/Playground';
import type { KnowledgeBase, ChatMessage, ReferenceItem, HealthInfo } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'playground'>('chat');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<string>('');
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Citation Drawer State
  const [isCitationOpen, setIsCitationOpen] = useState(false);
  const [activeReferences, setActiveReferences] = useState<ReferenceItem[]>([]);
  const [activeRefId, setActiveRefId] = useState<number | null>(null);

  // Chunk Visualizer Modal State
  const [isChunkModalOpen, setIsChunkModalOpen] = useState(false);

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

  // 2. Chat Handler: Send message and stream SSE
  const handleSendMessage = async (query: string) => {
    if (!selectedKB || isStreaming) return;

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

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, initialAssistantMsg]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Convert history format
    const history = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await api.streamChat({
      kb_name: selectedKB,
      query,
      history,
      signal: abortController.signal,
      onReferences: (references) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, references } : m
          )
        );
        setActiveReferences(references);
      },
      onDelta: (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: m.content + delta }
              : m
          )
        );
      },
      onDone: () => {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, isStreaming: false } : m
          )
        );
      },
      onError: (err) => {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: m.content + `\n\n> ⚠️ **错误**: ${err}`, isStreaming: false }
              : m
          )
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

  const handleClearMessages = () => {
    if (confirm('确定要清空当前对话历史吗？')) {
      setMessages([]);
      setActiveReferences([]);
      setIsCitationOpen(false);
    }
  };

  const handleOpenCitation = (refId: number) => {
    setActiveRefId(refId);
    setIsCitationOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500/30 selection:text-brand-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        healthInfo={healthInfo}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          knowledgeBases={knowledgeBases}
          selectedKB={selectedKB}
          onSelectKB={(kb) => setSelectedKB(kb)}
          onRefreshKBs={loadKBs}
          onOpenChunkModal={() => setIsChunkModalOpen(true)}
        />

        {/* Center Content: Chat or Playground */}
        {activeTab === 'chat' ? (
          <ChatArea
            messages={messages}
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            onClearMessages={handleClearMessages}
            isStreaming={isStreaming}
            selectedKB={selectedKB}
            onOpenCitation={handleOpenCitation}
          />
        ) : (
          <Playground selectedKB={selectedKB} />
        )}

        {/* Right Citation Drawer */}
        <CitationDrawer
          isOpen={isCitationOpen}
          onClose={() => setIsCitationOpen(false)}
          references={activeReferences}
          activeRefId={activeRefId}
          onSelectRef={(id) => setActiveRefId(id)}
        />
      </div>

      {/* Chunk Visualizer Modal */}
      <ChunkModal
        isOpen={isChunkModalOpen}
        onClose={() => setIsChunkModalOpen(false)}
        kbName={selectedKB}
      />
    </div>
  );
};

export default App;
