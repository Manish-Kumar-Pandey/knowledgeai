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

// Health Check
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
  const server = app.listen(env.PORT, () => {
    console.log(`==================================================================`);
    console.log(`🚀 KnowledgeAI Backend running at http://localhost:${env.PORT}`);
    console.log(`📚 OpenAPI / Swagger UI: http://localhost:${env.PORT}/api-docs`);
    console.log(`📡 API Base Endpoint: http://localhost:${env.PORT}${env.API_PREFIX}`);
    console.log(`==================================================================`);
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
