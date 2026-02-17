import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers.js";

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }),
  position: integer("position").default(0).notNull(),
  permissions: bigint("permissions", { mode: "bigint" }).default(0n).notNull(),
  mentionable: boolean("mentionable").default(false).notNull(),
  hoisted: boolean("hoisted").default(false).notNull(),
});

export const rolesRelations = relations(roles, ({ one }) => ({
  server: one(servers, {
    fields: [roles.serverId],
    references: [servers.id],
  }),
}));
