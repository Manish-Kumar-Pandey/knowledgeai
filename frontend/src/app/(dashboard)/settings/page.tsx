'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Building, Sliders, ShieldCheck, Database, Server } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function OrganizationSettingsPage() {
  const { currentOrganization } = useAppStore();

  const { data: orgData } = useQuery({
    queryKey: ['org-details'],
    queryFn: () => ApiClient.get('/organizations/current'),
  });

  const org = orgData || currentOrganization;

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Organization Settings
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Tenant identity, active plan, and storage configuration
        </p>
      </div>

      {/* Org Profile Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500 text-xl font-bold">
            {org?.name?.charAt(0) || 'A'}
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {org?.name || 'Acme Global'}
            </h3>
            <p className="text-xs text-zinc-400 font-mono">Tenant Slug: {org?.slug || 'acme-global'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-1">
            <span className="text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
              Tenant ID (UUID)
            </span>
            <p className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
              {org?.id || '00000000-0000-0000-0000-000000000001'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-1">
            <span className="text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
              Subscription Plan
            </span>
            <p className="font-semibold text-emerald-500 capitalize">
              {org?.plan || 'Enterprise Dedicated'}
            </p>
          </div>
        </div>
      </div>

      {/* RAG Settings Quick Access */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            RAG Pipeline Hyperparameters
          </h3>
          <p className="text-xs text-zinc-400">
            Configure chunking strategies, hybrid weights, top-K retrieval, and reranking parameters.
          </p>
        </div>
        <Link
          href="/settings/rag"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-brand-500 transition-colors"
        >
          <Sliders className="h-4 w-4" /> Tune RAG Settings
        </Link>
      </div>
    </div>
  );
}
