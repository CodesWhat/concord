import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import * as schema from "./models/schema.js";

const sql = postgres(config.databaseUrl);

export const db = drizzle(sql, { schema });

// Auto-run migrations on startup
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

try {
  await migrate(db, { migrationsFolder });
  console.log("[DB] Migrations applied successfully");
} catch (err) {
  console.error("[DB] Migration failed:", err);
  process.exit(1);
}
