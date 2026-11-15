import { aiService } from '../ai/cloudflareAI.service';
import { ChatMessage } from '../ai/ai.interface';

export class QueryRewriter {
  /**
   * Rewrites a conversational or vague query using recent conversation history
   */
  static async rewriteQuery(
    query: string,
    history: { sender: 'user' | 'assistant'; text: string }[] = []
  ): Promise<string> {
    if (!history || history.length === 0) {
      return query.trim();
    }

    const recentContext = history
      .slice(-4)
      .map((h) => `${h.sender.toUpperCase()}: ${h.text}`)
      .join('\n');

    const prompt: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an enterprise query reformulation assistant. Given conversation history and a follow-up question, rewrite the question into a standalone, clear, keyword-rich search query suitable for document retrieval. Return ONLY the rewritten query, with no quotation marks, preamble, or explanation.`,
      },
      {
        role: 'user',
        content: `Conversation History:\n${recentContext}\n\nCurrent Question: ${query}\n\nStandalone Search Query:`,
      },
    ];

    try {
      const rewritten = await aiService.generateChatCompletion(prompt, 0.1);
      const clean = rewritten.trim().replace(/^["']|["']$/g, '');
      return clean.length > 3 ? clean : query;
    } catch (err) {
      console.warn('[QueryRewriter] Failed to rewrite query, falling back to original:', err);
      return query;
    }
  }

  /**
   * Generates 2-3 alternate variations of a query for multi-query retrieval expansion
   */
  static async expandMultiQueries(query: string): Promise<string[]> {
    const prompt: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an information retrieval expert. For the given enterprise query, generate 2 alternative variations that search for identical or synonymous concepts. Return the queries as a JSON array of strings: ["query 1", "query 2"]. Return ONLY valid JSON.`,
      },
      {
        role: 'user',
        content: query,
      },
    ];

    try {
      const response = await aiService.generateChatCompletion(prompt, 0.3);
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [query, ...parsed.slice(0, 2)];
        }
      }
    } catch {
      // Fallback
    }

    return [query];
  }
}
