import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers.js";
import { serverMembers } from "./server-members.js";

export const userStatusEnum = pgEnum("user_status", [
  "online",
  "idle",
  "dnd",
  "offline",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 32 }).unique().notNull(),
  displayName: varchar("display_name", { length: 64 }).notNull(),
  avatarUrl: text("avatar_url"),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  status: userStatusEnum("status").default("offline").notNull(),
  flags: integer("flags").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  ownedServers: many(servers),
  memberships: many(serverMembers),
}));
