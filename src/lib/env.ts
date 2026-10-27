import { z } from "zod";

/**
 * Centralised, validated access to environment variables.
 * Anything secret stays server-side; nothing here is ever sent to the browser.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex characters (32 bytes)"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === undefined || v === "true" || v === "1"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  SMTP_FROM: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT: z.string().default("common"),
  // Test-only overrides so OAuth providers can be pointed at a mock server.
  GOOGLE_OAUTH_BASE_URL: z.string().optional(),
  GOOGLE_API_BASE_URL: z.string().optional(),
  MICROSOFT_OAUTH_BASE_URL: z.string().optional(),
  MICROSOFT_GRAPH_BASE_URL: z.string().optional(),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  if (parsed.data.STORAGE_DRIVER === "s3") {
    const missing = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter(
      (k) => !process.env[k],
    );
    if (missing.length) throw new Error(`STORAGE_DRIVER=s3 requires ${missing.join(", ")}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.SESSION_SECRET.startsWith("dev-")) {
      throw new Error("SESSION_SECRET still has its development value; generate a real secret.");
    }
    if (/^0+$/.test(parsed.data.ENCRYPTION_KEY)) {
      throw new Error("ENCRYPTION_KEY still has its development value; generate a real key.");
    }
  }
  cached = parsed.data;
  return cached;
}

export function isProduction() {
  return env().NODE_ENV === "production";
}

export function smtpConfigured() {
  const e = env();
  return Boolean(e.SMTP_HOST && e.SMTP_FROM);
}

export function googleConfigured() {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

export function microsoftConfigured() {
  const e = env();
  return Boolean(e.MICROSOFT_CLIENT_ID && e.MICROSOFT_CLIENT_SECRET);
}
