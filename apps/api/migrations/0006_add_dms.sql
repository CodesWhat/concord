CREATE TABLE IF NOT EXISTS "dm_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dm_participants" (
	"dm_channel_id" uuid NOT NULL REFERENCES "dm_channels"("id") ON DELETE CASCADE,
	"user_id" text NOT NULL REFERENCES "users"("id"),
	CONSTRAINT "dm_participants_dm_channel_id_user_id_pk" PRIMARY KEY("dm_channel_id","user_id")
);

CREATE TABLE IF NOT EXISTS "dm_messages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"dm_channel_id" uuid NOT NULL REFERENCES "dm_channels"("id") ON DELETE CASCADE,
	"author_id" text NOT NULL REFERENCES "users"("id"),
	"content" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dm_messages_channel_created_idx" ON "dm_messages" ("dm_channel_id", "created_at");
