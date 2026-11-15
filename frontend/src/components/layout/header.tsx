'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ShieldCheck, Cpu } from 'lucide-react';

const titleMap: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Workspace Overview', subtitle: 'Real-time telemetry and knowledge health' },
  '/chat': { title: 'Enterprise AI Assistant', subtitle: 'Low-hallucination conversational interface with verified citations' },
  '/knowledge-bases': { title: 'Knowledge Bases', subtitle: 'Isolated knowledge repositories for departments and domains' },
  '/documents': { title: 'Document Ingestion', subtitle: 'Ingest PDF, DOCX, TXT, and Markdown with recursive chunking' },
  '/analytics': { title: 'RAG Analytics', subtitle: 'Latency telemetry, search frequencies, and user satisfaction' },
  '/evaluation': { title: 'Evaluation & Benchmarks', subtitle: 'MRR, Faithfulness, Relevance, and retrieval precision experiments' },
  '/users': { title: 'Team & Roles', subtitle: 'Manage organization members and role-based access permissions' },
  '/settings': { title: 'Organization Settings', subtitle: 'Tenant profile and workspace configuration' },
  '/settings/rag': { title: 'RAG Configuration', subtitle: 'Fine-tune chunk size, hybrid search weights, and reranking parameters' },
};

export function Header() {
  const pathname = usePathname();
  const { currentOrganization } = useAppStore();

  const currentMeta = titleMap[pathname] || {
    title: 'KnowledgeAI Workspace',
    subtitle: currentOrganization?.name || 'Enterprise Workspace',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-6 backdrop-blur-md">
      <div>
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
          {currentMeta.title}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {currentMeta.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Cpu className="h-3.5 w-3.5 mr-0.5" />
          Cloudflare Workers AI Active
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-300">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
          Tenant Isolated: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currentOrganization?.name || 'Acme Global'}</span>
        </div>
      </div>
    </header>
  );
}
