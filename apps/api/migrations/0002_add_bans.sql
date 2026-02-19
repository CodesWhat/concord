CREATE TABLE IF NOT EXISTS "bans" (
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"server_id" uuid NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
	"reason" text,
	"banned_by" text NOT NULL REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bans_user_id_server_id_pk" PRIMARY KEY("user_id","server_id")
);
