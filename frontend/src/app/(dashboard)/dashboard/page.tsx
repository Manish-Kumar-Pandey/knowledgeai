'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api';
import {
  FileText,
  MessageSquare,
  Users,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => ApiClient.get('/analytics/overview'),
  });

  const metrics = analytics?.metrics || {
    totalDocuments: 0,
    indexedDocuments: 0,
    failedDocuments: 0,
    totalQueries: 0,
    activeUsers: 1,
    avgRetrievalLatencyMs: 0,
    avgGenerationLatencyMs: 0,
    userSatisfactionPct: 100,
    totalKnowledgeBases: 1,
  };

  const statCards = [
    {
      title: 'Indexed Documents',
      value: metrics.indexedDocuments,
      total: `${metrics.totalDocuments} Total`,
      icon: FileText,
      color: 'text-brand-500 bg-brand-500/10 border-brand-500/20',
      href: '/documents',
    },
    {
      title: 'Knowledge Bases',
      value: metrics.totalKnowledgeBases,
      total: 'Active Repositories',
      icon: Layers,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      href: '/knowledge-bases',
    },
    {
      title: 'RAG Queries Run',
      value: metrics.totalQueries,
      total: 'Conversations & Stream Queries',
      icon: MessageSquare,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      href: '/chat',
    },
    {
      title: 'Avg. Retrieval Latency',
      value: `${metrics.avgRetrievalLatencyMs}ms`,
      total: 'pgvector + FTS Hybrid Search',
      icon: Zap,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      href: '/analytics',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-brand-900/40 via-zinc-900 to-indigo-950/40 p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            Enterprise Hybrid RAG Activated
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome to KnowledgeAI Workspace
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Upload internal documentation, construct vectorized embeddings in pgvector, and query with verifiable source citations and minimal hallucination.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-colors"
            >
              Upload Document <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Launch AI Chat <MessageSquare className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Link
              key={i}
              href={c.href}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-5 shadow-sm hover:border-brand-500/40 dark:hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {c.title}
                </span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {isLoading ? '...' : c.value}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {c.total}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Content Split: Recent Queries & System Health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Search Queries */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Recent Queries & Telemetry
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Live user queries and retrieval response durations
              </p>
            </div>
            <Link
              href="/analytics"
              className="text-xs font-medium text-brand-500 hover:text-brand-400 inline-flex items-center gap-1"
            >
              View Analytics <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {analytics?.recentQueries && analytics.recentQueries.length > 0 ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {analytics.recentQueries.map((q: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 truncate pr-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {q.query}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {q.retrieval_duration_ms !== undefined && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        {q.retrieval_duration_ms}ms
                      </span>
                    )}
                    <span className="text-[11px] text-zinc-400">
                      {new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-10 w-10 text-zinc-400 mb-2 stroke-[1.5]" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No queries executed yet</p>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Once users begin querying your knowledge bases in AI Chat, retrieval telemetry and latency stats will appear here.
              </p>
              <Link
                href="/chat"
                className="mt-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Ask First Question
              </Link>
            </div>
          )}
        </div>

        {/* Knowledge Base Health Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              RAG Engine Status
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Active configuration parameters
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Vector Search</span>
              <span className="font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> pgvector HNSW
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Keyword Search</span>
              <span className="font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> PostgreSQL FTS
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Fusion Algorithm</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">RRF (k=60)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Embeddings</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">768-dim BGE</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Reranker</span>
              <span className="font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Enabled
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Link
              href="/settings/rag"
              className="text-xs font-semibold text-brand-500 hover:text-brand-400 flex items-center justify-center gap-1 w-full py-1.5"
            >
              Modify Retrieval Hyperparameters <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
