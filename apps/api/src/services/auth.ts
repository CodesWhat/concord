import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as authSchema from "../models/auth-schema.js";

const sql = postgres(config.databaseUrl);
const db = drizzle(sql);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  baseURL: process.env.AUTH_BASE_URL ?? `http://localhost:${config.port}`,
  secret: process.env.AUTH_SECRET ?? (config.isDev ? "dev-secret-change-in-production" : (() => { throw new Error("AUTH_SECRET required in production"); })()),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[AUTH] Password reset requested for ${user.email}: ${url}`);
      // TODO: Add SMTP transport for production email delivery
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(",") : ["http://localhost:5173"],
});
