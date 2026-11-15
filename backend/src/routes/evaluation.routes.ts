import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EvaluationService } from '../services/evaluation.service';
import { authenticate, requireRoles } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const runEvalSchema = z.object({
  datasetId: z.string().uuid(),
});

router.get('/dataset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await EvaluationService.getOrCreateDefaultDataset(req.organizationId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runs = await EvaluationService.listRuns(req.organizationId!);
    res.json({ success: true, data: runs });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/run',
  requireRoles(['super_admin', 'org_admin', 'kb_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = runEvalSchema.parse(req.body);
      const result = await EvaluationService.runEvaluation(req.organizationId!, validated.datasetId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
