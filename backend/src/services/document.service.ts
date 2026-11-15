import { query, queryOne, withTenantContext } from '../db/pool';
import { StorageService } from '../storage/storage.service';
import { CryptoUtil } from '../utils/crypto';
import { JobQueueService } from '../queue/jobQueue.service';
import { AppError } from '../middleware/errorHandler';
import { Document, DocumentFileType } from '../types';

export class DocumentService {
  /**
   * Handle document upload, duplicate detection, and version incrementing
   */
  static async uploadDocument(params: {
    organizationId: string;
    knowledgeBaseId: string;
    userId: string;
    fileBuffer: Buffer;
    fileName: string;
    fileType: DocumentFileType;
    title?: string;
  }): Promise<{ document: Document; isDuplicate: boolean; isNewVersion: boolean }> {
    const { organizationId, knowledgeBaseId, userId, fileBuffer, fileName, fileType, title } = params;

    const fileSizeBytes = fileBuffer.length;
    const fileHash = CryptoUtil.computeSha256(fileBuffer);
    const documentTitle = title || fileName.replace(/\.[^/.]+$/, '');

    // Check if identical hash already exists in this organization
    const existingDuplicate = await queryOne<Document>(
      `SELECT * FROM documents WHERE organization_id = $1 AND file_hash = $2`,
      [organizationId, fileHash]
    );

    if (existingDuplicate) {
      return {
        document: existingDuplicate,
        isDuplicate: true,
        isNewVersion: false,
      };
    }

    // Check if a document with same title exists in this knowledge base -> version update
    const existingNamedDoc = await queryOne<Document>(
      `SELECT * FROM documents WHERE organization_id = $1 AND knowledge_base_id = $2 AND (title = $3 OR file_name = $4)`,
      [organizationId, knowledgeBaseId, documentTitle, fileName]
    );

    // Upload file to storage
    const uploadResult = await StorageService.uploadFile(
      organizationId,
      fileHash,
      fileName,
      fileBuffer
    );

    let doc: Document;
    let isNewVersion = false;

    if (existingNamedDoc) {
      // Create version archive and increment current_version
      isNewVersion = true;
      const nextVersion = existingNamedDoc.current_version + 1;

      await query(
        `INSERT INTO document_versions (document_id, organization_id, version_number, file_name, file_hash, storage_path)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          existingNamedDoc.id,
          organizationId,
          existingNamedDoc.current_version,
          existingNamedDoc.file_name,
          existingNamedDoc.file_hash,
          existingNamedDoc.storage_path,
        ]
      );

      const updated = await queryOne<Document>(
        `UPDATE documents 
         SET file_name = $1, file_type = $2, file_size_bytes = $3, file_hash = $4, 
             storage_path = $5, current_version = $6, status = 'uploaded', updated_at = NOW()
         WHERE id = $7 AND organization_id = $8
         RETURNING *`,
        [
          fileName,
          fileType,
          fileSizeBytes,
          fileHash,
          uploadResult.storagePath,
          nextVersion,
          existingNamedDoc.id,
          organizationId,
        ]
      );
      doc = updated!;
    } else {
      // Insert new document
      const inserted = await queryOne<Document>(
        `INSERT INTO documents (
          organization_id, knowledge_base_id, title, file_name, file_type, 
          file_size_bytes, file_hash, storage_path, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded', $9)
        RETURNING *`,
        [
          organizationId,
          knowledgeBaseId,
          documentTitle,
          fileName,
          fileType,
          fileSizeBytes,
          fileHash,
          uploadResult.storagePath,
          userId,
        ]
      );
      doc = inserted!;
    }

    // Enqueue background ingestion job
    await JobQueueService.enqueueDocumentJob(doc.id, organizationId);

    return {
      document: doc,
      isDuplicate: false,
      isNewVersion,
    };
  }

  static async list(organizationId: string, options: { kbId?: string; status?: string; search?: string } = {}) {
    let sql = `
      SELECT d.*, 
        (SELECT COUNT(*)::int FROM document_chunks dc WHERE dc.document_id = d.id) as chunk_count,
        kb.name as knowledge_base_name
      FROM documents d
      JOIN knowledge_bases kb ON kb.id = d.knowledge_base_id
      WHERE d.organization_id = $1
    `;
    const params: any[] = [organizationId];
    let idx = 2;

    if (options.kbId) {
      sql += ` AND d.knowledge_base_id = $${idx++}`;
      params.push(options.kbId);
    }
    if (options.status) {
      sql += ` AND d.status = $${idx++}`;
      params.push(options.status);
    }
    if (options.search) {
      sql += ` AND (d.title ILIKE $${idx} OR d.file_name ILIKE $${idx})`;
      params.push(`%${options.search}%`);
      idx++;
    }

    sql += ` ORDER BY d.created_at DESC`;

    return await query(sql, params);
  }

  static async getById(organizationId: string, documentId: string) {
    const doc = await queryOne(
      `SELECT d.*, 
        (SELECT COUNT(*)::int FROM document_chunks dc WHERE dc.document_id = d.id) as chunk_count,
        kb.name as knowledge_base_name
       FROM documents d
       JOIN knowledge_bases kb ON kb.id = d.knowledge_base_id
       WHERE d.organization_id = $1 AND d.id = $2`,
      [organizationId, documentId]
    );

    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    const versions = await query(
      `SELECT * FROM document_versions WHERE document_id = $1 ORDER BY version_number DESC`,
      [documentId]
    );

    const chunks = await query(
      `SELECT id, chunk_index, page_number, content, metadata, created_at
       FROM document_chunks 
       WHERE document_id = $1 
       ORDER BY chunk_index ASC 
       LIMIT 50`,
      [documentId]
    );

    return {
      ...doc,
      versions,
      chunks,
    };
  }

  static async reindex(organizationId: string, documentId: string) {
    const doc = await this.getById(organizationId, documentId);
    await JobQueueService.enqueueDocumentJob(doc.id, organizationId);
    return { success: true, message: 'Reindexing job enqueued' };
  }

  static async delete(organizationId: string, documentId: string) {
    const doc = await this.getById(organizationId, documentId);
    await StorageService.deleteFile(doc.storage_path);
    await query(`DELETE FROM documents WHERE organization_id = $1 AND id = $2`, [
      organizationId,
      documentId,
    ]);
    return { success: true };
  }
}
