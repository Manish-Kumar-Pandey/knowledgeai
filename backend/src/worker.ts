import { JobQueueService } from './queue/jobQueue.service';
import { IngestionProcessor } from './queue/ingestionProcessor';
import { env } from './config/env';

const workerId = `worker-${process.pid}-${Math.random().toString(36).substring(7)}`;

async function runWorkerLoop() {
  console.log(`[Worker] Starting KnowledgeAI Background Ingestion Worker [${workerId}]...`);
  console.log(`[Worker] Poll Interval: ${env.JOB_POLL_INTERVAL_MS}ms, Max Retries: ${env.JOB_MAX_RETRIES}`);

  let isRunning = true;

  const shutdown = () => {
    console.log(`[Worker] Graceful shutdown initiated for ${workerId}...`);
    isRunning = false;
    setTimeout(() => process.exit(0), 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (isRunning) {
    try {
      const job = await JobQueueService.lockNextJob(workerId);

      if (job) {
        console.log(`[Worker] Processing Job ${job.id} for Document ${job.document_id} (Attempt ${job.attempts}/${job.max_attempts})...`);
        const startTime = Date.now();

        try {
          await IngestionProcessor.processDocument(job.document_id, job.organization_id);
          await JobQueueService.markCompleted(job.id, job.document_id);
          console.log(`[Worker] Completed Job ${job.id} in ${Date.now() - startTime}ms`);
        } catch (jobErr: any) {
          console.error(`[Worker] Failed processing Job ${job.id}:`, jobErr);
          await JobQueueService.markFailed(job.id, job.document_id, jobErr);
        }
      } else {
        // Queue empty, wait for next poll interval
        await new Promise((resolve) => setTimeout(resolve, env.JOB_POLL_INTERVAL_MS));
      }
    } catch (err: any) {
      console.error('[Worker] Queue polling exception:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

if (require.main === module) {
  runWorkerLoop();
}

export { runWorkerLoop };
