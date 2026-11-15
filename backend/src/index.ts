import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerDocument } from './docs/swagger';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth.routes';
import orgRoutes from './routes/organization.routes';
import kbRoutes from './routes/knowledgeBase.routes';
import docRoutes from './routes/document.routes';
import chatRoutes from './routes/chat.routes';
import analyticsRoutes from './routes/analytics.routes';
import evalRoutes from './routes/evaluation.routes';
import { runWorkerLoop } from './worker';

const app = express();

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI assets and cross-origin Next.js client
  })
);

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id'],
  })
);

app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root health check & Render/hosting probe
app.all('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'KnowledgeAI Backend API',
    version: '1.0.0',
    docs: '/api-docs',
    timestamp: new Date().toISOString(),
  });
});

// Dedicated Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'KnowledgeAI Backend',
    version: '1.0.0',
  });
});

// Swagger Documentation UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Apply API rate limiting
app.use(env.API_PREFIX, apiRateLimiter);

// Mount Versioned Routes
app.use(`${env.API_PREFIX}/auth`, authRoutes);
app.use(`${env.API_PREFIX}/organizations`, orgRoutes);
app.use(`${env.API_PREFIX}/knowledge-bases`, kbRoutes);
app.use(`${env.API_PREFIX}/documents`, docRoutes);
app.use(`${env.API_PREFIX}/chat`, chatRoutes);
app.use(`${env.API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${env.API_PREFIX}/evaluations`, evalRoutes);

// Centralized Error Handling
app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT) || env.PORT || 5000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`==================================================================`);
    console.log(`🚀 KnowledgeAI Backend running at http://0.0.0.0:${port}`);
    console.log(`📚 OpenAPI / Swagger UI: http://0.0.0.0:${port}/api-docs`);
    console.log(`📡 API Base Endpoint: http://0.0.0.0:${port}${env.API_PREFIX}`);
    console.log(`==================================================================`);

    // Start embedded worker loop for free-tier single-instance hosting
    if (process.env.DISABLE_EMBEDDED_WORKER !== 'true') {
      runWorkerLoop().catch((err) => {
        console.error('[Worker] Embedded worker loop error:', err);
      });
    }
  });

  const handleShutdown = () => {
    console.log('\n[Server] Gracefully shutting down...');
    server.close(() => {
      console.log('[Server] Closed remaining connections.');
      process.exit(0);
    });
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

export default app;
