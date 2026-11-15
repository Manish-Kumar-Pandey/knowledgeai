import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { KnowledgeBaseService } from '../services/knowledgeBase.service';
import { authenticate, requireRoles } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const createKbSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

const updateKbSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await KnowledgeBaseService.list(req.organizationId!);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kb = await KnowledgeBaseService.getById(req.organizationId!, req.params.id);
    res.json({ success: true, data: kb });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireRoles(['super_admin', 'org_admin', 'kb_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = createKbSchema.parse(req.body);
      const kb = await KnowledgeBaseService.create(
        req.organizationId!,
        req.user!.userId,
        validated.name,
        validated.description
      );
      res.status(201).json({ success: true, data: kb });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  requireRoles(['super_admin', 'org_admin', 'kb_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = updateKbSchema.parse(req.body);
      const updated = await KnowledgeBaseService.update(req.organizationId!, req.params.id, validated);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  requireRoles(['super_admin', 'org_admin', 'kb_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await KnowledgeBaseService.delete(req.organizationId!, req.params.id);
      res.json({ success: true, message: 'Knowledge base deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
