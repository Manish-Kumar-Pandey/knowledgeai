import { pool, queryOne, query } from '../db/pool';
import { CryptoUtil } from '../utils/crypto';
import { AppError } from '../middleware/errorHandler';
import { EmailService } from './email.service';
import { env } from '../config/env';
import { User, UserRole } from '../types';

export class AuthService {
  static async register(data: {
    email: string;
    password: string;
    fullName: string;
    organizationName?: string;
  }) {
    const existing = await queryOne(`SELECT id FROM users WHERE email = $1`, [data.email.toLowerCase()]);
    if (existing) {
      throw new AppError('An account with this email address already exists', 409);
    }

    const passwordHash = await CryptoUtil.hashPassword(data.password);
    const orgName = data.organizationName || `${data.fullName}'s Workspace`;
    const orgSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create Organization
      const orgRes = await client.query(
        `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *`,
        [orgName, orgSlug]
      );
      const organization = orgRes.rows[0];

      // 2. Create User
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, avatar_url, is_active, created_at, updated_at`,
        [data.email.toLowerCase(), passwordHash, data.fullName]
      );
      const user = userRes.rows[0];

      // 3. Link as org_admin
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'org_admin')`,
        [organization.id, user.id]
      );

      // 4. Create default organization settings
      await client.query(
        `INSERT INTO organization_settings (organization_id) VALUES ($1)`,
        [organization.id]
      );

      // 5. Create default initial knowledge base
      await client.query(
        `INSERT INTO knowledge_bases (organization_id, name, description, created_by)
         VALUES ($1, 'General Knowledge', 'Default workspace knowledge base for company documents', $2)`,
        [organization.id, user.id]
      );

      await client.query('COMMIT');

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        organizationId: organization.id,
        role: 'org_admin' as UserRole,
      };

      const accessToken = CryptoUtil.generateAccessToken(tokenPayload);
      const refreshToken = CryptoUtil.generateRefreshToken(tokenPayload);

      return {
        user,
        organization,
        role: 'org_admin',
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async login(email: string, password: string) {
    const user = await queryOne(
      `SELECT id, email, password_hash, full_name, avatar_url, is_active, created_at FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.is_active) {
      throw new AppError('This user account has been deactivated. Please contact support.', 403);
    }

    const isValid = await CryptoUtil.comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Get user's primary organization membership
    const memberships = await query(
      `SELECT om.organization_id, om.role, o.name as organization_name, o.slug as organization_slug
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY om.created_at ASC`,
      [user.id]
    );

    if (memberships.length === 0) {
      throw new AppError('User is not associated with any organization', 403);
    }

    const primaryMembership = memberships[0];

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      organizationId: primaryMembership.organization_id,
      role: primaryMembership.role as UserRole,
    };

    const accessToken = CryptoUtil.generateAccessToken(tokenPayload);
    const refreshToken = CryptoUtil.generateRefreshToken(tokenPayload);

    const { password_hash, ...safeUser } = user;

    return {
      user: safeUser,
      currentOrganization: {
        id: primaryMembership.organization_id,
        name: primaryMembership.organization_name,
        slug: primaryMembership.organization_slug,
        role: primaryMembership.role,
      },
      organizations: memberships,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  static async refresh(refreshToken: string) {
    try {
      const payload = CryptoUtil.verifyRefreshToken(refreshToken);
      const user = await queryOne(`SELECT id, email, is_active FROM users WHERE id = $1`, [payload.userId]);

      if (!user || !user.is_active) {
        throw new AppError('User account not found or deactivated', 401);
      }

      // Check current membership role in the org
      const membership = await queryOne(
        `SELECT role FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
        [payload.userId, payload.organizationId]
      );

      const role = (membership?.role || payload.role) as UserRole;

      const newPayload = {
        userId: user.id,
        email: user.email,
        organizationId: payload.organizationId,
        role,
      };

      const newAccessToken = CryptoUtil.generateAccessToken(newPayload);
      const newRefreshToken = CryptoUtil.generateRefreshToken(newPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  static async getProfile(userId: string) {
    const user = await queryOne(
      `SELECT id, email, full_name, avatar_url, is_active, created_at, updated_at FROM users WHERE id = $1`,
      [userId]
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const organizations = await query(
      `SELECT o.id, o.name, o.slug, o.logo_url, o.plan, om.role, om.created_at as joined_at
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1`,
      [userId]
    );

    return {
      user,
      organizations,
    };
  }

  static async forgotPassword(email: string) {
    const user = await queryOne(`SELECT id, email, full_name, is_active FROM users WHERE email = $1`, [
      email.toLowerCase(),
    ]);

    if (user && user.is_active) {
      const resetToken = CryptoUtil.generatePasswordResetToken({
        userId: user.id,
        email: user.email,
      });

      const frontendBase = env.FRONTEND_URL.replace(/\/+$/, '');
      const resetLink = `${frontendBase}/reset-password?token=${encodeURIComponent(resetToken)}`;

      await EmailService.sendPasswordResetEmail(user.email, resetLink, user.full_name);
    }

    return {
      success: true,
      message: 'If an account exists with this email address, password reset instructions have been sent.',
    };
  }

  static async resetPassword(token: string, newPassword: string) {
    try {
      const decoded = CryptoUtil.verifyPasswordResetToken(token);
      if (!decoded || decoded.type !== 'reset_password') {
        throw new AppError('Invalid or expired password reset link', 400);
      }

      const user = await queryOne(`SELECT id, is_active FROM users WHERE id = $1`, [decoded.userId]);
      if (!user || !user.is_active) {
        throw new AppError('User account not found or has been deactivated', 404);
      }

      const passwordHash = await CryptoUtil.hashPassword(newPassword);

      await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
        passwordHash,
        user.id,
      ]);

      return {
        success: true,
        message: 'Your password has been successfully reset. You may now sign in.',
      };
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('The password reset link has expired. Please request a new one.', 400);
      }
      if (err instanceof AppError) throw err;
      throw new AppError('Invalid or expired password reset link', 400);
    }
  }
}
