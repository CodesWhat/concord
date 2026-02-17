function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional("PORT", "3000")),
  host: optional("HOST", "0.0.0.0"),

  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),

  livekit: {
    url: optional("LIVEKIT_URL", ""),
    apiKey: optional("LIVEKIT_API_KEY", ""),
    apiSecret: optional("LIVEKIT_API_SECRET", ""),
  },

  s3: {
    endpoint: optional("S3_ENDPOINT", ""),
    bucket: optional("S3_BUCKET", "concord"),
    accessKey: optional("S3_ACCESS_KEY", ""),
    secretKey: optional("S3_SECRET_KEY", ""),
  },

  nodeEnv: optional("NODE_ENV", "development"),
  isDev: optional("NODE_ENV", "development") === "development",
} as const;
