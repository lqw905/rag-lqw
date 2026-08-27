import React, { useState, useMemo } from 'react';
import { Plus, Search, MessageSquare, Edit3, Trash2, Clock } from 'lucide-react';
import type { ChatSession } from '../types';

interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onClearSessions: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onClearSessions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // 过滤会话
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // 按时间分组（今天 vs 更早）
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

  const startRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <aside className="w-64 border-r border-border bg-paper flex flex-col h-[calc(100vh-3.5rem)] flex-shrink-0 z-10 select-none">
      {/* 新建对话主按钮 */}
      <div className="p-3 border-b border-border">
        <button
          onClick={onCreateSession}
          className="w-full py-2 px-3.5 rounded-xl bg-ink-900 hover:bg-accent-hover text-white text-xs font-semibold shadow-card active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
        >
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
          <span>新建研读对话</span>
        </button>
      </div>

      {/* 搜索会话框 */}
      <div className="px-3 pt-2.5">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索研读历史..."
            className="w-full bg-surface border border-border text-ink-900 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-stone-400 placeholder:text-ink-400 shadow-card"
          />
          <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2 top-2" />
        </div>
      </div>

      {/* 会话卡片列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-ink-400 text-xs">
            {searchQuery ? '未搜索到相关会话' : '暂无对话，点击上方新建'}
          </div>
        ) : (
          <>
            {/* 分组：今天 */}
            {todaySessions.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider px-1 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-ink-400" />
                  今天 ({todaySessions.length})
                </div>
                <div className="space-y-1">
                  {todaySessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      isActive={s.id === activeSessionId}
                      isEditing={s.id === editingId}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      onSelect={() => onSelectSession(s.id)}
                      onStartRename={(e) => startRename(s, e)}
                      onSaveRename={() => handleSaveRename(s.id)}
                      onKeyDown={(e) => handleKeyDown(e, s.id)}
                      onDelete={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 分组：更早 */}
            {earlierSessions.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider px-1 mb-1.5">
                  更早 ({earlierSessions.length})
                </div>
                <div className="space-y-1">
                  {earlierSessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      isActive={s.id === activeSessionId}
                      isEditing={s.id === editingId}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      onSelect={() => onSelectSession(s.id)}
                      onStartRename={(e) => startRename(s, e)}
                      onSaveRename={() => handleSaveRename(s.id)}
                      onKeyDown={(e) => handleKeyDown(e, s.id)}
                      onDelete={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部统计与清空 */}
      <div className="p-3 border-t border-border flex items-center justify-between text-xs text-ink-500 bg-paper/60">
        <span className="text-[11px] font-mono text-ink-500">共 {sessions.length} 个对话</span>
        {sessions.length > 0 && (
          <button
            onClick={onClearSessions}
            className="text-[11px] text-ink-400 hover:text-rose-600 transition-colors"
          >
            清空本库会话
          </button>
        )}
      </div>
    </aside>
  );
};

interface SessionCardProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSelect: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSaveRename: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  onSelect,
  onStartRename,
  onSaveRename,
  onKeyDown,
  onDelete,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`p-2 rounded-xl cursor-pointer transition-all flex items-center justify-between group text-xs ${
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
            onKeyDown={onKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-paper border border-stone-400 text-ink-900 rounded px-1.5 py-0.5 text-xs focus:outline-none"
          />
        ) : (
          <span className="truncate font-medium text-ink-900">{session.title}</span>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={onStartRename}
            className="p-1 rounded hover:bg-stone-200 text-ink-500 hover:text-ink-900 transition-colors"
            title="重命名会话"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-rose-100 text-ink-500 hover:text-rose-600 transition-colors"
            title="删除会话"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
