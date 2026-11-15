import { pool, query, queryOne } from '../db/pool';
import { IngestionJob } from '../types';

export class JobQueueService {
  /**
   * Enqueue a new document ingestion job
   */
  static async enqueueDocumentJob(documentId: string, organizationId: string): Promise<IngestionJob> {
    const job = await queryOne<IngestionJob>(
      `INSERT INTO ingestion_jobs (document_id, organization_id, status, attempts, max_attempts)
       VALUES ($1, $2, 'pending', 0, 3)
       RETURNING *`,
      [documentId, organizationId]
    );

    // Update document status to pending
    await query(`UPDATE documents SET status = 'pending', updated_at = NOW() WHERE id = $1`, [
      documentId,
    ]);

    return job!;
  }

  /**
   * Fetch and lock the next pending job atomically using FOR UPDATE SKIP LOCKED
   */
  static async lockNextJob(workerId: string): Promise<IngestionJob | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectSql = `
        SELECT id FROM ingestion_jobs
        WHERE status = 'pending' AND attempts < max_attempts
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;
      const selectRes = await client.query(selectSql);

      if (selectRes.rows.length === 0) {
        await client.query('COMMIT');
        return null;
      }

      const jobId = selectRes.rows[0].id;
      const updateSql = `
        UPDATE ingestion_jobs
        SET status = 'processing',
            attempts = attempts + 1,
            locked_at = NOW(),
            locked_by = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      const updateRes = await client.query(updateSql, [workerId, jobId]);
      await client.query('COMMIT');

      return updateRes.rows[0] as IngestionJob;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Mark job as completed
   */
  static async markCompleted(jobId: string, documentId: string): Promise<void> {
    await query(
      `UPDATE ingestion_jobs 
       SET status = 'completed', locked_at = NULL, locked_by = NULL, updated_at = NOW() 
       WHERE id = $1`,
      [jobId]
    );

    await query(
      `UPDATE documents 
       SET status = 'indexed', error_message = NULL, updated_at = NOW() 
       WHERE id = $1`,
      [documentId]
    );
  }

  /**
   * Mark job as failed with retry or terminal dead-letter logging
   */
  static async markFailed(jobId: string, documentId: string, error: any): Promise<void> {
    const job = await queryOne<IngestionJob>(`SELECT * FROM ingestion_jobs WHERE id = $1`, [jobId]);
    const errorDetails = {
      message: error.message || String(error),
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    const hasRemainingAttempts = job && job.attempts < job.max_attempts;
    const nextStatus = hasRemainingAttempts ? 'pending' : 'failed';

    await query(
      `UPDATE ingestion_jobs 
       SET status = $1, error_details = $2, locked_at = NULL, locked_by = NULL, updated_at = NOW() 
       WHERE id = $3`,
      [nextStatus, JSON.stringify(errorDetails), jobId]
    );

    await query(
      `UPDATE documents 
       SET status = $1, error_message = $2, updated_at = NOW() 
       WHERE id = $3`,
      [nextStatus === 'failed' ? 'failed' : 'pending', error.message || 'Ingestion failed', documentId]
    );
  }
}
