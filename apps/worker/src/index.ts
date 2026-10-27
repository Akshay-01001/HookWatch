import "dotenv/config";
import { Worker } from "bullmq";
import {
  QUEUE_NAME,
  JOB_NAMES,
  getRedisConnection,
  closeQueue,
  type RetryDeliveryPayload,
  type SyncProviderPayload,
} from "@hook-watch/queue";
import { prisma } from "@hook-watch/database";
import { handleRetryDelivery } from "./jobs/retry-delivery.js";
import { handleSyncProvider } from "./jobs/sync-provider.js";

// ─── Logging ────────────────────────────────────────────

function log(level: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

// ─── Worker Setup ───────────────────────────────────────

const connection = getRedisConnection();

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    log("info", `Processing job`, {
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade + 1,
    });

    switch (job.name) {
      case JOB_NAMES.RETRY_DELIVERY:
        return handleRetryDelivery(job.data as RetryDeliveryPayload);
      case JOB_NAMES.SYNC_PROVIDER:
        return handleSyncProvider(job.data as SyncProviderPayload);
      default:
        log("warn", `Unknown job type: ${job.name}`, { jobId: job.id });
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 5,
  },
);

worker.on("completed", (job) => {
  log("info", `Job completed`, { jobId: job.id, jobName: job.name });
});

worker.on("failed", (job, err) => {
  log("error", `Job failed`, {
    jobId: job?.id,
    jobName: job?.name,
    error: err.message,
    attempt: job?.attemptsMade,
  });
});

worker.on("error", (err) => {
  log("error", "Worker error", { error: err.message });
});

// ─── Graceful Shutdown ──────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log("info", `Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new jobs, finish current ones
    await worker.close();
    log("info", "Worker closed");

    // Close shared queue connection
    await closeQueue();
    log("info", "Queue connection closed");

    // Disconnect Prisma
    await prisma.$disconnect();
    log("info", "Database disconnected");

    log("info", "Shutdown complete");
    process.exit(0);
  } catch (err) {
    log("error", "Error during shutdown", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

log("info", `Worker started, listening on queue: ${QUEUE_NAME}`, {
  concurrency: 5,
});
