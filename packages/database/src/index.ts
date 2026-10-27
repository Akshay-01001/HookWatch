import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

// Re-export all generated types for consumers
export * from "../generated/prisma/client.js";
export { PrismaClient };

/**
 * Creates a new PrismaClient instance with the PostgreSQL driver adapter.
 * Each caller should manage the lifecycle of the returned instance.
 */
export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const connectionString = databaseUrl ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Set it in your .env file or pass it explicitly."
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Singleton PrismaClient instance for use in long-running processes.
 * In development, the instance is cached on globalThis to survive
 * module reloads (e.g., Next.js HMR) without exhausting connections.
 *
 * Uses lazy initialization via Proxy so importing the package does not
 * immediately attempt to connect or throw if environment variables
 * are not yet loaded (e.g. during static analysis or build phases).
 */
const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClient;
};

let _prismaInstance: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (globalForPrisma.__prisma) {
    return globalForPrisma.__prisma;
  }
  if (!_prismaInstance) {
    _prismaInstance = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.__prisma = _prismaInstance;
    }
  }
  return _prismaInstance;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
