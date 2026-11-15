'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import {
  Zap,
  Clock,
  ThumbsUp,
  FileText,
  MessageSquare,
  Users,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

export default function AnalyticsDashboardPage() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => ApiClient.get('/analytics/overview'),
  });

  const metrics = analytics?.metrics || {
    totalDocuments: 0,
    indexedDocuments: 0,
    failedDocuments: 0,
    processingDocuments: 0,
    totalQueries: 0,
    activeUsers: 1,
    avgRetrievalLatencyMs: 0,
    avgGenerationLatencyMs: 0,
    userSatisfactionPct: 100,
    totalFeedback: 0,
  };

  const dailyVolume = analytics?.charts?.dailyVolume || [];
  const topDocuments = analytics?.charts?.topDocuments || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Stat Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Avg. Retrieval Latency</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">
            {metrics.avgRetrievalLatencyMs} ms
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">pgvector cosine & FTS query duration</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Avg. Generation Latency</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">
            {metrics.avgGenerationLatencyMs} ms
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">Cloudflare Workers AI time-to-completion</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>User Satisfaction</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <ThumbsUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">
            {metrics.userSatisfactionPct}%
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {metrics.totalFeedback} total helpful / unhelpful ratings
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Knowledge Base Queries</span>
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-500">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">
            {metrics.totalQueries}
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">Lifetime inquiries executed</p>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Query Trend */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Daily Query Volume
              </h3>
              <p className="text-xs text-zinc-400">Inquiries processed in the last 7 days</p>
            </div>
            <TrendingUp className="h-4 w-4 text-brand-500" />
          </div>

          <div className="h-64 w-full">
            {dailyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyVolume}>
                  <defs>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#27272a',
                      borderRadius: '0.75rem',
                      color: '#fafafa',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="queries"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorQueries)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <BarChart3 className="h-8 w-8 text-zinc-500 mb-2" />
                <p className="text-xs text-zinc-400">No volume recorded in the last 7 days</p>
              </div>
            )}
          </div>
        </div>

        {/* Frequently Accessed Documents (by Citations) */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Frequently Accessed Documents
              </h3>
              <p className="text-xs text-zinc-400">Ranked by citation occurrence count</p>
            </div>
            <FileText className="h-4 w-4 text-emerald-500" />
          </div>

          {topDocuments.length > 0 ? (
            <div className="space-y-4">
              {topDocuments.map((doc: any, idx: number) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-xs">
                      {doc.title}
                    </span>
                    <span className="font-mono text-zinc-400">{doc.citations_count} citations</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (doc.citations_count / (topDocuments[0]?.citations_count || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-56 text-center">
              <FileText className="h-8 w-8 text-zinc-500 mb-2" />
              <p className="text-xs text-zinc-400">No document citations registered yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
