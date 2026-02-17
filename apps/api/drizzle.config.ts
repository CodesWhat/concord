import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/models/schema.ts", "./src/models/auth-schema.ts"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://concord:concord@localhost:5432/concord",
  },
});
