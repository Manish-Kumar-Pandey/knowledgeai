'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { FileText, X, ExternalLink, BookmarkCheck } from 'lucide-react';

export function CitationModal() {
  const { activeCitationModal, closeCitationModal } = useAppStore();
  const { isOpen, citation } = activeCitationModal;

  if (!isOpen || !citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-500">
                  Source [{citation.citationIndex || 1}]
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Page {citation.pageNumber || 1}
                </span>
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-md">
                {citation.documentTitle || 'Source Document'}
              </h3>
            </div>
          </div>
          <button
            onClick={closeCitationModal}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {citation.score !== undefined && (
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                <BookmarkCheck className="h-4 w-4 text-emerald-500" />
                Retrieved via Hybrid Vector & FTS Match
              </span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                Confidence: {Math.round(citation.score * 100)}%
              </span>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Extracted Context Chunk
            </h4>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 font-normal">
              {citation.snippet || citation.content}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-6 py-3.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Document ID: <code className="text-xs">{citation.documentId ? citation.documentId.slice(0, 8) : 'n/a'}...</code>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={closeCitationModal}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
            <a
              href={`/documents`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Manage Documents
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
