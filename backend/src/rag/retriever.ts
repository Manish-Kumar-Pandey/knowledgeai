import { query, withTenantContext } from '../db/pool';
import { aiService } from '../ai/cloudflareAI.service';
import { OrganizationService } from '../services/organization.service';
import { Reranker } from './reranker';
import { SearchResult } from '../types';

export interface RetrievalOptions {
  knowledgeBaseIds?: string[];
  topK?: number;
  similarityThreshold?: number;
  hybridVectorWeight?: number;
  hybridFtsWeight?: number;
  enableReranking?: boolean;
  expandNeighbors?: boolean;
}

export class HybridRetriever {
  /**
   * Performs hybrid search (pgvector + PostgreSQL full-text search) with RRF and reranking
   */
  static async search(
    organizationId: string,
    searchQuery: string,
    options: RetrievalOptions = {}
  ): Promise<SearchResult[]> {
    const settings = await OrganizationService.getSettings(organizationId);

    const topK = options.topK || settings.top_k || 5;
    const similarityThreshold = options.similarityThreshold !== undefined ? options.similarityThreshold : Number(settings.similarity_threshold) || 0.65;
    const vectorWeight = options.hybridVectorWeight !== undefined ? options.hybridVectorWeight : Number(settings.hybrid_vector_weight) || 0.7;
    const ftsWeight = options.hybridFtsWeight !== undefined ? options.hybridFtsWeight : Number(settings.hybrid_fts_weight) || 0.3;
    const rerankEnabled = options.enableReranking !== undefined ? options.enableReranking : settings.reranking_enabled;

    // 1. Generate query embedding
    const [queryEmbedding] = await aiService.generateEmbeddings([searchQuery]);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // 2. Prepare KB filter
    const kbFilterSql = options.knowledgeBaseIds && options.knowledgeBaseIds.length > 0
      ? `AND c.knowledge_base_id = ANY($3::uuid[])`
      : ``;

    const limitCandidates = Math.max(topK * 4, 20);

    // 3. Execute Vector Search
    const vectorSql = `
      SELECT 
        c.id as chunk_id,
        c.document_id,
        d.title as document_title,
        c.knowledge_base_id,
        c.page_number,
        c.chunk_index,
        c.content,
        c.metadata,
        (1 - (c.embedding <=> $1::vector)) as vector_score
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE c.organization_id = $2
        ${kbFilterSql}
        AND d.status = 'indexed'
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $${options.knowledgeBaseIds && options.knowledgeBaseIds.length > 0 ? 4 : 3}
    `;

    const vectorParams: any[] = [embeddingStr, organizationId];
    if (options.knowledgeBaseIds && options.knowledgeBaseIds.length > 0) {
      vectorParams.push(options.knowledgeBaseIds);
    }
    vectorParams.push(limitCandidates);

    // 4. Execute Full-Text Search using websearch_to_tsquery or plainto_tsquery
    const ftsSql = `
      SELECT 
        c.id as chunk_id,
        c.document_id,
        d.title as document_title,
        c.knowledge_base_id,
        c.page_number,
        c.chunk_index,
        c.content,
        c.metadata,
        ts_rank_cd(c.tsv_content, plainto_tsquery('english', $1)) as fts_score
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE c.organization_id = $2
        ${kbFilterSql}
        AND d.status = 'indexed'
        AND c.tsv_content @@ plainto_tsquery('english', $1)
      ORDER BY fts_score DESC
      LIMIT $${options.knowledgeBaseIds && options.knowledgeBaseIds.length > 0 ? 4 : 3}
    `;

    const ftsParams: any[] = [searchQuery, organizationId];
    if (options.knowledgeBaseIds && options.knowledgeBaseIds.length > 0) {
      ftsParams.push(options.knowledgeBaseIds);
    }
    ftsParams.push(limitCandidates);

    let vectorResults: any[] = [];
    let ftsResults: any[] = [];

    await withTenantContext(organizationId, async (client) => {
      try {
        const vRes = await client.query(vectorSql, vectorParams);
        vectorResults = vRes.rows;
      } catch (err) {
        console.warn('[Retriever] Vector query error:', err);
      }

      try {
        const fRes = await client.query(ftsSql, ftsParams);
        ftsResults = fRes.rows;
      } catch (err) {
        console.warn('[Retriever] FTS query error:', err);
      }
    });

    // 5. Reciprocal Rank Fusion (RRF)
    const RRF_CONSTANT = 60;
    const candidateMap = new Map<string, SearchResult>();

    // Rank vector items
    vectorResults.forEach((item, index) => {
      const rank = index + 1;
      const vScore = parseFloat(item.vector_score) || 0;
      const rrfContribution = vectorWeight / (RRF_CONSTANT + rank);

      candidateMap.set(item.chunk_id, {
        chunk_id: item.chunk_id,
        document_id: item.document_id,
        document_title: item.document_title,
        knowledge_base_id: item.knowledge_base_id,
        page_number: item.page_number || 1,
        chunk_index: item.chunk_index,
        content: item.content,
        vector_score: vScore,
        fts_score: 0,
        rrf_score: rrfContribution,
        final_score: rrfContribution,
        metadata: item.metadata || {},
      });
    });

    // Rank FTS items
    ftsResults.forEach((item, index) => {
      const rank = index + 1;
      const ftsScore = parseFloat(item.fts_score) || 0;
      const rrfContribution = ftsWeight / (RRF_CONSTANT + rank);

      if (candidateMap.has(item.chunk_id)) {
        const existing = candidateMap.get(item.chunk_id)!;
        existing.fts_score = ftsScore;
        existing.rrf_score += rrfContribution;
        existing.final_score = existing.rrf_score;
      } else {
        candidateMap.set(item.chunk_id, {
          chunk_id: item.chunk_id,
          document_id: item.document_id,
          document_title: item.document_title,
          knowledge_base_id: item.knowledge_base_id,
          page_number: item.page_number || 1,
          chunk_index: item.chunk_index,
          content: item.content,
          vector_score: 0,
          fts_score: ftsScore,
          rrf_score: rrfContribution,
          final_score: rrfContribution,
          metadata: item.metadata || {},
        });
      }
    });

    let merged = Array.from(candidateMap.values());

    // Filter by similarity threshold if vector match occurred
    merged = merged.filter((item) => {
      if (item.vector_score > 0) {
        return item.vector_score >= similarityThreshold;
      }
      return item.fts_score > 0;
    });

    // Sort by preliminary RRF score
    merged.sort((a, b) => b.rrf_score - a.rrf_score);

    // 6. Reranking
    if (rerankEnabled) {
      merged = Reranker.rerank(searchQuery, merged, topK);
    } else {
      merged = merged.slice(0, topK);
    }

    // 7. Optional Parent-Child / Surrounding Context Expansion
    if (options.expandNeighbors && merged.length > 0) {
      merged = await this.expandSurroundingContext(organizationId, merged);
    }

    return merged;
  }

  /**
   * Expands chunks with adjacent chunks (chunk_index - 1, chunk_index + 1) for coherent reading
   */
  private static async expandSurroundingContext(
    organizationId: string,
    chunks: SearchResult[]
  ): Promise<SearchResult[]> {
    const expandedList: SearchResult[] = [];

    for (const chunk of chunks) {
      const neighbors = await query(
        `SELECT chunk_index, content FROM document_chunks 
         WHERE document_id = $1 AND organization_id = $2 AND chunk_index IN ($3, $4)
         ORDER BY chunk_index ASC`,
        [chunk.document_id, organizationId, chunk.chunk_index - 1, chunk.chunk_index + 1]
      );

      let fullContent = chunk.content;
      for (const n of neighbors) {
        if (n.chunk_index < chunk.chunk_index) {
          fullContent = `${n.content}\n\n${fullContent}`;
        } else {
          fullContent = `${fullContent}\n\n${n.content}`;
        }
      }

      expandedList.push({
        ...chunk,
        content: fullContent,
      });
    }

    return expandedList;
  }
}
