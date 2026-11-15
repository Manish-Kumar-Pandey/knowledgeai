'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/utils';
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCode,
  File,
  Eye,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKbId, setSelectedKbId] = useState<string>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Upload Form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKbId, setUploadKbId] = useState<string>('');
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch KBs
  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => ApiClient.get('/knowledge-bases'),
  });

  // Fetch Documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', selectedKbId, searchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedKbId !== 'all') params.set('kbId', selectedKbId);
      if (searchTerm) params.set('search', searchTerm);
      return ApiClient.get(`/documents?${params.toString()}`);
    },
    refetchInterval: 4000, // Poll to reflect processing -> indexed status updates
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Please select a document to upload');
      if (!uploadKbId) throw new Error('Please select a target knowledge base');

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('knowledgeBaseId', uploadKbId);
      if (uploadTitle.trim()) {
        formData.append('title', uploadTitle.trim());
      }

      return ApiClient.post('/documents/upload', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadError(null);
    },
    onError: (err: any) => {
      setUploadError(err.message || 'Upload failed');
    },
  });

  // Reindex Mutation
  const reindexMutation = useMutation({
    mutationFn: (id: string) => ApiClient.post(`/documents/${id}/reindex`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => ApiClient.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const getStatusBadge = (status: string, errorMessage?: string) => {
    switch (status) {
      case 'indexed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Indexed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-500">
            <RefreshCw className="h-3 w-3 animate-spin" /> Ingesting...
          </span>
        );
      case 'pending':
      case 'uploaded':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
            <Clock className="h-3 w-3" /> Queued
          </span>
        );
      case 'failed':
        return (
          <span
            title={errorMessage}
            className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-500 cursor-help"
          >
            <AlertCircle className="h-3 w-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
            {status}
          </span>
        );
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'docx':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'md':
        return <FileCode className="h-4 w-4 text-emerald-500" />;
      default:
        return <File className="h-4 w-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or filename..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="relative">
            <select
              value={selectedKbId}
              onChange={(e) => setSelectedKbId(e.target.value)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 py-2.5 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none"
            >
              <option value="all">All Knowledge Bases</option>
              {knowledgeBases.map((kb: any) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            if (knowledgeBases.length > 0 && !uploadKbId) {
              setUploadKbId(knowledgeBases[0].id);
            }
            setIsUploadOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-500 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Ingest Document
        </button>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Document Title & Name</th>
                <th className="py-3 px-4">Knowledge Base</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Chunks</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Uploaded</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Loading documents...
                  </td>
                </tr>
              ) : documents.length > 0 ? (
                documents.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                          {getFileIcon(doc.file_type)}
                        </div>
                        <div className="max-w-xs truncate">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">{doc.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                      {doc.knowledge_base_name || 'General'}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(doc.status, doc.error_message)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium">
                      {doc.chunk_count || 0}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono font-medium">
                        v{doc.current_version}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">
                      {formatBytes(parseInt(doc.file_size_bytes, 10))}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={async () => {
                            const details = await ApiClient.get(`/documents/${doc.id}`);
                            setPreviewDoc(details);
                          }}
                          title="Preview chunks & metadata"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-brand-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => reindexMutation.mutate(doc.id)}
                          title="Re-index document"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete document "${doc.title}"? Chunks and embeddings will be purged.`)) {
                              deleteMutation.mutate(doc.id);
                            }
                          }}
                          title="Delete document"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <FileText className="h-10 w-10 text-zinc-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No documents found</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Upload your first enterprise PDF, DOCX, TXT, or Markdown file to index.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Upload & Ingest Enterprise Document
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="space-y-4 pt-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
                }`}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Upload className="h-8 w-8 text-brand-500 mb-2" />
                {uploadFile ? (
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {uploadFile.name}
                    </p>
                    <p className="text-[11px] text-zinc-400">{formatBytes(uploadFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Click to browse or drag file here
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Supports PDF, DOCX, TXT, Markdown (Max 25MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Target Knowledge Base */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Target Knowledge Base
                </label>
                <select
                  value={uploadKbId}
                  onChange={(e) => setUploadKbId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none"
                >
                  {knowledgeBases.map((kb: any) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title Override */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Q4 Security & Compliance Guidelines"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => uploadMutation.mutate()}
                  disabled={!uploadFile || uploadMutation.isPending}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Uploading & Enqueuing...' : 'Start Ingestion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Chunks Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {previewDoc.title}
                </h3>
                <p className="text-xs text-zinc-400">
                  {previewDoc.file_name} • {previewDoc.chunk_count} chunks indexed • Version v{previewDoc.current_version}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Sample Indexed Chunks in pgvector
              </h4>
              {previewDoc.chunks && previewDoc.chunks.length > 0 ? (
                previewDoc.chunks.map((c: any) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px]">
                      <span>Chunk #{c.chunk_index} • Page {c.page_number || 1}</span>
                      <span>ID: {c.id.slice(0, 8)}...</span>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
                      {c.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 italic">No chunk records stored yet.</p>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
