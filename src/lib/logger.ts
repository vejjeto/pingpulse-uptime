import { randomUUID } from "node:crypto";
import pino from "pino";

export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
  base: { service: "pingpulse-uptime" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.secret",
      "*.token",
      "*.password",
      "WEBHOOK_SECRET",
    ],
    censor: "[REDACTED]",
  },
});

export function getRequestId(request?: Request): string {
  const headerId = request?.headers.get("x-request-id")?.trim();
  return headerId && headerId.length > 0 ? headerId : randomUUID();
}

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
