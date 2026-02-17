import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { servers } from "./servers.js";
import { memberRoles } from "./member-roles.js";

export const serverMembers = pgTable(
  "server_members",
  {
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    serverId: uuid("server_id")
      .references(() => servers.id)
      .notNull(),
    nickname: varchar("nickname", { length: 64 }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    muted: boolean("muted").default(false).notNull(),
    deafened: boolean("deafened").default(false).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.serverId] })],
);

export const serverMembersRelations = relations(
  serverMembers,
  ({ one, many }) => ({
    user: one(users, {
      fields: [serverMembers.userId],
      references: [users.id],
    }),
    server: one(servers, {
      fields: [serverMembers.serverId],
      references: [servers.id],
    }),
    roles: many(memberRoles),
  }),
);
