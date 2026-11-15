import { SearchResult } from '../types';

export class Reranker {
  /**
   * Reranks retrieved chunks to maximize relevance to user query
   */
  static rerank(query: string, candidates: SearchResult[], topK = 5): SearchResult[] {
    if (candidates.length <= 1) return candidates;

    const queryTerms = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scored = candidates.map((item) => {
      const content = item.content.toLowerCase();
      let lexicalMatchScore = 0;
      let titleBonus = 0;

      // Check title match
      if (item.document_title) {
        const titleLower = item.document_title.toLowerCase();
        for (const term of queryTerms) {
          if (titleLower.includes(term)) {
            titleBonus += 0.2;
          }
        }
      }

      // Check exact query phrases
      if (content.includes(query.toLowerCase())) {
        lexicalMatchScore += 0.4;
      }

      // Check term frequency and coverage
      let termsFound = 0;
      for (const term of queryTerms) {
        const matches = (content.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
        if (matches > 0) {
          termsFound++;
          lexicalMatchScore += Math.min(0.2, matches * 0.05);
        }
      }

      const termCoverage = queryTerms.length > 0 ? termsFound / queryTerms.length : 0;

      // Combined cross-score: RRF baseline + lexical match + term coverage + title match
      const rerankScore =
        item.rrf_score * 0.4 +
        termCoverage * 0.3 +
        lexicalMatchScore * 0.2 +
        Math.min(0.1, titleBonus);

      return {
        ...item,
        final_score: parseFloat(rerankScore.toFixed(4)),
      };
    });

    // Sort descending by final_score
    scored.sort((a, b) => b.final_score - a.final_score);

    return scored.slice(0, topK);
  }
}
