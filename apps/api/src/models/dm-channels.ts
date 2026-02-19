import {
  pgTable,
  uuid,
  text,
  bigint,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";

export const dmChannels = pgTable("dm_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const dmParticipants = pgTable(
  "dm_participants",
  {
    dmChannelId: uuid("dm_channel_id")
      .references(() => dmChannels.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.dmChannelId, table.userId] }),
  ],
);

export const dmMessages = pgTable(
  "dm_messages",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey(),
    dmChannelId: uuid("dm_channel_id")
      .references(() => dmChannels.id, { onDelete: "cascade" })
      .notNull(),
    authorId: text("author_id")
      .references(() => users.id)
      .notNull(),
    content: text("content").notNull(),
    attachments: jsonb("attachments").default([]).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("dm_messages_channel_created_idx").on(
      table.dmChannelId,
      table.createdAt,
    ),
  ],
);

export const dmChannelsRelations = relations(dmChannels, ({ many }) => ({
  participants: many(dmParticipants),
  messages: many(dmMessages),
}));

export const dmParticipantsRelations = relations(dmParticipants, ({ one }) => ({
  dmChannel: one(dmChannels, {
    fields: [dmParticipants.dmChannelId],
    references: [dmChannels.id],
  }),
  user: one(users, {
    fields: [dmParticipants.userId],
    references: [users.id],
  }),
}));

export const dmMessagesRelations = relations(dmMessages, ({ one }) => ({
  dmChannel: one(dmChannels, {
    fields: [dmMessages.dmChannelId],
    references: [dmChannels.id],
  }),
  author: one(users, {
    fields: [dmMessages.authorId],
    references: [users.id],
  }),
}));
