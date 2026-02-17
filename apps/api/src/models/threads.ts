import {
  pgTable,
  uuid,
  bigint,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { channels } from "./channels.js";
import { messages } from "./messages.js";

export const threads = pgTable("threads", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentMessageId: bigint("parent_message_id", { mode: "bigint" })
    .references(() => messages.id)
    .notNull(),
  channelId: uuid("channel_id")
    .references(() => channels.id)
    .notNull(),
  name: text("name").notNull(),
  archived: boolean("archived").default(false).notNull(),
  autoArchiveAfter: integer("auto_archive_after"),
  messageCount: integer("message_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const threadsRelations = relations(threads, ({ one }) => ({
  parentMessage: one(messages, {
    fields: [threads.parentMessageId],
    references: [messages.id],
  }),
  channel: one(channels, {
    fields: [threads.channelId],
    references: [channels.id],
  }),
}));
