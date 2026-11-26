import { logger } from "@/lib/logger";
import { getDbContext } from "./index";
import { ensureSeeded } from "./seed-data";

async function main() {
  const { db, sqlite } = getDbContext();
  const result = await ensureSeeded(db);
  sqlite.close();
  logger.info(
    { seeded: result.seeded },
    result.seeded ? "PingPulse seed inserted." : "PingPulse already seeded.",
  );
}

main().catch((err) => {
  logger.error({ err }, "PingPulse seed failed");
  process.exit(1);
});
