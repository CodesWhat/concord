import { pgTable, uuid, varchar, text, jsonb, timestamp } from "drizzle-orm/pg-core";
// Note: servers.id stays uuid, but ownerId is text to match Better Auth user IDs
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { categories } from "./categories.js";
import { channels } from "./channels.js";
import { roles } from "./roles.js";
import { serverMembers } from "./server-members.js";
import { invites } from "./invites.js";

export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  iconUrl: text("icon_url"),
  ownerId: text("owner_id")
    .references(() => users.id)
    .notNull(),
  description: text("description"),
  settings: jsonb("settings").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const serversRelations = relations(servers, ({ one, many }) => ({
  owner: one(users, {
    fields: [servers.ownerId],
    references: [users.id],
  }),
  categories: many(categories),
  channels: many(channels),
  roles: many(roles),
  members: many(serverMembers),
  invites: many(invites),
}));
