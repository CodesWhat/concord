import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers.js";
import { categories } from "./categories.js";
import { messages } from "./messages.js";

export const channelTypeEnum = pgEnum("channel_type", [
  "text",
  "voice",
  "announcement",
  "stage",
]);

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  type: channelTypeEnum("type").default("text").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  topic: text("topic"),
  position: integer("position").default(0).notNull(),
  ttlSeconds: integer("ttl_seconds"),
  slowmodeSeconds: integer("slowmode_seconds").default(0).notNull(),
  nsfw: boolean("nsfw").default(false).notNull(),
  permissionOverrides: jsonb("permission_overrides").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const channelsRelations = relations(channels, ({ one, many }) => ({
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id],
  }),
  category: one(categories, {
    fields: [channels.categoryId],
    references: [categories.id],
  }),
  messages: many(messages),
}));
