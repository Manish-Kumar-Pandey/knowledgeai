import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { DocumentService } from '../services/document.service';
import { authenticate, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { DocumentFileType } from '../types';

const router = Router();
router.use(authenticate);

// Configure Multer for memory buffer storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError(`Unsupported file format .${ext}. Allowed formats: PDF, DOCX, TXT, Markdown (.md)`, 400));
    }
  },
});

router.post(
  '/upload',
  requireRoles(['super_admin', 'org_admin', 'kb_manager']),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No file was uploaded', 400);
      }

      const { knowledgeBaseId, title } = req.body;
      if (!knowledgeBaseId) {
        throw new AppError('knowledgeBaseId is required', 400);
      }

      const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '') as DocumentFileType;

      const result = await DocumentService.uploadDocument({
        organizationId: req.organizationId!,
        knowledgeBaseId,
        userId: req.user!.userId,
        fileBuffer: req.file.buffer,
        fileName: req.file.originalname,
        fileType: ext,
        title,
      });

      res.status(201).json({
        success: true,
        data: result.document,
        isDuplicate: result.isDuplicate,
        isNewVersion: result.isNewVersion,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId, status, search } = req.query;
    const docs = await DocumentService.list(req.organizationId!, {
      kbId: kbId as string,
      status: status as string,
      search: search as string,
    });
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await DocumentService.getById(req.organizationId!, req.params.id);
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/reindex',
  requireRoles(['super_admin', 'org_admin', 'kb_manager']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await DocumentService.reindex(req.organizationId!, req.params.id);
      res.json({ success: true, data: result });
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
      const result = await DocumentService.delete(req.organizationId!, req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
