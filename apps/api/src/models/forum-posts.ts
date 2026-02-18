import {
  pgTable,
  uuid,
  text,
  bigint,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { channels } from "./channels.js";
import { users } from "./users.js";

export const forumPosts = pgTable(
  "forum_posts",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey(),
    channelId: uuid("channel_id")
      .references(() => channels.id)
      .notNull(),
    authorId: text("author_id")
      .references(() => users.id)
      .notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    upvotes: integer("upvotes").default(0).notNull(),
    downvotes: integer("downvotes").default(0).notNull(),
    score: integer("score").default(0).notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    locked: boolean("locked").default(false).notNull(),
    commentCount: integer("comment_count").default(0).notNull(),
    tags: jsonb("tags").default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("forum_posts_channel_score_idx").on(table.channelId, table.score),
    index("forum_posts_channel_created_idx").on(table.channelId, table.createdAt),
  ],
);

export const forumPostsRelations = relations(forumPosts, ({ one }) => ({
  channel: one(channels, {
    fields: [forumPosts.channelId],
    references: [channels.id],
  }),
  author: one(users, {
    fields: [forumPosts.authorId],
    references: [users.id],
  }),
}));

export const forumVotes = pgTable(
  "forum_votes",
  {
    postId: bigint("post_id", { mode: "bigint" })
      .references(() => forumPosts.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("forum_votes_post_user_unique").on(table.postId, table.userId),
  ],
);

export const forumVotesRelations = relations(forumVotes, ({ one }) => ({
  post: one(forumPosts, {
    fields: [forumVotes.postId],
    references: [forumPosts.id],
  }),
  user: one(users, {
    fields: [forumVotes.userId],
    references: [users.id],
  }),
}));
