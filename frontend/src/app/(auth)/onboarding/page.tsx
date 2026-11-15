'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, CheckCircle2, ArrowRight, Upload, Layers, MessageSquare } from 'lucide-react';

export default function OnboardingPage() {
  const steps = [
    {
      title: '1. Create a Knowledge Base',
      desc: 'Isolate departmental documentation (e.g. Engineering, HR, Legal).',
      href: '/knowledge-bases',
      icon: Layers,
    },
    {
      title: '2. Ingest Enterprise Documents',
      desc: 'Upload PDF, DOCX, TXT, or Markdown files with automated recursive chunking & embeddings.',
      href: '/documents',
      icon: Upload,
    },
    {
      title: '3. Verify Citations & Chat',
      desc: 'Query your documents using hybrid retrieval, RRF ranking, and streaming answers.',
      href: '/chat',
      icon: MessageSquare,
    },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-2xl space-y-8 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 backdrop-blur-xl">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/25 mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome to KnowledgeAI</h1>
          <p className="text-sm text-zinc-400">
            Follow this 3-step guide to index your enterprise knowledge and begin querying.
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <Link
                key={idx}
                href={s.href}
                className="group flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 hover:border-brand-500/50 hover:bg-zinc-900/80 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">
                      {s.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{s.desc}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
              </Link>
            );
          })}
        </div>

        <div className="pt-4 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:opacity-95"
          >
            Enter Workspace Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
