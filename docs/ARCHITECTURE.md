# KnowledgeAI – Enterprise Knowledge Base System Architecture

KnowledgeAI is a production-grade, multi-tenant SaaS application that enables enterprises to index private documentation (PDF, DOCX, TXT, Markdown) into isolated vector and full-text databases, querying content with low-hallucination streaming RAG and verifiable source citations.

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Next.js 15+ App Router)"]
        UI["Conversational UI / Citations Tray"]
        AdminUI["Doc Management & Analytics Dashboard"]
    end

    subgraph Gateway["API & Security Layer (Express.js)"]
        AuthMiddleware["JWT Auth & Tenant Isolation Middleware"]
        RateLimiter["Sliding Window Rate Limiter"]
        SSE["Server-Sent Events (SSE) Streamer"]
    end

    subgraph CoreServices["Backend Application Layer"]
        DocService["Document Management Service"]
        QueueService["Postgres-backed Job Queue"]
        RAGOrchestrator["RAG Retrieval Orchestrator"]
        EvalService["Evaluation & Benchmarking Engine"]
    end

    subgraph Ingestion["Document Ingestion Pipeline"]
        Extractor["Multi-Format Parser (PDF, DOCX, MD, TXT)"]
        Cleaner["Text Cleaner & Normalizer"]
        Chunker["Recursive Character Chunker"]
        Embedder["Cloudflare Workers AI (@cf/baai/bge-base-en-v1.5)"]
    end

    subgraph Data["PostgreSQL + pgvector Database"]
        TenantTables["Tenants / Users / KBs / Settings"]
        DocChunks["document_chunks (768-dim vector + tsvector)"]
        Jobs["ingestion_jobs (SKIP LOCKED lease queue)"]
        History["conversations / messages / message_citations"]
    end

    subgraph Inference["Inference Layer"]
        CFAI_LLM["Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct)"]
    end

    UI -->|HTTPS / REST & SSE| Gateway
    AdminUI -->|REST APIs| Gateway
    Gateway --> CoreServices

    DocService --> QueueService
    QueueService --> Jobs
    Jobs -->|Worker Polling| Ingestion
    Ingestion --> Embedder
    Embedder --> DocChunks

    RAGOrchestrator -->|Vector Cosine Match| DocChunks
    RAGOrchestrator -->|Full-Text Search| DocChunks
    RAGOrchestrator -->|Reciprocal Rank Fusion & Reranking| CFAI_LLM
    CFAI_LLM -->|Streamed Tokens| SSE
    SSE --> UI
```

---

## 2. Multi-Tenant Isolation Strategy

KnowledgeAI guarantees tenant isolation through defense-in-depth:

1. **Database Schema Scoping**:
   - Every tenant table (`knowledge_bases`, `documents`, `document_chunks`, `conversations`, `messages`, `message_citations`, `feedback`, `ingestion_jobs`) possesses an indexed foreign key:
     ```sql
     organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
     ```
2. **Row-Level Security (RLS)**:
   - PostgreSQL RLS policies enforce tenant boundaries:
     ```sql
     CREATE POLICY kb_tenant_isolation_policy ON knowledge_bases
         FOR ALL
         USING (
             NULLIF(current_setting('app.current_org_id', true), '')::uuid IS NULL 
             OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
         );
     ```
3. **Application Layer Context Injection**:
   - Authenticated JWT claims carry `organizationId` and `role`.
   - Before executing queries, `withTenantContext` sets `app.current_org_id` on the database connection.
   - Cross-tenant access attempts return `403 Forbidden`.

---

## 3. Ingestion Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Workspace Manager
    participant API as Document API
    participant Storage as File Storage (Local/Supabase)
    participant Queue as Ingestion Queue
    participant Worker as Background Ingestion Worker
    participant AI as Cloudflare Workers AI
    participant DB as PostgreSQL + pgvector

    Admin->>API: POST /documents/upload (PDF/DOCX/MD/TXT)
    API->>API: Compute SHA-256 Hash (Duplicate check)
    API->>Storage: Persist original raw file buffer
    API->>DB: INSERT into documents (status: 'uploaded')
    API->>Queue: Enqueue ingestion job
    API-->>Admin: 201 Created (document_id, status: 'pending')

    Worker->>Queue: Lock job via FOR UPDATE SKIP LOCKED
    Worker->>Storage: Read file buffer
    Worker->>Worker: Parse pages (pdf-parse / mammoth)
    Worker->>Worker: Clean & normalize control characters
    Worker->>Worker: Recursive character chunking (800 chars, 150 overlap)
    Worker->>AI: Generate 768-dim embeddings in batches
    AI-->>Worker: Return embedding vectors
    Worker->>DB: INSERT document_chunks (embedding, tsv_content, metadata)
    Worker->>Queue: Mark job 'completed'
    Worker->>DB: UPDATE document status to 'indexed'
```

---

## 4. Query Retrieval & Hybrid RAG Pipeline

When a user asks a question in the AI Chat Workspace:

1. **Conversational Query Rewriting**:
   - Ambiguous follow-up queries (e.g. *"What are its limitations?"*) are reformulated into standalone keyword-rich search queries taking previous dialogue turns into account.
2. **Parallel Hybrid Search**:
   - **Dense Semantic Retrieval**: Computes query embedding and queries `document_chunks` using pgvector cosine distance:
     ```sql
     SELECT id, 1 - (embedding <=> $1::vector) as vector_score
     FROM document_chunks
     WHERE organization_id = $2
     ORDER BY embedding <=> $1::vector ASC LIMIT 20;
     ```
   - **Sparse Lexical Retrieval**: Executes PostgreSQL full-text search using BM25-style term frequency / inverse document frequency ranking:
     ```sql
     SELECT id, ts_rank_cd(tsv_content, plainto_tsquery('english', $1)) as fts_score
     FROM document_chunks
     WHERE organization_id = $2 AND tsv_content @@ plainto_tsquery('english', $1)
     ORDER BY fts_score DESC LIMIT 20;
     ```
3. **Reciprocal Rank Fusion (RRF)**:
   - Fuses rank positions from vector and keyword searches:
     $$RRF(d) = \frac{w_{vec}}{k + \text{rank}_{vec}(d)} + \frac{w_{fts}}{k + \text{rank}_{fts}(d)}$$
     where $k = 60$.
4. **Cross-Score Reranking**:
   - Rescores top candidate chunks against exact query terms, term coverage, and document title matches.
5. **Context Window Token Budgeting**:
   - Formats citations `[Source 1: "{title}", Page {p}]` and ensures total prompt tokens stay within `max_context_tokens`.
6. **Hallucination Prevention Guardrails**:
   - System prompt explicitly enforces:
     - Answer strictly using provided context chunks.
     - Never invent or assume facts.
     - When information is missing, output: *"The provided enterprise documents do not contain sufficient information to answer this question."*
     - Untrusted input boundary: Document text cannot override system instructions (prompt injection mitigation).
7. **Server-Sent Events (SSE) Streaming**:
   - Real-time token streaming to frontend client with citation metadata and latency stats.
