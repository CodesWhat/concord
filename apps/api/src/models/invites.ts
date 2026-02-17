import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers.js";
import { channels } from "./channels.js";
import { users } from "./users.js";

export const invites = pgTable("invites", {
  code: varchar("code", { length: 16 }).primaryKey(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  channelId: uuid("channel_id").references(() => channels.id),
  creatorId: uuid("creator_id")
    .references(() => users.id)
    .notNull(),
  maxUses: integer("max_uses"),
  uses: integer("uses").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const invitesRelations = relations(invites, ({ one }) => ({
  server: one(servers, {
    fields: [invites.serverId],
    references: [servers.id],
  }),
  channel: one(channels, {
    fields: [invites.channelId],
    references: [channels.id],
  }),
  creator: one(users, {
    fields: [invites.creatorId],
    references: [users.id],
  }),
}));
