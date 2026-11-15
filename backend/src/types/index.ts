export type UserRole = 'super_admin' | 'org_admin' | 'kb_manager' | 'employee';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  plan: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  user?: Partial<User>;
  created_at: Date;
}

export interface OrganizationSettings {
  id: string;
  organization_id: string;
  top_k: number;
  similarity_threshold: number;
  chunk_size: number;
  chunk_overlap: number;
  hybrid_vector_weight: number;
  hybrid_fts_weight: number;
  reranking_enabled: boolean;
  max_context_tokens: number;
  created_at: Date;
  updated_at: Date;
}

export interface KnowledgeBase {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_by?: string;
  document_count?: number;
  created_at: Date;
  updated_at: Date;
}

export type DocumentStatus = 'uploaded' | 'pending' | 'processing' | 'indexed' | 'failed' | 'archived';
export type DocumentFileType = 'pdf' | 'docx' | 'txt' | 'md';

export interface Document {
  id: string;
  organization_id: string;
  knowledge_base_id: string;
  title: string;
  file_name: string;
  file_type: DocumentFileType;
  file_size_bytes: number;
  file_hash: string;
  storage_path: string;
  current_version: number;
  status: DocumentStatus;
  error_message?: string;
  created_by?: string;
  chunk_count?: number;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  organization_id: string;
  knowledge_base_id: string;
  document_version: number;
  chunk_index: number;
  page_number?: number;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
  score?: number;
  created_at: Date;
}

export interface Conversation {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  selected_kb_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  organization_id: string;
  sender_type: 'user' | 'assistant';
  content: string;
  retrieval_duration_ms?: number;
  generation_duration_ms?: number;
  total_tokens?: number;
  citations?: MessageCitation[];
  feedback?: {
    rating: 'thumbs_up' | 'thumbs_down';
    comment?: string;
  };
  created_at: Date;
}

export interface MessageCitation {
  id: string;
  message_id: string;
  chunk_id: string;
  document_id: string;
  document_title?: string;
  citation_index: number;
  page_number?: number;
  snippet: string;
  relevance_score?: number;
  created_at: Date;
}

export interface IngestionJob {
  id: string;
  document_id: string;
  organization_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  error_details?: any;
  created_at: Date;
  updated_at: Date;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  document_title: string;
  knowledge_base_id: string;
  page_number: number;
  chunk_index: number;
  content: string;
  vector_score: number;
  fts_score: number;
  rrf_score: number;
  final_score: number;
  metadata: Record<string, any>;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: UserRole;
}
