import { pgTable, uuid, varchar, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers.js";
import { channels } from "./channels.js";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  position: integer("position").default(0).notNull(),
  permissionOverrides: jsonb("permission_overrides").default({}).notNull(),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  server: one(servers, {
    fields: [categories.serverId],
    references: [servers.id],
  }),
  channels: many(channels),
}));
