import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";
import { openJournalDatabase } from "./bootstrap";
import { tenantDataDir } from "../server/tenant";

export const dataDir = tenantDataDir;

const globalForDb = globalThis as unknown as {
  __tenantDbs?: Map<string, ReturnType<typeof createDb>>;
};

const createDb = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  return drizzle(openJournalDatabase(join(dir, "journal.db")), { schema });
};

const databases = (globalForDb.__tenantDbs ??= new Map());
/** Resolve the database from server-verified identity for every request. */
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, property) {
    const dir = dataDir();
    let instance = databases.get(dir);
    if (!instance || !instance.$client.open) {
      instance = createDb(dir);
      databases.set(dir, instance);
    }
    const value = Reflect.get(instance, property);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export * from "./schema";
