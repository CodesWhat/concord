import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { channels } from "./channels.js";
import { users } from "./users.js";

export const messages = pgTable(
  "messages",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey(),
    channelId: uuid("channel_id")
      .references(() => channels.id)
      .notNull(),
    authorId: text("author_id")
      .references(() => users.id)
      .notNull(),
    content: text("content").notNull(),
    attachments: jsonb("attachments").default([]).notNull(),
    embeds: jsonb("embeds").default([]).notNull(),
    replyToId: bigint("reply_to_id", { mode: "bigint" }),
    threadId: uuid("thread_id"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deleted: boolean("deleted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_channel_created_idx").on(
      table.channelId,
      table.createdAt,
    ),
  ],
);

export const messagesRelations = relations(messages, ({ one }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  author: one(users, {
    fields: [messages.authorId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
  }),
}));
