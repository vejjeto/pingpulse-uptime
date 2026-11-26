import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().trim().min(1).default("file:./data/pingpulse.db"),
  POSTGRES_URL: z.string().trim().url().optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().trim().url().default("http://localhost:3007"),
  WEBHOOK_SECRET: z.string().min(8).default("pingpulse-dev-webhook-secret"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  if (source.SKIP_ENV_VALIDATION === "true") {
    return {
      NODE_ENV: (source.NODE_ENV as AppEnv["NODE_ENV"]) ?? "development",
      DATABASE_URL: source.DATABASE_URL?.trim() || "file:./data/pingpulse.db",
      POSTGRES_URL: source.POSTGRES_URL?.trim() || undefined,
      NEXT_PUBLIC_APP_URL:
        source.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3007",
      WEBHOOK_SECRET: source.WEBHOOK_SECRET || "pingpulse-dev-webhook-secret",
    };
  }

  const parsed = EnvSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    DATABASE_URL: source.DATABASE_URL,
    POSTGRES_URL: source.POSTGRES_URL,
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL,
    WEBHOOK_SECRET: source.WEBHOOK_SECRET,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}
