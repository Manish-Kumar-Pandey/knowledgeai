import { query, queryOne, withTenantContext } from '../db/pool';
import { StorageService } from '../storage/storage.service';
import { DocumentExtractor } from '../rag/extractors';
import { TextCleaner } from '../rag/cleaner';
import { TextChunker } from '../rag/chunker';
import { aiService } from '../ai/cloudflareAI.service';
import { OrganizationService } from '../services/organization.service';
import { Document } from '../types';

export class IngestionProcessor {
  /**
   * Process a single document ingestion job
   */
  static async processDocument(documentId: string, organizationId: string): Promise<void> {
    const doc = await queryOne<Document>(
      `SELECT * FROM documents WHERE id = $1 AND organization_id = $2`,
      [documentId, organizationId]
    );

    if (!doc) {
      throw new Error(`Document ${documentId} not found in organization ${organizationId}`);
    }

    // 1. Update doc status to processing
    await query(`UPDATE documents SET status = 'processing', updated_at = NOW() WHERE id = $1`, [
      documentId,
    ]);

    // 2. Fetch raw file from storage
    const buffer = await StorageService.readFileBuffer(doc.storage_path);

    // 3. Extract text
    const extraction = await DocumentExtractor.extract(buffer, doc.file_type);

    // 4. Clean extracted text
    const cleanedPages = extraction.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: TextCleaner.clean(p.text),
    }));

    // 5. Fetch org settings for chunking strategy
    const settings = await OrganizationService.getSettings(organizationId);

    // 6. Chunk text
    const chunks = TextChunker.chunkDocument(cleanedPages, {
      strategy: 'recursive',
      chunkSize: settings.chunk_size || 800,
      chunkOverlap: settings.chunk_overlap || 150,
      metadata: {
        documentId: doc.id,
        documentTitle: doc.title,
        fileName: doc.file_name,
        fileType: doc.file_type,
        knowledgeBaseId: doc.knowledge_base_id,
        organizationId: doc.organization_id,
        version: doc.current_version,
      },
    });

    if (chunks.length === 0) {
      // Create at least one fallback chunk if extraction was empty
      chunks.push({
        chunkIndex: 0,
        pageNumber: 1,
        content: `Document: ${doc.title} (No readable text found)`,
        metadata: { empty: true },
      });
    }

    // 7. Generate embeddings in batches (e.g. 16 at a time to prevent payload bloat)
    const BATCH_SIZE = 16;
    const chunkContents = chunks.map((c) => c.content);
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunkContents.length; i += BATCH_SIZE) {
      const slice = chunkContents.slice(i, i + BATCH_SIZE);
      const embeddings = await aiService.generateEmbeddings(slice);
      allEmbeddings.push(...embeddings);
    }

    // 8. Atomic insertion into document_chunks
    await withTenantContext(organizationId, async (client) => {
      await client.query('BEGIN');

      // Remove any prior chunks for this document if re-indexing
      await client.query(
        `DELETE FROM document_chunks WHERE document_id = $1 AND organization_id = $2`,
        [doc.id, organizationId]
      );

      // Insert new chunks
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const emb = allEmbeddings[i];
        const embString = `[${emb.join(',')}]`;

        await client.query(
          `INSERT INTO document_chunks (
            document_id,
            organization_id,
            knowledge_base_id,
            document_version,
            chunk_index,
            page_number,
            content,
            embedding,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9::jsonb)`,
          [
            doc.id,
            organizationId,
            doc.knowledge_base_id,
            doc.current_version,
            c.chunkIndex,
            c.pageNumber,
            c.content,
            embString,
            JSON.stringify(c.metadata),
          ]
        );
      }

      await client.query('COMMIT');
    });

    console.log(
      `[Ingestion] Successfully indexed document "${doc.title}" (${doc.id}) into ${chunks.length} chunks.`
    );
  }
}
