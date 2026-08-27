import React, { useState, useRef } from 'react';
import { 
  FolderPlus, 
  Upload, 
  Trash2, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Plus,
  Loader2
} from 'lucide-react';
import type { KnowledgeBase } from '../types';
import { api } from '../services/api';

interface SidebarProps {
  knowledgeBases: KnowledgeBase[];
  selectedKB: string;
  onSelectKB: (kb_name: string) => void;
  onRefreshKBs: () => void;
  onOpenChunkModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  knowledgeBases,
  selectedKB,
  onSelectKB,
  onRefreshKBs,
  onOpenChunkModal,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDesc, setNewKBDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentKB = knowledgeBases.find((k) => k.kb_name === selectedKB);

  const handleCreateKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKBName.trim()) return;

    try {
      await api.createKnowledgeBase(newKBName.trim(), newKBDesc.trim());
      setIsCreating(false);
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

  return (
    <aside className="w-64 border-r border-border bg-paper flex flex-col h-[calc(100vh-3.5rem)] flex-shrink-0 z-20 select-none">
      {/* KB Selector Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-ink-700" />
            目标知识库
          </label>
          <button
            onClick={() => setIsCreating(true)}
            className="text-xs text-ink-900 hover:text-accent-hover font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新建
          </button>
        </div>

        {knowledgeBases.length > 0 ? (
          <div className="relative">
            <select
              value={selectedKB}
              onChange={(e) => onSelectKB(e.target.value)}
              className="w-full bg-surface border border-border text-ink-900 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-stone-400 appearance-none cursor-pointer pr-10 shadow-card"
            >
              {knowledgeBases.map((kb) => (
                <option key={kb.kb_name} value={kb.kb_name}>
                  {kb.kb_name} ({kb.chunk_count} 切片)
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-400 text-xs">
              ▼
            </div>
          </div>
        ) : (
          <div className="p-3 text-center rounded-xl bg-surface border border-dashed border-border text-ink-400 text-xs">
            暂无知识库，请先点击右上角“新建”
          </div>
        )}

        {/* Current KB Stats & Actions */}
        {currentKB && (
          <div className="mt-3 p-3 rounded-xl bg-surface border border-border space-y-2.5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-ink-500 font-medium">已索引分块</span>
              <span className="text-xs font-bold text-ink-900 font-mono bg-subtle px-2 py-0.5 rounded-md border border-border">
                {currentKB.chunk_count} 块
              </span>
            </div>

            <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
              <button
                onClick={onOpenChunkModal}
                disabled={currentKB.chunk_count === 0}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-subtle hover:bg-stone-200 disabled:opacity-40 disabled:pointer-events-none text-ink-900 text-xs font-medium flex items-center justify-center gap-1.5 transition-all border border-border"
                title="查看该知识库的切片与面包屑结构"
              >
                <Layers className="w-3.5 h-3.5 text-ink-700 flex-shrink-0" />
                <span className="whitespace-nowrap">切片预览</span>
              </button>
              <button
                onClick={() => handleDeleteKB(currentKB.kb_name)}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-ink-400 hover:text-rose-600 transition-colors border border-transparent hover:border-rose-200 flex items-center justify-center flex-shrink-0"
                title="删除此知识库"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Ingestion & Drag Drop */}
      <div className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
        <h3 className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-ink-700" />
          文档摄入与切片
        </h3>

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
          className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-ink-900 bg-subtle'
              : 'border-border hover:border-stone-400 bg-surface/60 hover:bg-surface shadow-card'
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
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="w-6 h-6 text-ink-900 animate-spin" />
              <p className="text-xs text-ink-900 font-medium">正在解析、切片与向量化...</p>
            </div>
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-subtle flex items-center justify-center text-ink-700 shadow-sm border border-border">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-ink-900">点击或拖拽文档到此处</p>
                <p className="text-[11px] text-ink-400 mt-0.5 font-mono">支持格式: .docx, .txt, .md</p>
              </div>
            </>
          )}
        </div>

        {/* Upload Message Notice */}
        {uploadMessage && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 animate-fade-in ${
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

        {/* Technical Tips */}
        <div className="mt-auto pt-4 border-t border-border">
          <div className="p-3 rounded-xl bg-surface border border-border text-[11px] text-ink-500 space-y-1.5 shadow-card">
            <div className="font-semibold text-ink-900 flex items-center gap-1">
              <span>💡 切片优化特性</span>
            </div>
            <p>• 自动提取 Word 标题层级转为 Markdown 面包屑；</p>
            <p>• 表格自动还原为 Markdown 结构，避免行列断裂；</p>
            <p>• 密集向量 + BM25 稀疏索引双重写入。</p>
          </div>
        </div>
      </div>

      {/* Modal: Create Knowledge Base */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-popover animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-subtle text-ink-900 flex items-center justify-center border border-border">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-ink-900 text-sm">新建知识库</h3>
                <p className="text-xs text-ink-500">创建一个独立的知识库 Collection</p>
              </div>
            </div>

            <form onSubmit={handleCreateKB} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1.5">
                  知识库标识 (kb_name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如: tech_manuals"
                  value={newKBName}
                  onChange={(e) => setNewKBName(e.target.value)}
                  className="w-full bg-paper border border-border rounded-xl px-3.5 py-2.5 text-xs text-ink-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1.5">知识库描述（可选）</label>
                <input
                  type="text"
                  placeholder="例如: 包含系统部署与架构设计文档"
                  value={newKBDesc}
                  onChange={(e) => setNewKBDesc(e.target.value)}
                  className="w-full bg-paper border border-border rounded-xl px-3.5 py-2.5 text-xs text-ink-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-ink-500 hover:text-ink-900 hover:bg-subtle transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-ink-900 hover:bg-accent-hover text-white shadow-card transition-all"
                >
                  确认创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
