import { logger } from "@/lib/logger";
import { getDbContext } from "./index";

function main() {
  const { sqlite } = getDbContext();
  sqlite.close();
  logger.info("PingPulse migrations applied.");
}

main();
