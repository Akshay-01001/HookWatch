import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

export { Redis };

// ─── Queue Configuration ────────────────────────────────

export const QUEUE_NAME = "webhook-jobs" as const;

// ─── Job Names ──────────────────────────────────────────

export const JOB_NAMES = {
  RETRY_DELIVERY: "retry-delivery",
  SYNC_PROVIDER: "sync-provider",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ─── Job Payload Types ──────────────────────────────────

export interface RetryDeliveryPayload {
  eventId: string;
  endpointId: string;
  attemptNumber: number;
}

export interface SyncProviderPayload {
  projectId: string;
  provider: string;
  endpointId: string;
}

export type JobPayloads = {
  [JOB_NAMES.RETRY_DELIVERY]: RetryDeliveryPayload;
  [JOB_NAMES.SYNC_PROVIDER]: SyncProviderPayload;
};

// ─── Redis Connection ───────────────────────────────────

/**
 * Parse a Redis URL into BullMQ-compatible connection options.
 */
export function getRedisConnection(redisUrl?: string): ConnectionOptions {
  const url = redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ workers
  };
}

/**
 * Create a new Redis instance from a Redis URL.
 * BullMQ requires maxRetriesPerRequest: null for workers.
 * Uses lazyConnect: true and attaches an error handler to prevent unhandled error crashes.
 */
export function createRedisClient(redisUrl?: string): Redis {
  const url = redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379";
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
  client.on("error", () => {
    // Handled by callers during command execution
  });
  return client;
}

// ─── Shared Queue Instance ──────────────────────────────

let _queue: Queue | null = null;

/**
 * Get or create the shared BullMQ queue instance.
 * Reuses the same instance across calls to avoid duplicate connections.
 */
export function getQueue(redisUrl?: string): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(redisUrl),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    _queue.on("error", () => {
      // Handled by callers / worker
    });
  }
  return _queue;
}

// ─── Job Enqueue Helpers ────────────────────────────────

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
};

/**
 * Enqueue a retry-delivery job.
 * Call this AFTER the database transaction that created the event has committed.
 */
export async function enqueueRetryDelivery(
  payload: RetryDeliveryPayload,
  options?: JobsOptions,
): Promise<string | undefined> {
  const queue = getQueue();
  const job = await queue.add(JOB_NAMES.RETRY_DELIVERY, payload, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
  return job.id;
}

/**
 * Enqueue a sync-provider job.
 * Call this AFTER the database transaction that created/updated the endpoint has committed.
 */
export async function enqueueSyncProvider(
  payload: SyncProviderPayload,
  options?: JobsOptions,
): Promise<string | undefined> {
  const queue = getQueue();
  const job = await queue.add(JOB_NAMES.SYNC_PROVIDER, payload, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
  return job.id;
}

// ─── Shutdown Utilities ─────────────────────────────────

/**
 * Gracefully close the shared queue and its Redis connection.
 */
export async function closeQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
