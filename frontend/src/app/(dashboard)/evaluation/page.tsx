'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api';
import {
  CheckCircle2,
  Play,
  RotateCcw,
  Target,
  Sparkles,
  Zap,
  Clock,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function EvaluationPage() {
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<any | null>(null);

  // Fetch Dataset
  const { data: datasetData, isLoading: isDatasetLoading } = useQuery({
    queryKey: ['evaluation-dataset'],
    queryFn: () => ApiClient.get('/evaluations/dataset'),
  });

  // Fetch Runs
  const { data: runs = [], isLoading: isRunsLoading } = useQuery({
    queryKey: ['evaluation-runs'],
    queryFn: () => ApiClient.get('/evaluations/runs'),
  });

  // Run Evaluation Mutation
  const runMutation = useMutation({
    mutationFn: (datasetId: string) => ApiClient.post('/evaluations/run', { datasetId }),
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: ['evaluation-runs'] });
      setSelectedRun(newRun);
    },
  });

  const dataset = datasetData?.dataset;
  const items = datasetData?.items || [];
  const latestRun = selectedRun || (runs.length > 0 ? runs[0] : null);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Automated RAG Benchmarking
            </span>
            <span className="text-xs text-zinc-400">
              {items.length} Benchmark Questions Loaded
            </span>
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {dataset?.name || 'Core Enterprise Benchmark Dataset'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Empirically evaluate hybrid retrieval precision, reciprocal rank, faithfulness, and answer relevance across actual database documents.
          </p>
        </div>

        <button
          onClick={() => {
            if (dataset) runMutation.mutate(dataset.id);
          }}
          disabled={runMutation.isPending || !dataset}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-500 disabled:opacity-50 transition-colors"
        >
          {runMutation.isPending ? (
            <>
              <RotateCcw className="h-4 w-4 animate-spin" /> Evaluating RAG System...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white" /> Run Benchmark Experiment
            </>
          )}
        </button>
      </div>

      {/* Latest Run Results Cards */}
      {latestRun ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Latest Benchmark Run Results ({formatDate(latestRun.run_at)})
            </h3>
            <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> Validated from {latestRun.details?.length || 0} Test Questions
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-zinc-400 block">MRR (Mean Recip. Rank)</span>
              <div className="mt-2 text-2xl font-bold text-brand-500 font-mono">
                {latestRun.mrr}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">First relevant document rank</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-zinc-400 block">Precision@K</span>
              <div className="mt-2 text-2xl font-bold text-indigo-500 font-mono">
                {(latestRun.precision_at_k * 100).toFixed(1)}%
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Relevant chunks in retrieved set</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-zinc-400 block">Faithfulness</span>
              <div className="mt-2 text-2xl font-bold text-emerald-500 font-mono">
                {(latestRun.faithfulness_score * 100).toFixed(1)}%
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Groundedness in context</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-zinc-400 block">Answer Relevance</span>
              <div className="mt-2 text-2xl font-bold text-blue-500 font-mono">
                {(latestRun.answer_relevance_score * 100).toFixed(1)}%
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Direct query addressing score</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-zinc-400 block">Retrieval Latency</span>
              <div className="mt-2 text-2xl font-bold text-amber-500 font-mono">
                {latestRun.avg_retrieval_latency_ms} ms
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Hybrid search & RRF execution</p>
            </div>
          </div>

          {/* Test Questions and Outputs Table */}
          {latestRun.details && latestRun.details.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Experiment Itemized Breakdown
                </h4>
                <span className="text-xs text-zinc-400">
                  {latestRun.details.length} questions tested
                </span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                {latestRun.details.map((d: any, idx: number) => (
                  <div key={idx} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        Q: {d.question}
                      </span>
                      <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                        <span className="text-emerald-500 font-bold">
                          Faithfulness: {(d.faithfulness * 100).toFixed(0)}%
                        </span>
                        <span className="text-blue-500 font-bold">
                          MRR: {d.reciprocalRank}
                        </span>
                        <span className="text-zinc-400">
                          {d.retrievalDurationMs}ms
                        </span>
                      </div>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-300 text-xs bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                      <span className="font-semibold text-zinc-400 uppercase text-[10px] block mb-1">
                        AI Generated Answer:
                      </span>
                      {d.generatedAnswer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 py-16 text-center">
          <Target className="h-12 w-12 text-zinc-400 mb-3" />
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            No Evaluation Runs Executed Yet
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            Click "Run Benchmark Experiment" above to evaluate retrieval precision, MRR, and faithfulness against the enterprise test dataset.
          </p>
        </div>
      )}

      {/* Benchmark Test Questions Registry */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Registered Benchmark Dataset Questions
          </h3>
          <p className="text-xs text-zinc-400">
            Standard questions verifying document understanding and absence of hallucinations
          </p>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {items.map((it: any, i: number) => (
            <div key={i} className="py-3 text-xs space-y-1">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {i + 1}. {it.question}
              </span>
              <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                Expected Target: {it.expected_answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
