import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChatService } from '../services/chat.service';
import { authenticate } from '../middleware/auth';
import { ragStreamRateLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(authenticate);

const createConvSchema = z.object({
  title: z.string().max(100).optional(),
  selectedKbIds: z.array(z.string().uuid()).optional(),
});

const updateConvSchema = z.object({
  title: z.string().max(100).optional(),
  selectedKbIds: z.array(z.string().uuid()).optional(),
});

const messageStreamSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(4000),
});

const feedbackSchema = z.object({
  rating: z.enum(['thumbs_up', 'thumbs_down']),
  comment: z.string().max(500).optional(),
});

router.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await ChatService.listConversations(req.organizationId!, req.user!.userId);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

router.post('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createConvSchema.parse(req.body);
    const conv = await ChatService.createConversation(
      req.organizationId!,
      req.user!.userId,
      validated.title,
      validated.selectedKbIds
    );
    res.status(201).json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

router.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ChatService.getConversation(req.organizationId!, req.user!.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.patch('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateConvSchema.parse(req.body);
    const updated = await ChatService.updateConversation(
      req.organizationId!,
      req.user!.userId,
      req.params.id,
      {
        title: validated.title,
        selected_kb_ids: validated.selectedKbIds,
      }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ChatService.deleteConversation(req.organizationId!, req.user!.userId, req.params.id);
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/conversations/:id/messages/stream',
  ragStreamRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = messageStreamSchema.parse(req.body);
      await ChatService.streamChatMessage({
        organizationId: req.organizationId!,
        userId: req.user!.userId,
        conversationId: req.params.id,
        question: validated.question,
        res,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/messages/:id/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = feedbackSchema.parse(req.body);
    const result = await ChatService.submitFeedback(
      req.organizationId!,
      req.user!.userId,
      req.params.id,
      validated.rating,
      validated.comment
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
