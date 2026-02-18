ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'forum';

CREATE TABLE IF NOT EXISTS forum_posts (
  id bigint PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES channels(id),
  author_id text NOT NULL REFERENCES users(id),
  title text NOT NULL,
  content text NOT NULL,
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  comment_count integer NOT NULL DEFAULT 0,
  tags jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_posts_channel_score_idx ON forum_posts(channel_id, score);
CREATE INDEX IF NOT EXISTS forum_posts_channel_created_idx ON forum_posts(channel_id, created_at);

CREATE TABLE IF NOT EXISTS forum_votes (
  post_id bigint NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
