-- ==============================================================================
-- KnowledgeAI: Complete Multi-Tenant Database Schema with pgvector
-- Migration: 001_initial_schema.sql
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    plan VARCHAR(50) NOT NULL DEFAULT 'enterprise',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Organization Members (RBAC: super_admin, org_admin, kb_manager, employee)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin', 'org_admin', 'kb_manager', 'employee')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- 5. Organization Invitations
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('org_admin', 'kb_manager', 'employee')),
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(organization_id);

-- 6. Organization Settings (Configurable RAG defaults)
CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    top_k INT NOT NULL DEFAULT 5,
    similarity_threshold NUMERIC(4, 3) NOT NULL DEFAULT 0.650,
    chunk_size INT NOT NULL DEFAULT 800,
    chunk_overlap INT NOT NULL DEFAULT 150,
    hybrid_vector_weight NUMERIC(4, 3) NOT NULL DEFAULT 0.700,
    hybrid_fts_weight NUMERIC(4, 3) NOT NULL DEFAULT 0.300,
    reranking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    max_context_tokens INT NOT NULL DEFAULT 3500,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Knowledge Bases
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_org ON knowledge_bases(organization_id);

-- 8. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'md')),
    file_size_bytes BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 for duplicate detection
    storage_path TEXT NOT NULL,
    current_version INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'pending', 'processing', 'indexed', 'failed', 'archived')),
    error_message TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_kb ON documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(organization_id, file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(organization_id, status);

-- 9. Document Versions
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions(document_id);

-- 10. Document Chunks (pgvector + full-text search)
-- Note: bge-base-en-v1.5 has 768 dimensions
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    document_version INT NOT NULL DEFAULT 1,
    chunk_index INT NOT NULL,
    page_number INT DEFAULT 1,
    content TEXT NOT NULL,
    embedding vector(768),
    tsv_content tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_org ON document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_kb ON document_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON document_chunks USING gin(tsv_content);

-- HNSW vector index for high-speed cosine similarity retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
ON document_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 11. Ingestion Jobs (Postgres-backed background queue)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    error_details JSONB,
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_queue ON ingestion_jobs(status, created_at) WHERE status IN ('pending', 'processing');

-- 12. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    selected_kb_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_org ON conversations(organization_id);

-- 13. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'assistant')),
    content TEXT NOT NULL,
    retrieval_duration_ms INT,
    generation_duration_ms INT,
    total_tokens INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);

-- 14. Message Citations
CREATE TABLE IF NOT EXISTS message_citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    citation_index INT NOT NULL,
    page_number INT,
    snippet TEXT NOT NULL,
    relevance_score NUMERIC(5, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_msg ON message_citations(message_id);

-- 15. User Feedback
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rating VARCHAR(20) NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_org ON feedback(organization_id);

-- 16. Evaluation Datasets and Results
CREATE TABLE IF NOT EXISTS evaluation_datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES evaluation_datasets(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    expected_answer TEXT NOT NULL,
    relevant_doc_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES evaluation_datasets(id) ON DELETE CASCADE,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    config_snapshot JSONB NOT NULL,
    mrr NUMERIC(5, 4) NOT NULL,
    precision_at_k NUMERIC(5, 4) NOT NULL,
    recall_at_k NUMERIC(5, 4) NOT NULL,
    faithfulness_score NUMERIC(5, 4) NOT NULL,
    answer_relevance_score NUMERIC(5, 4) NOT NULL,
    avg_retrieval_latency_ms INT NOT NULL,
    avg_generation_latency_ms INT NOT NULL,
    details JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_eval_results_org ON evaluation_results(organization_id);

-- ==============================================================================
-- Row-Level Security (RLS) Setup
-- ==============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_results ENABLE ROW LEVEL SECURITY;

-- Service-role / DB admin / Express backend can bypass RLS,
-- while tenant-scoped queries adhere strictly to app.current_org_id.
CREATE POLICY org_tenant_isolation_policy ON organizations
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
        OR id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );

CREATE POLICY kb_tenant_isolation_policy ON knowledge_bases
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
        OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );

CREATE POLICY doc_tenant_isolation_policy ON documents
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
        OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );

CREATE POLICY chunk_tenant_isolation_policy ON document_chunks
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
        OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );

CREATE POLICY conv_tenant_isolation_policy ON conversations
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
        OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );

CREATE POLICY msg_tenant_isolation_policy ON messages
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
        OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );

CREATE POLICY feedback_tenant_isolation_policy ON feedback
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
        OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );

CREATE POLICY jobs_tenant_isolation_policy ON ingestion_jobs
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
        OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );
