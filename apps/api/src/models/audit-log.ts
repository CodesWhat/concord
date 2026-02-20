import { pgTable, bigint, uuid, varchar, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers.js";

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "bigint" }).primaryKey(),
  serverId: uuid("server_id").references(() => servers.id, { onDelete: "cascade" }).notNull(),
  actorId: text("actor_id").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 32 }),
  targetId: text("target_id"),
  changes: jsonb("changes").default({}).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  server: one(servers, {
    fields: [auditLog.serverId],
    references: [servers.id],
  }),
}));
