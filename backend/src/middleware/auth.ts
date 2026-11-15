import { Request, Response, NextFunction } from 'express';
import { CryptoUtil } from '../utils/crypto';
import { queryOne } from '../db/pool';
import { AuthTokenPayload, UserRole } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      organizationId?: string;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authorization header missing or invalid format' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = CryptoUtil.verifyAccessToken(token);

    req.user = payload;

    // Check if the user specified an organization context via header
    const requestedOrgId = (req.headers['x-organization-id'] as string) || payload.organizationId;
    if (requestedOrgId) {
      // Verify user membership in this organization unless super_admin
      if (payload.role !== 'super_admin' && requestedOrgId !== payload.organizationId) {
        const membership = await queryOne(
          `SELECT role FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
          [payload.userId, requestedOrgId]
        );

        if (!membership) {
          res.status(403).json({ success: false, error: 'Access denied: not a member of the requested organization' });
          return;
        }

        // Update effective role for this organization
        req.user.role = membership.role as UserRole;
        req.user.organizationId = requestedOrgId;
      }
      req.organizationId = requestedOrgId;
    } else {
      req.organizationId = payload.organizationId;
    }

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: 'Token has expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid or forged authentication token' });
  }
};

/**
 * Role-Based Access Control (RBAC) middleware
 */
export const requireRoles = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return;
    }

    if (req.user.role === 'super_admin' || roles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: `Forbidden: requires one of the following roles: [${roles.join(', ')}]`,
    });
  };
};
