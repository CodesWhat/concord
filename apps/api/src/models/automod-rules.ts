import { pgTable, uuid, varchar, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers.js";

export const automodRuleTypeEnum = pgEnum("automod_rule_type", [
  "word_filter",
  "link_filter",
  "spam",
  "raid",
]);

export const automodRules = pgTable("automod_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").references(() => servers.id, { onDelete: "cascade" }).notNull(),
  type: automodRuleTypeEnum("type").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  config: jsonb("config").default({}).notNull(),
  action: varchar("action", { length: 32 }).default("delete").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const automodRulesRelations = relations(automodRules, ({ one }) => ({
  server: one(servers, {
    fields: [automodRules.serverId],
    references: [servers.id],
  }),
}));
