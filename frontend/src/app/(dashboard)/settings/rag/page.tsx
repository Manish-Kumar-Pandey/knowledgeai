'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api';
import { Sliders, Save, Check, RefreshCw, Zap, SlidersHorizontal, ShieldCheck } from 'lucide-react';

export default function RagSettingsPage() {
  const queryClient = useQueryClient();
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
  const [topK, setTopK] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.65);
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(150);
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [ftsWeight, setFtsWeight] = useState(0.3);
  const [rerankingEnabled, setRerankingEnabled] = useState(true);
  const [maxContextTokens, setMaxContextTokens] = useState(3500);

  // Fetch Current Settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => ApiClient.get('/organizations/settings'),
  });

  useEffect(() => {
    if (settings) {
      if (settings.top_k !== undefined) setTopK(settings.top_k);
      if (settings.similarity_threshold !== undefined) setSimilarityThreshold(parseFloat(settings.similarity_threshold));
      if (settings.chunk_size !== undefined) setChunkSize(settings.chunk_size);
      if (settings.chunk_overlap !== undefined) setChunkOverlap(settings.chunk_overlap);
      if (settings.hybrid_vector_weight !== undefined) setVectorWeight(parseFloat(settings.hybrid_vector_weight));
      if (settings.hybrid_fts_weight !== undefined) setFtsWeight(parseFloat(settings.hybrid_fts_weight));
      if (settings.reranking_enabled !== undefined) setRerankingEnabled(settings.reranking_enabled);
      if (settings.max_context_tokens !== undefined) setMaxContextTokens(settings.max_context_tokens);
    }
  }, [settings]);

  // Update Settings Mutation
  const updateMutation = useMutation({
    mutationFn: (newSettings: any) => ApiClient.put('/organizations/settings', newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      top_k: Number(topK),
      similarity_threshold: Number(similarityThreshold),
      chunk_size: Number(chunkSize),
      chunk_overlap: Number(chunkOverlap),
      hybrid_vector_weight: Number(vectorWeight),
      hybrid_fts_weight: Number(ftsWeight),
      reranking_enabled: Boolean(rerankingEnabled),
      max_context_tokens: Number(maxContextTokens),
    });
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-brand-500" />
            RAG Pipeline Hyperparameters
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Tune chunking granularities, hybrid search weights, and reranking thresholds without code deployments
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            <Check className="h-4 w-4" /> Parameters Saved to Database
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Retrieval & Threshold Settings */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-500" /> Retrieval Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Top K */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Top-K Chunks to Retrieve
                </label>
                <span className="font-mono text-brand-500 font-bold">{topK}</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                className="w-full accent-brand-500"
              />
              <p className="text-[11px] text-zinc-400">
                Number of chunks fed into the final LLM context window after RRF ranking.
              </p>
            </div>

            {/* Similarity Threshold */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Cosine Similarity Threshold
                </label>
                <span className="font-mono text-brand-500 font-bold">{similarityThreshold}</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="0.95"
                step="0.05"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                className="w-full accent-brand-500"
              />
              <p className="text-[11px] text-zinc-400">
                Minimum cosine vector similarity required for candidate inclusion.
              </p>
            </div>
          </div>
        </div>

        {/* Chunking Strategies */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Document Ingestion Chunking Strategy
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Chunk Size */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Chunk Character Target Size
                </label>
                <span className="font-mono text-brand-500 font-bold">{chunkSize} chars</span>
              </div>
              <input
                type="number"
                min="300"
                max="2500"
                step="50"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-zinc-100"
              />
              <p className="text-[11px] text-zinc-400">
                Approximately 150-300 tokens per chunk. Used by recursive character splitter.
              </p>
            </div>

            {/* Chunk Overlap */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Sliding Chunk Overlap
                </label>
                <span className="font-mono text-brand-500 font-bold">{chunkOverlap} chars</span>
              </div>
              <input
                type="number"
                min="0"
                max="500"
                step="25"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-zinc-100"
              />
              <p className="text-[11px] text-zinc-400">
                Maintains semantic continuity across adjoining document chunks.
              </p>
            </div>
          </div>
        </div>

        {/* Hybrid Search & RRF Weights */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Hybrid Search & Reciprocal Rank Fusion (RRF)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Vector Weight */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Vector Similarity Weight (pgvector)
                </label>
                <span className="font-mono text-brand-500 font-bold">{vectorWeight}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={vectorWeight}
                onChange={(e) => setVectorWeight(parseFloat(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>

            {/* FTS Weight */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Keyword Full-Text Weight (Postgres FTS)
                </label>
                <span className="font-mono text-brand-500 font-bold">{ftsWeight}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={ftsWeight}
                onChange={(e) => setFtsWeight(parseFloat(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 text-xs">
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                Enable Cross-Encoder Reranker
              </span>
              <span className="text-zinc-400 text-[11px]">
                Rescores RRF candidates against exact query terms before context generation.
              </span>
            </div>
            <input
              type="checkbox"
              checked={rerankingEnabled}
              onChange={(e) => setRerankingEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-zinc-700 accent-brand-600"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-500 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Saving Changes...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save RAG Hyperparameters
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
