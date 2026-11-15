# KnowledgeAI – Enterprise Knowledge Base AI Assistant

[![CI Pipeline](https://github.com/your-org/knowledgeai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/knowledgeai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js%2015-black)](https://nextjs.org)
[![PostgreSQL + pgvector](https://img.shields.io/badge/Database-pgvector-336791)](https://github.com/pgvector/pgvector)
[![Cloudflare Workers AI](https://img.shields.io/badge/Inference-Cloudflare%20Workers%20AI-F38020)](https://developers.cloudflare.com/workers-ai/)

**KnowledgeAI** is a production-oriented SaaS application enabling organizations to ingest unstructured documents (PDF, DOCX, TXT, Markdown), build an intelligent knowledge base with hybrid vector and keyword search (pgvector + PostgreSQL full-text search), and interact with verified document context through a streaming AI conversational interface with citations.

---

## Architecture Overview

```
                                  +---------------------------------------+
                                  |   Next.js 15+ App Router Client       |
                                  |   (Linear/Notion-inspired SaaS UI)    |
                                  +-------------------+-------------------+
                                                      |
                                   REST & SSE Streams | HTTPS
                                                      v
                                  +---------------------------------------+
                                  |    Express.js Layered Backend         |
                                  |    (JWT, Tenant Isolation, RBAC)      |
                                  +-------------------+-------------------+
                                                      |
                       +------------------------------+------------------------------+
                       |                                                             |
                       v                                                             v
        +------------------------------+                              +------------------------------+
        |   PostgreSQL-backed Queue    |                              |   Hybrid RAG Orchestration   |
        |  (SKIP LOCKED Worker Queue)  |                              |  (Query Rewrite, RRF, Rerank)|
        +--------------+---------------+                              +--------------+---------------+
                       |                                                             |
                       v                                                             v
        +------------------------------+                              +------------------------------+
        |  Doc Ingestion Pipeline      |                              |  pgvector & Postgres FTS     |
        |  (Extract, Clean, Chunk)     |                              |  (HNSW 768-dim Cosine Match) |
        +--------------+---------------+                              +--------------+---------------+
                       |                                                             |
                       +------------------------------+------------------------------+
                                                      |
                                                      v
                                      +-------------------------------+
                                      |   Cloudflare Workers AI       |
                                      |   Embeddings: bge-base-en-v1.5|
                                      |   LLM: llama-3.1-8b-instruct  |
                                      +-------------------------------+
```

---

## Key Features

1. **Enterprise Multi-Tenancy & Security**:
   - Strict organization-level database isolation with PostgreSQL Row-Level Security (RLS).
   - Role-Based Access Control (RBAC): `super_admin`, `org_admin`, `kb_manager`, and `employee`.
   - JWT access & refresh tokens, bcrypt password hashing, and API rate limiting.
2. **Multi-Format Document Ingestion**:
   - Ingest **PDF**, **DOCX**, **TXT**, and **Markdown** (up to 25MB per file).
   - Duplicate prevention using SHA-256 content hashes.
   - Automatic document versioning (`v1`, `v2`, etc.).
   - Resilient background worker queue with atomic locking (`FOR UPDATE SKIP LOCKED`) and automatic retry with dead-letter logging.
3. **Advanced Modular RAG Pipeline**:
   - **Recursive Character Chunking**: Paragraph-aware text splitting with sliding overlap (configurable).
   - **Hybrid Retrieval**: Combines pgvector cosine similarity (`<->`) with PostgreSQL full-text search (`tsvector` & BM25-style ranking).
   - **Reciprocal Rank Fusion (RRF)**: Balances dense semantic similarity with sparse keyword precision ($k = 60$).
   - **Query Rewriting & Multi-Query Expansion**: Reformulates ambiguous conversational questions into standalone retrieval queries.
   - **Cross-Score Reranking**: Re-elevates chunks with exact query phrase matches and term coverage.
   - **Parent-Child Surrounding Context Expansion**: Option to retrieve adjacent chunks for narrative continuity.
4. **Streaming Conversational Interface**:
   - Real-time response streaming via Server-Sent Events (SSE).
   - Clickable source citations with chunk preview modal (document title, page number, confidence score).
   - Interactive feedback collection (thumbs-up / thumbs-down with comments).
   - Follow-up question generation.
5. **Analytics & Evaluation Framework**:
   - Quantitative evaluation tracking: **Mean Reciprocal Rank (MRR)**, **Precision@K**, **Recall@K**, **Faithfulness**, and **Answer Relevance**.
   - Interactive telemetry dashboard: query volumes, retrieval latency, generation latency, and most cited documents.

---

## Technology Stack

- **Frontend**: Next.js 15+ (App Router), TypeScript, Tailwind CSS, Lucide React, TanStack Query, React Hook Form, Zod, Recharts, Zustand.
- **Backend**: Node.js 22, Express.js, TypeScript, Multer, `pdf-parse`, `mammoth`, Swagger/OpenAPI.
- **Database & Vectors**: PostgreSQL 16 with `pgvector` and `pg_trgm` extensions, HNSW cosine index.
- **AI & Embeddings**: Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5` 768-dim embeddings, `@cf/meta/llama-3.1-8b-instruct` LLM) with seamless deterministic fallback adapter.
- **Storage**: Storage provider abstraction supporting local filesystem and Supabase Storage bucket.
- **Queue**: PostgreSQL-backed resilient transactional job queue.

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) OR
- Node.js 20+ and PostgreSQL 16+ with `pgvector` extension installed.

### Option A: Quickstart with Docker Compose (Recommended)

1. Clone repository:
   ```bash
   git clone https://github.com/your-username/knowledgeai.git
   cd knowledgeai
   ```

2. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

3. Start all services (Postgres + pgvector, Backend, Background Worker, Frontend):
   ```bash
   docker compose up --build
   ```

4. Access applications:
   - **Frontend Workspace**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:5000](http://localhost:5000)
   - **Interactive OpenAPI / Swagger UI**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

5. Default Demo Credentials:
   - **Email**: `admin@knowledgeai.internal`
   - **Password**: `Password123!`
   - **Role**: `org_admin`

---

### Option B: Local Development Setup

#### 1. Database Setup
Ensure PostgreSQL has `pgvector` installed, then run migrations and seed data:
```bash
cd backend
npm install
npm run migrate
npm run seed
```

#### 2. Start Backend & Worker
```bash
# Terminal 1 (API Server)
npm run dev

# Terminal 2 (Background Ingestion Worker)
npm run worker
```

#### 3. Start Frontend Client
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## API Endpoints Overview

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register user & create tenant workspace | Public |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT tokens | Public |
| `GET` | `/api/v1/knowledge-bases` | List knowledge bases in active workspace | Authenticated |
| `POST` | `/api/v1/knowledge-bases` | Create a new knowledge base | `kb_manager`, `org_admin` |
| `POST` | `/api/v1/documents/upload` | Upload & enqueue document for ingestion | `kb_manager`, `org_admin` |
| `GET` | `/api/v1/documents` | List documents with chunk counts & status | Authenticated |
| `POST` | `/api/v1/documents/:id/reindex` | Trigger document re-indexing | `kb_manager`, `org_admin` |
| `POST` | `/api/v1/chat/conversations` | Create a new conversation session | Authenticated |
| `POST` | `/api/v1/chat/conversations/:id/messages/stream` | Stream RAG answer with source citations (SSE) | Authenticated |
| `POST` | `/api/v1/chat/messages/:id/feedback` | Submit thumbs-up / thumbs-down rating | Authenticated |
| `GET` | `/api/v1/analytics/overview` | Fetch real query counts, latencies, top docs | Authenticated |
| `POST` | `/api/v1/evaluations/run` | Execute automated RAG benchmark experiment | `kb_manager`, `org_admin` |

Interactive documentation is available at [http://localhost:5000/api-docs](http://localhost:5000/api-docs).

---

## Technical Interview Talking Points & Design Decisions

1. **Why Hybrid Search (pgvector + PostgreSQL Full-Text Search)?**
   - Pure semantic vector search excels at conceptual matching but struggles with exact entity codes, acronyms (e.g., *AES-256*, *SOP-14*), or unique alphanumeric model identifiers.
   - By pairing vector cosine similarity with Postgres `tsvector` using Reciprocal Rank Fusion ($k=60$), we achieve high precision on technical documents without external search cluster overhead (like Elasticsearch).
2. **Why PostgreSQL FOR UPDATE SKIP LOCKED for Background Ingestion?**
   - Eliminates the operational complexity and failure points of Redis or RabbitMQ in early-to-mid stage enterprise deployments.
   - Database transactions natively guarantee that document status, version updates, and job leases are atomic.
3. **Mitigating LLM Hallucinations**:
   - Strict prompt isolation: Document chunks are presented as untrusted data within `<CONTEXT>` tags.
   - Refusal mandate: If retrieved text does not contain factual justification, the model is strictly conditioned to decline rather than fabricate.
   - Source citations: Every factual assertion maps directly to a chunk index `[1]`, document title, and page number.
