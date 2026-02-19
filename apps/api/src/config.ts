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

  smtp: {
    host: optional("SMTP_HOST", ""),
    port: Number(optional("SMTP_PORT", "587")),
    user: optional("SMTP_USER", ""),
    pass: optional("SMTP_PASS", ""),
    from: optional("SMTP_FROM", "noreply@concord.local"),
  },

  vapid: {
    subject: optional("VAPID_SUBJECT", "mailto:admin@concord.chat"),
    publicKey: optional("VAPID_PUBLIC_KEY", ""),
    privateKey: optional("VAPID_PRIVATE_KEY", ""),
  },

  nodeEnv: optional("NODE_ENV", "development"),
  isDev: optional("NODE_ENV", "development") === "development",
} as const;
