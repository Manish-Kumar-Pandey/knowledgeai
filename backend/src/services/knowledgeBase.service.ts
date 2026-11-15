import { query, queryOne } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { KnowledgeBase } from '../types';

export class KnowledgeBaseService {
  static async list(organizationId: string): Promise<KnowledgeBase[]> {
    return await query<KnowledgeBase>(
      `SELECT kb.*, 
        (SELECT COUNT(*)::int FROM documents d WHERE d.knowledge_base_id = kb.id) as document_count
       FROM knowledge_bases kb
       WHERE kb.organization_id = $1
       ORDER BY kb.created_at DESC`,
      [organizationId]
    );
  }

  static async getById(organizationId: string, kbId: string): Promise<KnowledgeBase> {
    const kb = await queryOne<KnowledgeBase>(
      `SELECT kb.*, 
        (SELECT COUNT(*)::int FROM documents d WHERE d.knowledge_base_id = kb.id) as document_count
       FROM knowledge_bases kb
       WHERE kb.organization_id = $1 AND kb.id = $2`,
      [organizationId, kbId]
    );

    if (!kb) {
      throw new AppError('Knowledge Base not found', 404);
    }

    return kb;
  }

  static async create(
    organizationId: string,
    userId: string,
    name: string,
    description?: string
  ): Promise<KnowledgeBase> {
    const res = await queryOne<KnowledgeBase>(
      `INSERT INTO knowledge_bases (organization_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [organizationId, name, description || '', userId]
    );
    return res!;
  }

  static async update(
    organizationId: string,
    kbId: string,
    updates: { name?: string; description?: string; is_active?: boolean }
  ): Promise<KnowledgeBase> {
    const kb = await this.getById(organizationId, kbId);

    const name = updates.name !== undefined ? updates.name : kb.name;
    const desc = updates.description !== undefined ? updates.description : kb.description;
    const active = updates.is_active !== undefined ? updates.is_active : kb.is_active;

    const res = await queryOne<KnowledgeBase>(
      `UPDATE knowledge_bases 
       SET name = $1, description = $2, is_active = $3, updated_at = NOW()
       WHERE organization_id = $4 AND id = $5
       RETURNING *`,
      [name, desc, active, organizationId, kbId]
    );

    return res!;
  }

  static async delete(organizationId: string, kbId: string): Promise<void> {
    await this.getById(organizationId, kbId);
    await query(`DELETE FROM knowledge_bases WHERE organization_id = $1 AND id = $2`, [
      organizationId,
      kbId,
    ]);
  }
}
