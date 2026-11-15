import dotenv from 'dotenv';
import path from 'path';

// Load root or local .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  JWT_SECRET: process.env.JWT_SECRET || 'knowledgeai_default_jwt_secret_key_32_characters_minimum',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'knowledgeai_default_refresh_secret_key_32_chars',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/knowledgeai',
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '2', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '20', 10),
  DB_TIMEOUT_MS: parseInt(process.env.DB_TIMEOUT_MS || '10000', 10),

  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_CHAT_MODEL: process.env.CLOUDFLARE_CHAT_MODEL || '@cf/meta/llama-3.1-8b-instruct',
  CLOUDFLARE_EMBEDDING_MODEL: process.env.CLOUDFLARE_EMBEDDING_MODEL || '@cf/baai/bge-base-en-v1.5',

  STORAGE_PROVIDER: (process.env.STORAGE_PROVIDER as 'local' | 'supabase') || 'local',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'knowledge-documents',
  LOCAL_STORAGE_DIR: process.env.LOCAL_STORAGE_DIR || path.resolve(process.cwd(), 'uploads'),

  JOB_POLL_INTERVAL_MS: parseInt(process.env.JOB_POLL_INTERVAL_MS || '3000', 10),
  JOB_MAX_RETRIES: parseInt(process.env.JOB_MAX_RETRIES || '3', 10),
  JOB_CONCURRENCY: parseInt(process.env.JOB_CONCURRENCY || '2', 10),
};
