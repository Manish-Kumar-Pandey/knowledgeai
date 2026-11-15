import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export interface StorageUploadResult {
  storagePath: string;
  provider: 'local' | 'supabase';
}

export class StorageService {
  private static supabase: SupabaseClient | null = null;

  private static getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase credentials not configured');
      }
      this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    }
    return this.supabase;
  }

  static async uploadFile(
    organizationId: string,
    fileHash: string,
    originalName: string,
    buffer: Buffer
  ): Promise<StorageUploadResult> {
    const ext = path.extname(originalName);
    const fileName = `${organizationId}/${fileHash}${ext}`;

    if (env.STORAGE_PROVIDER === 'supabase' && env.SUPABASE_URL) {
      const client = this.getSupabaseClient();
      const { data, error } = await client.storage
        .from(env.SUPABASE_STORAGE_BUCKET)
        .upload(fileName, buffer, {
          upsert: true,
          contentType: ext === '.pdf' ? 'application/pdf' : 'text/plain',
        });

      if (error) {
        console.warn('[Storage] Supabase upload failed, falling back to local storage:', error.message);
      } else {
        return {
          storagePath: data.path,
          provider: 'supabase',
        };
      }
    }

    // Default or Fallback: Local Filesystem Storage
    const targetDir = path.resolve(env.LOCAL_STORAGE_DIR, organizationId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const localPath = path.resolve(targetDir, `${fileHash}${ext}`);
    fs.writeFileSync(localPath, buffer);

    return {
      storagePath: localPath,
      provider: 'local',
    };
  }

  static async readFileBuffer(storagePath: string): Promise<Buffer> {
    if (storagePath.startsWith('http') || (!fs.existsSync(storagePath) && env.STORAGE_PROVIDER === 'supabase')) {
      const client = this.getSupabaseClient();
      const { data, error } = await client.storage
        .from(env.SUPABASE_STORAGE_BUCKET)
        .download(storagePath);
      if (error || !data) throw new Error(`Failed to download from Supabase storage: ${error?.message}`);
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    if (!fs.existsSync(storagePath)) {
      throw new Error(`File does not exist on local storage path: ${storagePath}`);
    }

    return fs.readFileSync(storagePath);
  }

  static async deleteFile(storagePath: string): Promise<void> {
    if (fs.existsSync(storagePath)) {
      try {
        fs.unlinkSync(storagePath);
      } catch (err) {
        console.warn('[Storage] Failed to delete local file:', err);
      }
    } else if (env.STORAGE_PROVIDER === 'supabase' && env.SUPABASE_URL) {
      try {
        const client = this.getSupabaseClient();
        await client.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storagePath]);
      } catch (err) {
        console.warn('[Storage] Failed to delete supabase file:', err);
      }
    }
  }
}
