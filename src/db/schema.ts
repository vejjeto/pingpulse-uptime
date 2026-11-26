import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const monitors = sqliteTable("monitors", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  method: text("method").notNull().default("GET"),
  expectedStatus: integer("expected_status").notNull().default(200),
  intervalSeconds: integer("interval_seconds").notNull().default(60),
  timeoutMs: integer("timeout_ms").notNull().default(5000),
  webhookUrl: text("webhook_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const heartbeats = sqliteTable(
  "heartbeats",
  {
    id: text("id").primaryKey(),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    httpStatus: integer("http_status"),
    latencyMs: integer("latency_ms").notNull(),
    errorMessage: text("error_message"),
    checkedAt: text("checked_at").notNull(),
  },
  (table) => [
    index("idx_heartbeats_monitor_time").on(table.monitorId, table.checkedAt),
  ],
);

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  monitorId: text("monitor_id")
    .notNull()
    .references(() => monitors.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  cause: text("cause").notNull(),
  startedAt: text("started_at").notNull(),
  resolvedAt: text("resolved_at"),
});
