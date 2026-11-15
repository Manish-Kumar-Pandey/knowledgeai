'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { ApiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import {
  Send,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  RefreshCw,
  BookmarkCheck,
  ChevronDown,
  Layers,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  FileText,
} from 'lucide-react';

export default function ChatWorkspacePage() {
  const queryClient = useQueryClient();
  const { openCitationModal } = useAppStore();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [currentCitations, setCurrentCitations] = useState<any[]>([]);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [retrievalStats, setRetrievalStats] = useState<{ durationMs?: number } | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [selectedKbFilter, setSelectedKbFilter] = useState<string[]>([]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Fetch Knowledge Bases
  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => ApiClient.get('/knowledge-bases'),
  });

  // Fetch Conversations List
  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => ApiClient.get('/chat/conversations'),
  });

  // Auto-select or create initial conversation
  useEffect(() => {
    if (!activeConvId && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  // Fetch Active Conversation Messages
  const { data: activeConvData, refetch: refetchActiveConv } = useQuery({
    queryKey: ['chat-messages', activeConvId],
    queryFn: () => (activeConvId ? ApiClient.get(`/chat/conversations/${activeConvId}`) : null),
    enabled: Boolean(activeConvId),
  });

  const messages = activeConvData?.messages || [];

  // Scroll to bottom on message or token update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Create Conversation Mutation
  const createConvMutation = useMutation({
    mutationFn: () =>
      ApiClient.post('/chat/conversations', {
        title: 'New Conversation',
        selectedKbIds: selectedKbFilter,
      }),
    onSuccess: (newConv: any) => {
      refetchConversations();
      setActiveConvId(newConv.id);
      setStreamingText('');
      setCurrentCitations([]);
      setSuggestedFollowUps([]);
    },
  });

  // Delete Conversation Mutation
  const deleteConvMutation = useMutation({
    mutationFn: (id: string) => ApiClient.delete(`/chat/conversations/${id}`),
    onSuccess: () => {
      refetchConversations();
      setActiveConvId(null);
    },
  });

  // Feedback Mutation
  const feedbackMutation = useMutation({
    mutationFn: (params: { messageId: string; rating: 'thumbs_up' | 'thumbs_down' }) =>
      ApiClient.post(`/chat/messages/${params.messageId}/feedback`, { rating: params.rating }),
    onSuccess: () => {
      refetchActiveConv();
    },
  });

  // Send Message / Trigger Streaming RAG
  const handleSendMessage = async (textToSend?: string) => {
    const question = (textToSend || inputQuery).trim();
    if (!question || isStreaming) return;

    let convId = activeConvId;
    if (!convId) {
      const created = await ApiClient.post('/chat/conversations', {
        title: question.slice(0, 30),
        selectedKbIds: selectedKbFilter,
      });
      convId = created.id;
      setActiveConvId(created.id);
      refetchConversations();
    }

    setInputQuery('');
    setIsStreaming(true);
    setStreamingText('');
    setCurrentCitations([]);
    setSuggestedFollowUps([]);
    setRetrievalStats(null);

    try {
      await ApiClient.streamChat(convId!, question, {
        onMetadata: (data) => {
          setRetrievalStats({ durationMs: data.retrievalDurationMs });
          setCurrentCitations(data.citations || []);
        },
        onToken: (token) => {
          setStreamingText((prev) => prev + token);
        },
        onRenamed: () => {
          refetchConversations();
        },
        onDone: (data) => {
          setIsStreaming(false);
          setStreamingText('');
          if (data.suggestedFollowUps) {
            setSuggestedFollowUps(data.suggestedFollowUps);
          }
          refetchActiveConv();
        },
        onError: (err) => {
          setIsStreaming(false);
          setStreamingText(`[System Error: ${err.message}]`);
        },
      });
    } catch (err: any) {
      setIsStreaming(false);
      setStreamingText(`[Connection Error: ${err.message}]`);
    }
  };

  const copyToClipboard = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl overflow-hidden">
      {/* Left Chat History Pane */}
      <div className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 flex flex-col justify-between hidden md:flex">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Conversations
            </span>
            <button
              onClick={() => createConvMutation.mutate()}
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-500 shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>

          {/* Conversations List */}
          <div className="space-y-1 overflow-y-auto max-h-[50vh]">
            {conversations.map((c: any) => (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                  activeConvId === c.id
                    ? 'bg-brand-500/10 text-brand-500 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <span className="truncate max-w-[160px]">{c.title || 'Untitled Session'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this conversation?')) {
                      deleteConvMutation.mutate(c.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge Base Scoping Selection */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-brand-500" />
            Knowledge Base Scope
          </label>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-600 dark:text-zinc-300">
            {knowledgeBases.length > 0 ? (
              <p className="text-[11px] text-zinc-400">
                Searching all active enterprise knowledge bases ({knowledgeBases.length} repositories)
              </p>
            ) : (
              <p className="text-[11px] text-amber-500">No knowledge bases found. Upload docs to start.</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Conversation View */}
      <div className="flex-1 flex flex-col justify-between bg-white dark:bg-zinc-950 min-w-0">
        {/* Messages Stream Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && !streamingText && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 max-w-lg mx-auto space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-xl shadow-brand-500/25">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Ask KnowledgeAI
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Direct questions to your enterprise knowledge base. Answers are generated strictly with retrieved source citations.
                </p>
              </div>

              {/* Sample Starters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
                {[
                  'What are the core operating hours and remote policies?',
                  'What is the security protocol for P1 outage incidents?',
                  'Summarize the database migration and rollback SOP.',
                  'What are the encryption standards for data at rest?',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 text-left text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-brand-500/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-all"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Persistent Messages */}
          {messages.map((m: any) => {
            const isUser = m.sender_type === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-sm ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-5 py-4 max-w-2xl space-y-3 ${
                    isUser
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-sm'
                  }`}
                >
                  <div className="prose dark:prose-invert prose-xs max-w-none leading-relaxed break-words font-normal">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>

                  {/* Render Citations Tray if Assistant Message */}
                  {!isUser && m.citations && m.citations.length > 0 && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        <BookmarkCheck className="h-3.5 w-3.5 text-brand-500" />
                        Verified Source Citations ({m.citations.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {m.citations.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => openCitationModal(c)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-brand-500 transition-colors shadow-2xs"
                          >
                            <span className="font-semibold text-brand-500">[{c.citation_index}]</span>
                            <span className="truncate max-w-[120px]">{c.document_title || 'Doc'}</span>
                            <span className="text-[10px] text-zinc-400">p.{c.page_number || 1}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assistant Footer Telemetry & Feedback */}
                  {!isUser && (
                    <div className="flex items-center justify-between pt-2 text-[11px] text-zinc-400">
                      <div className="flex items-center gap-3">
                        {m.retrieval_duration_ms !== undefined && (
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            retrieval: {m.retrieval_duration_ms}ms
                          </span>
                        )}
                        {m.generation_duration_ms !== undefined && (
                          <span className="font-mono text-zinc-400">
                            gen: {m.generation_duration_ms}ms
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(m.content, m.id)}
                          title="Copy answer"
                          className="hover:text-zinc-200 p-1 rounded"
                        >
                          {copiedMsgId === m.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => feedbackMutation.mutate({ messageId: m.id, rating: 'thumbs_up' })}
                          title="Helpful answer"
                          className={`hover:text-emerald-400 p-1 rounded ${
                            m.feedback?.rating === 'thumbs_up' ? 'text-emerald-400 font-bold' : ''
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => feedbackMutation.mutate({ messageId: m.id, rating: 'thumbs_down' })}
                          title="Not helpful"
                          className={`hover:text-red-400 p-1 rounded ${
                            m.feedback?.rating === 'thumbs_down' ? 'text-red-400 font-bold' : ''
                          }`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Active Streaming Token Bubble */}
          {isStreaming && (
            <div className="flex gap-3 text-sm justify-start animate-in fade-in duration-150">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4 animate-spin" />
              </div>
              <div className="rounded-2xl px-5 py-4 max-w-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-sm space-y-3">
                {retrievalStats && (
                  <div className="flex items-center gap-2 text-xs text-emerald-500 font-mono">
                    <Check className="h-3 w-3" /> Retrieved {currentCitations.length} chunks ({retrievalStats.durationMs}ms)
                  </div>
                )}
                <div className="prose dark:prose-invert prose-xs max-w-none leading-relaxed">
                  <ReactMarkdown>{streamingText || 'Synthesizing response from verified documents...'}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Suggested Follow-Ups */}
          {suggestedFollowUps.length > 0 && !isStreaming && (
            <div className="pt-2 flex flex-wrap gap-2">
              <span className="text-xs text-zinc-400 font-medium self-center mr-1">Suggested:</span>
              {suggestedFollowUps.map((su, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(su)}
                  className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300 hover:bg-brand-500/20 transition-colors"
                >
                  {su}
                </button>
              ))}
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Query Input Box */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex items-center"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isStreaming}
              placeholder="Ask a question about your enterprise documents..."
              className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 py-3.5 pl-5 pr-14 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-sm disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isStreaming}
              className="absolute right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md hover:bg-brand-500 disabled:opacity-40 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <span>Answers generated with low-hallucination hybrid RAG guardrails.</span>
            <span>Cloudflare Workers AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
