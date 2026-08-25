export interface KnowledgeBase {
  kb_name: string;
  chunk_count: number;
  description?: string;
}

export interface ChunkDetail {
  chunk_id: string;
  header_path: string;
  doc_name: string;
  token_count: number;
  content: string;
  chunk_index: number;
}

export interface ReferenceItem {
  ref_id: number;
  chunk_id: string;
  doc_name: string;
  header_path: string;
  score: number;
  snippet: string;
  full_content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: ReferenceItem[];
  isStreaming?: boolean;
  timestamp: number;
}

export interface SearchHit {
  rank: number;
  chunk_id: string;
  doc_name: string;
  header_path: string;
  score: number;
  dense_rank?: number;
  sparse_rank?: number;
  content: string;
}

export interface SearchResponse {
  kb_name: string;
  query: string;
  total_hits: number;
  hits: SearchHit[];
}

export interface HealthInfo {
  status: string;
  service: string;
  version: string;
  llm_model: string;
  embedding_model: string;
  reranker_model: string;
}
