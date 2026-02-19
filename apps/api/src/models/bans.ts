import { pgTable, uuid, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { servers } from "./servers.js";

export const bans = pgTable(
  "bans",
  {
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    serverId: uuid("server_id")
      .references(() => servers.id, { onDelete: "cascade" })
      .notNull(),
    reason: text("reason"),
    bannedBy: text("banned_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.serverId] })],
);

export const bansRelations = relations(bans, ({ one }) => ({
  user: one(users, {
    fields: [bans.userId],
    references: [users.id],
    relationName: "bannedUser",
  }),
  server: one(servers, {
    fields: [bans.serverId],
    references: [servers.id],
  }),
  bannedByUser: one(users, {
    fields: [bans.bannedBy],
    references: [users.id],
    relationName: "bannedByUser",
  }),
}));
