import { pgTable, uuid, text, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { roles } from "./roles.js";
import { serverMembers } from "./server-members.js";

export const memberRoles = pgTable(
  "member_roles",
  {
    userId: text("user_id").notNull(),
    serverId: uuid("server_id").notNull(),
    roleId: uuid("role_id")
      .references(() => roles.id)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.serverId, table.roleId] }),
  ],
);

export const memberRolesRelations = relations(memberRoles, ({ one }) => ({
  role: one(roles, {
    fields: [memberRoles.roleId],
    references: [roles.id],
  }),
  member: one(serverMembers, {
    fields: [memberRoles.userId, memberRoles.serverId],
    references: [serverMembers.userId, serverMembers.serverId],
  }),
}));
