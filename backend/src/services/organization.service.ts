import { query, queryOne } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { CryptoUtil } from '../utils/crypto';
import { OrganizationSettings, UserRole } from '../types';

export class OrganizationService {
  static async getById(organizationId: string) {
    const org = await queryOne(
      `SELECT id, name, slug, logo_url, plan, created_at FROM organizations WHERE id = $1`,
      [organizationId]
    );
    if (!org) throw new AppError('Organization not found', 404);
    return org;
  }

  static async getSettings(organizationId: string): Promise<OrganizationSettings> {
    let settings = await queryOne(
      `SELECT * FROM organization_settings WHERE organization_id = $1`,
      [organizationId]
    );

    if (!settings) {
      // Create defaults if not found
      settings = await queryOne(
        `INSERT INTO organization_settings (organization_id) VALUES ($1) RETURNING *`,
        [organizationId]
      );
    }

    return settings;
  }

  static async updateSettings(organizationId: string, updates: Partial<OrganizationSettings>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedKeys: (keyof OrganizationSettings)[] = [
      'top_k',
      'similarity_threshold',
      'chunk_size',
      'chunk_overlap',
      'hybrid_vector_weight',
      'hybrid_fts_weight',
      'reranking_enabled',
      'max_context_tokens',
    ];

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(updates[key]);
        idx++;
      }
    }

    if (fields.length === 0) {
      return this.getSettings(organizationId);
    }

    values.push(organizationId);
    const sql = `
      UPDATE organization_settings 
      SET ${fields.join(', ')}, updated_at = NOW() 
      WHERE organization_id = $${idx} 
      RETURNING *
    `;

    return await queryOne(sql, values);
  }

  static async listMembers(organizationId: string) {
    return await query(
      `SELECT om.id, om.role, om.created_at as joined_at, u.id as user_id, u.email, u.full_name, u.avatar_url, u.is_active
       FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.created_at ASC`,
      [organizationId]
    );
  }

  static async inviteMember(organizationId: string, email: string, role: UserRole, inviterId: string) {
    const existingMember = await queryOne(
      `SELECT om.id FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1 AND u.email = $2`,
      [organizationId, email.toLowerCase()]
    );

    if (existingMember) {
      throw new AppError('This user is already a member of this organization', 400);
    }

    const token = CryptoUtil.generateRandomToken(24);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await queryOne(
      `INSERT INTO invitations (organization_id, email, role, token, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, expires_at, created_at`,
      [organizationId, email.toLowerCase(), role, token, expiresAt, inviterId]
    );

    return {
      invitation,
      invitationUrl: `/invite?token=${token}`,
    };
  }

  static async updateMemberRole(organizationId: string, targetUserId: string, newRole: UserRole) {
    const updated = await queryOne(
      `UPDATE organization_members 
       SET role = $1, updated_at = NOW() 
       WHERE organization_id = $2 AND user_id = $3
       RETURNING *`,
      [newRole, organizationId, targetUserId]
    );

    if (!updated) {
      throw new AppError('Member not found in this organization', 404);
    }

    return updated;
  }

  static async removeMember(organizationId: string, targetUserId: string) {
    const count = await queryOne(
      `SELECT count(*) FROM organization_members WHERE organization_id = $1 AND role = 'org_admin'`,
      [organizationId]
    );

    const isTargetAdmin = await queryOne(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, targetUserId]
    );

    if (isTargetAdmin?.role === 'org_admin' && parseInt(count.count, 10) <= 1) {
      throw new AppError('Cannot remove the last Organization Administrator', 400);
    }

    await query(
      `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, targetUserId]
    );

    return { success: true };
  }
}
