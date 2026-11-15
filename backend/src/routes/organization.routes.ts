import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrganizationService } from '../services/organization.service';
import { authenticate, requireRoles } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const settingsSchema = z.object({
  top_k: z.number().min(1).max(20).optional(),
  similarity_threshold: z.number().min(0).max(1).optional(),
  chunk_size: z.number().min(100).max(4000).optional(),
  chunk_overlap: z.number().min(0).max(1000).optional(),
  hybrid_vector_weight: z.number().min(0).max(1).optional(),
  hybrid_fts_weight: z.number().min(0).max(1).optional(),
  reranking_enabled: z.boolean().optional(),
  max_context_tokens: z.number().min(500).max(16000).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['org_admin', 'kb_manager', 'employee']),
});

const updateRoleSchema = z.object({
  role: z.enum(['org_admin', 'kb_manager', 'employee']),
});

router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await OrganizationService.getById(req.organizationId!);
    res.json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
});

router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await OrganizationService.getSettings(req.organizationId!);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/settings',
  requireRoles(['super_admin', 'org_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = settingsSchema.parse(req.body);
      const updated = await OrganizationService.updateSettings(req.organizationId!, validated);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await OrganizationService.listMembers(req.organizationId!);
    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/members/invite',
  requireRoles(['super_admin', 'org_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = inviteSchema.parse(req.body);
      const invitation = await OrganizationService.inviteMember(
        req.organizationId!,
        validated.email,
        validated.role,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: invitation });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/members/:userId/role',
  requireRoles(['super_admin', 'org_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = updateRoleSchema.parse(req.body);
      const updated = await OrganizationService.updateMemberRole(
        req.organizationId!,
        req.params.userId,
        validated.role
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/members/:userId',
  requireRoles(['super_admin', 'org_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await OrganizationService.removeMember(req.organizationId!, req.params.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
