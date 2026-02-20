import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { servers } from "./servers.js";
import { communities } from "./communities.js";

export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    serverId: uuid("server_id")
      .references(() => servers.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.serverId] }),
    index("subscriptions_server_idx").on(table.serverId),
    index("subscriptions_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  server: one(servers, {
    fields: [subscriptions.serverId],
    references: [servers.id],
  }),
  community: one(communities, {
    fields: [subscriptions.serverId],
    references: [communities.serverId],
  }),
}));
