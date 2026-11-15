import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AnalyticsService.getOverview(req.organizationId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
