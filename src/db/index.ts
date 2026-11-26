import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { type SqliteRemoteDatabase, drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

export type PingPulseDb = SqliteRemoteDatabase<typeof schema>;

export interface DbContext {
  db: PingPulseDb;
  sqlite: DatabaseSync;
}

const MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    expected_status INTEGER NOT NULL DEFAULT 200,
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_ms INTEGER NOT NULL DEFAULT 5000,
    webhook_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_public INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS heartbeats (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    http_status INTEGER,
    latency_ms INTEGER NOT NULL,
    error_message TEXT,
    checked_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_time
    ON heartbeats(monitor_id, checked_at DESC);

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    cause TEXT NOT NULL,
    started_at TEXT NOT NULL,
    resolved_at TEXT
  );
`;

export function runMigrations(sqlite: DatabaseSync): void {
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(MIGRATIONS_SQL);
}

function resolveDbFilePath(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw || raw.startsWith("postgres")) {
    return path.resolve(process.cwd(), "data/pingpulse.db");
  }
  if (raw === ":memory:") return raw;
  const cleaned = raw.startsWith("file:") ? raw.slice(5) : raw;
  return path.isAbsolute(cleaned)
    ? cleaned
    : path.resolve(process.cwd(), cleaned);
}

export function createPingPulseDb(dbLocation?: string): DbContext {
  const location = dbLocation ?? resolveDbFilePath();
  if (location !== ":memory:") {
    mkdirSync(path.dirname(location), { recursive: true });
  }
  const sqlite = new DatabaseSync(location);
  if (location !== ":memory:") {
    sqlite.exec("PRAGMA journal_mode = WAL;");
  }
  runMigrations(sqlite);

  const db = drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      const bindParams = params as SQLInputValue[];
      if (method === "run") {
        stmt.run(...bindParams);
        return { rows: [] };
      }
      stmt.setReturnArrays(true);
      if (method === "get") {
        const row = stmt.get(...bindParams);
        return { rows: (row ?? undefined) as unknown as unknown[] };
      }
      return { rows: stmt.all(...bindParams) as unknown as unknown[] };
    },
    { schema },
  );

  return { db, sqlite };
}

const globalForDb = globalThis as unknown as { __pingpulseDb?: DbContext };

export function getDbContext(): DbContext {
  if (!globalForDb.__pingpulseDb) {
    globalForDb.__pingpulseDb = createPingPulseDb();
  }
  return globalForDb.__pingpulseDb;
}

export const db = new Proxy({} as PingPulseDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDbContext().db, prop, receiver);
  },
});
