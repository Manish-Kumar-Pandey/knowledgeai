import { query, queryOne } from '../db/pool';

export class AnalyticsService {
  /**
   * Aggregates real-time organization metrics directly from normalized database tables
   */
  static async getOverview(organizationId: string) {
    // 1. Document counts by status
    const docStats = await queryOne<{
      total: string;
      indexed: string;
      failed: string;
      processing: string;
    }>(
      `SELECT 
        COUNT(*)::text as total,
        COUNT(*) FILTER (WHERE status = 'indexed')::text as indexed,
        COUNT(*) FILTER (WHERE status = 'failed')::text as failed,
        COUNT(*) FILTER (WHERE status = 'processing' OR status = 'pending')::text as processing
       FROM documents 
       WHERE organization_id = $1`,
      [organizationId]
    );

    // 2. Query counts and latency metrics from messages
    const messageStats = await queryOne<{
      total_queries: string;
      avg_retrieval_ms: string;
      avg_generation_ms: string;
    }>(
      `SELECT 
        COUNT(*)::text as total_queries,
        COALESCE(AVG(retrieval_duration_ms)::int, 0)::text as avg_retrieval_ms,
        COALESCE(AVG(generation_duration_ms)::int, 0)::text as avg_generation_ms
       FROM messages 
       WHERE organization_id = $1 AND sender_type = 'assistant'`,
      [organizationId]
    );

    // 3. Active users (distinct users who chatted or uploaded in the last 30 days)
    const userStats = await queryOne<{ active_users: string }>(
      `SELECT COUNT(DISTINCT user_id)::text as active_users
       FROM conversations 
       WHERE organization_id = $1 AND updated_at >= NOW() - INTERVAL '30 days'`,
      [organizationId]
    );

    // 4. Feedback satisfaction
    const feedbackStats = await queryOne<{
      total_feedback: string;
      thumbs_up: string;
      thumbs_down: string;
    }>(
      `SELECT 
        COUNT(*)::text as total_feedback,
        COUNT(*) FILTER (WHERE rating = 'thumbs_up')::text as thumbs_up,
        COUNT(*) FILTER (WHERE rating = 'thumbs_down')::text as thumbs_down
       FROM feedback 
       WHERE organization_id = $1`,
      [organizationId]
    );

    const totalFeedback = parseInt(feedbackStats?.total_feedback || '0', 10);
    const thumbsUp = parseInt(feedbackStats?.thumbs_up || '0', 10);
    const satisfactionRate = totalFeedback > 0 ? Math.round((thumbsUp / totalFeedback) * 100) : 100;

    // 5. Total knowledge bases count
    const kbStats = await queryOne<{ total_kb: string }>(
      `SELECT COUNT(*)::text as total_kb FROM knowledge_bases WHERE organization_id = $1`,
      [organizationId]
    );

    // 6. Daily query volume (last 7 days)
    const dailyVolume = await query<{ date: string; queries: number }>(
      `SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as date,
        COUNT(*)::int as queries
       FROM messages 
       WHERE organization_id = $1 AND sender_type = 'assistant' AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY date ASC`,
      [organizationId]
    );

    // 7. Frequently accessed documents (via citation counts)
    const topDocuments = await query<{
      document_id: string;
      title: string;
      citations_count: number;
    }>(
      `SELECT 
        d.id as document_id,
        d.title,
        COUNT(mc.id)::int as citations_count
       FROM message_citations mc
       JOIN documents d ON d.id = mc.document_id
       WHERE mc.organization_id = $1
       GROUP BY d.id, d.title
       ORDER BY citations_count DESC
       LIMIT 5`,
      [organizationId]
    );

    // 8. Recent searches / topics
    const recentQueries = await query<{
      query: string;
      created_at: string;
      retrieval_duration_ms: number;
    }>(
      `SELECT 
        m.content as query,
        m.created_at,
        m2.retrieval_duration_ms
       FROM messages m
       LEFT JOIN messages m2 ON m2.conversation_id = m.conversation_id AND m2.sender_type = 'assistant' AND m2.created_at >= m.created_at
       WHERE m.organization_id = $1 AND m.sender_type = 'user'
       ORDER BY m.created_at DESC
       LIMIT 8`,
      [organizationId]
    );

    return {
      metrics: {
        totalDocuments: parseInt(docStats?.total || '0', 10),
        indexedDocuments: parseInt(docStats?.indexed || '0', 10),
        failedDocuments: parseInt(docStats?.failed || '0', 10),
        processingDocuments: parseInt(docStats?.processing || '0', 10),
        totalKnowledgeBases: parseInt(kbStats?.total_kb || '0', 10),
        totalQueries: parseInt(messageStats?.total_queries || '0', 10),
        activeUsers: parseInt(userStats?.active_users || '0', 10),
        avgRetrievalLatencyMs: parseInt(messageStats?.avg_retrieval_ms || '0', 10),
        avgGenerationLatencyMs: parseInt(messageStats?.avg_generation_ms || '0', 10),
        userSatisfactionPct: satisfactionRate,
        totalFeedback,
      },
      charts: {
        dailyVolume,
        topDocuments,
      },
      recentQueries,
    };
  }
}
