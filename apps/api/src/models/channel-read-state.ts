import {
  pgTable,
  text,
  uuid,
  bigint,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { channels } from "./channels.js";

export const channelReadState = pgTable(
  "channel_read_state",
  {
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    channelId: uuid("channel_id")
      .references(() => channels.id)
      .notNull(),
    lastReadMessageId: bigint("last_read_message_id", { mode: "bigint" }),
    mentionCount: integer("mention_count").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.channelId] })],
);

export const channelReadStateRelations = relations(
  channelReadState,
  ({ one }) => ({
    user: one(users, {
      fields: [channelReadState.userId],
      references: [users.id],
    }),
    channel: one(channels, {
      fields: [channelReadState.channelId],
      references: [channels.id],
    }),
  }),
);
