import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servers } from "./servers.js";
import { subscriptions } from "./subscriptions.js";

export const communities = pgTable(
  "communities",
  {
    serverId: uuid("server_id")
      .references(() => servers.id, { onDelete: "cascade" })
      .primaryKey(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    description: text("description"),
    category: varchar("category", { length: 64 }),
    tags: jsonb("tags").default([]).notNull(),
    rules: jsonb("rules").default([]).notNull(),
    bannerUrl: text("banner_url"),
    isPublic: boolean("is_public").default(true).notNull(),
    subscriberCount: integer("subscriber_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("communities_public_subscribers_idx").on(
      table.isPublic,
      table.subscriberCount,
    ),
    index("communities_created_idx").on(table.createdAt),
  ],
);

export const communitiesRelations = relations(communities, ({ one, many }) => ({
  server: one(servers, {
    fields: [communities.serverId],
    references: [servers.id],
  }),
  subscriptions: many(subscriptions),
}));
