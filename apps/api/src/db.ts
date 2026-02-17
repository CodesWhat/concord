import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "./config.js";
import * as schema from "./models/schema.js";

const sql = postgres(config.databaseUrl);

export const db = drizzle(sql, { schema });
