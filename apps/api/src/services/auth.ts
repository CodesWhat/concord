import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import nodemailer from "nodemailer";
import { config } from "../config.js";
import * as authSchema from "../models/auth-schema.js";

const sql = postgres(config.databaseUrl);
const db = drizzle(sql);

const smtpConfigured = !!config.smtp.host;
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

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
      if (transporter) {
        await transporter.sendMail({
          from: config.smtp.from,
          to: user.email,
          subject: "Reset your Concord password",
          text: `Click this link to reset your password: ${url}\n\nIf you didn't request this, ignore this email.`,
          html: `<p>Click <a href="${url}">here</a> to reset your Concord password.</p><p>If you didn't request this, ignore this email.</p>`,
        });
      } else {
        console.log(`[AUTH] Password reset for ${user.email}: ${url}`);
        console.log("[AUTH] Set SMTP_HOST to enable email delivery");
      }
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(",") : ["http://localhost:5173"],
});
