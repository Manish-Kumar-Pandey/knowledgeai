import { Response } from 'express';
import { query, queryOne, withTenantContext } from '../db/pool';
import { aiService } from '../ai/cloudflareAI.service';
import { HybridRetriever } from '../rag/retriever';
import { QueryRewriter } from '../rag/queryRewriter';
import { ContextBuilder } from '../rag/contextBuilder';
import { OrganizationService } from '../services/organization.service';
import { AppError } from '../middleware/errorHandler';
import { Conversation, Message, MessageCitation } from '../types';

export class ChatService {
  static async listConversations(organizationId: string, userId: string): Promise<Conversation[]> {
    return await query<Conversation>(
      `SELECT c.*, 
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) as message_count
       FROM conversations c
       WHERE c.organization_id = $1 AND c.user_id = $2
       ORDER BY c.updated_at DESC`,
      [organizationId, userId]
    );
  }

  static async getConversation(organizationId: string, userId: string, conversationId: string) {
    const conv = await queryOne<Conversation>(
      `SELECT * FROM conversations WHERE organization_id = $1 AND id = $2 AND user_id = $3`,
      [organizationId, conversationId, userId]
    );

    if (!conv) {
      throw new AppError('Conversation not found', 404);
    }

    const messages = await query<Message>(
      `SELECT m.*, 
        (SELECT json_agg(c) FROM message_citations c WHERE c.message_id = m.id) as citations,
        (SELECT json_build_object('rating', f.rating, 'comment', f.comment) FROM feedback f WHERE f.message_id = m.id AND f.user_id = $1) as feedback
       FROM messages m
       WHERE m.conversation_id = $2 AND m.organization_id = $3
       ORDER BY m.created_at ASC`,
      [userId, conversationId, organizationId]
    );

    return {
      conversation: conv,
      messages,
    };
  }

  static async createConversation(
    organizationId: string,
    userId: string,
    title?: string,
    selectedKbIds: string[] = []
  ): Promise<Conversation> {
    const defaultTitle = title || 'New Conversation';
    const conv = await queryOne<Conversation>(
      `INSERT INTO conversations (organization_id, user_id, title, selected_kb_ids)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [organizationId, userId, defaultTitle, selectedKbIds]
    );
    return conv!;
  }

  static async updateConversation(
    organizationId: string,
    userId: string,
    conversationId: string,
    updates: { title?: string; selected_kb_ids?: string[] }
  ): Promise<Conversation> {
    const conv = await queryOne<Conversation>(
      `SELECT * FROM conversations WHERE organization_id = $1 AND id = $2 AND user_id = $3`,
      [organizationId, conversationId, userId]
    );
    if (!conv) throw new AppError('Conversation not found', 404);

    const title = updates.title || conv.title;
    const kbIds = updates.selected_kb_ids || conv.selected_kb_ids;

    const updated = await queryOne<Conversation>(
      `UPDATE conversations 
       SET title = $1, selected_kb_ids = $2, updated_at = NOW() 
       WHERE id = $3 AND organization_id = $4
       RETURNING *`,
      [title, kbIds, conversationId, organizationId]
    );

    return updated!;
  }

  static async deleteConversation(organizationId: string, userId: string, conversationId: string): Promise<void> {
    await query(
      `DELETE FROM conversations WHERE organization_id = $1 AND id = $2 AND user_id = $3`,
      [organizationId, conversationId, userId]
    );
  }

  /**
   * Main RAG Query Pipeline with Server-Sent Events (SSE) Streaming
   */
  static async streamChatMessage(params: {
    organizationId: string;
    userId: string;
    conversationId: string;
    question: string;
    res: Response;
  }): Promise<void> {
    const { organizationId, userId, conversationId, question, res } = params;

    // Verify conversation access
    const conv = await queryOne<Conversation>(
      `SELECT * FROM conversations WHERE organization_id = $1 AND id = $2 AND user_id = $3`,
      [organizationId, conversationId, userId]
    );
    if (!conv) {
      throw new AppError('Conversation not found or access denied', 404);
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const startTime = Date.now();

    try {
      // 1. Fetch recent conversation history
      const historyRows = await query<{ sender_type: 'user' | 'assistant'; content: string }>(
        `SELECT sender_type, content FROM messages 
         WHERE conversation_id = $1 AND organization_id = $2
         ORDER BY created_at DESC LIMIT 6`,
        [conversationId, organizationId]
      );
      const history = historyRows.reverse().map((r) => ({
        sender: r.sender_type,
        text: r.content,
      }));

      // 2. Query Rewriting
      const rewrittenQuery = await QueryRewriter.rewriteQuery(question, history);
      sendEvent('rewritten_query', { original: question, rewritten: rewrittenQuery });

      // 3. Retrieval Execution
      const retrievalStart = Date.now();
      const settings = await OrganizationService.getSettings(organizationId);

      const retrievedChunks = await HybridRetriever.search(organizationId, rewrittenQuery, {
        knowledgeBaseIds: conv.selected_kb_ids.length > 0 ? conv.selected_kb_ids : undefined,
        topK: settings.top_k,
        similarityThreshold: Number(settings.similarity_threshold),
        hybridVectorWeight: Number(settings.hybrid_vector_weight),
        hybridFtsWeight: Number(settings.hybrid_fts_weight),
        enableReranking: settings.reranking_enabled,
      });

      const retrievalDurationMs = Date.now() - retrievalStart;

      // 4. Build Guarded Context & Prompt
      const built = ContextBuilder.buildPromptWithContext(
        question,
        retrievedChunks,
        settings.max_context_tokens,
        history
      );

      // Emit Citations & Retrieval Metadata
      sendEvent('metadata', {
        retrievalDurationMs,
        citationsCount: built.citationMap.length,
        citations: built.citationMap,
      });

      // 5. Save User Message to Database
      await query(
        `INSERT INTO messages (conversation_id, organization_id, sender_type, content)
         VALUES ($1, $2, 'user', $3)`,
        [conversationId, organizationId, question]
      );

      // If conversation is titled "New Conversation", auto-name it from query
      if (conv.title === 'New Conversation') {
        const autoTitle = question.slice(0, 45).trim() + (question.length > 45 ? '...' : '');
        await query(`UPDATE conversations SET title = $1 WHERE id = $2`, [autoTitle, conversationId]);
        sendEvent('conversation_renamed', { id: conversationId, title: autoTitle });
      }

      // 6. Stream LLM Response
      const generationStart = Date.now();
      let fullAssistantResponse = '';

      await aiService.streamChatCompletion(
        built.messages,
        {
          onToken: (token: string) => {
            fullAssistantResponse += token;
            sendEvent('token', { token });
          },
          onComplete: async (completedText: string) => {
            const generationDurationMs = Date.now() - generationStart;

            // Save Assistant Message
            const msgRow = await queryOne<Message>(
              `INSERT INTO messages (
                conversation_id, organization_id, sender_type, content, 
                retrieval_duration_ms, generation_duration_ms, total_tokens
              ) VALUES ($1, $2, 'assistant', $3, $4, $5, $6)
              RETURNING *`,
              [
                conversationId,
                organizationId,
                completedText,
                retrievalDurationMs,
                generationDurationMs,
                Math.ceil((question.length + completedText.length) / 4),
              ]
            );

            // Save Message Citations
            if (msgRow && built.citationMap.length > 0) {
              for (const c of built.citationMap) {
                await query(
                  `INSERT INTO message_citations (
                    message_id, chunk_id, document_id, organization_id, 
                    citation_index, page_number, snippet, relevance_score
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                  [
                    msgRow.id,
                    c.chunkId,
                    c.documentId,
                    organizationId,
                    c.citationIndex,
                    c.pageNumber,
                    c.snippet,
                    c.score,
                  ]
                );
              }
            }

            // Update conversation updated_at
            await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);

            // Suggest 2 relevant follow-up questions
            const followUps = [
              `Can you elaborate on specific details from ${built.citationMap[0]?.documentTitle || 'the document'}?`,
              `Are there any compliance or exceptions mentioned?`,
            ];

            sendEvent('done', {
              messageId: msgRow?.id,
              totalDurationMs: Date.now() - startTime,
              retrievalDurationMs,
              generationDurationMs,
              suggestedFollowUps: followUps,
            });

            res.end();
          },
          onError: (err: Error) => {
            console.error('[Chat] Stream error:', err);
            sendEvent('error', { error: err.message });
            res.end();
          },
        },
        0.2
      );
    } catch (err: any) {
      console.error('[Chat] Unhandled stream exception:', err);
      sendEvent('error', { error: err.message || 'Stream processing failure' });
      res.end();
    }
  }

  static async submitFeedback(
    organizationId: string,
    userId: string,
    messageId: string,
    rating: 'thumbs_up' | 'thumbs_down',
    comment?: string
  ) {
    const feedback = await queryOne(
      `INSERT INTO feedback (message_id, user_id, organization_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (message_id, user_id) 
       DO UPDATE SET rating = $4, comment = $5, created_at = NOW()
       RETURNING *`,
      [messageId, userId, organizationId, rating, comment || null]
    );

    return feedback;
  }
}
