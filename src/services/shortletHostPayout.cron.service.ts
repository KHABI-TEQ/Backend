import { processShortletHostPayouts } from "./shortletHostPayout.service";

/**
 * Cron entry: disburse shortlet host payouts after check-in (+ configured delay).
 */
export async function runShortletHostPayoutCron(): Promise<{
  processed: number;
  completed: number;
  failed: number;
  skippedLegacy: number;
}> {
  return processShortletHostPayouts(
    Number(process.env.SHORTLET_HOST_PAYOUT_BATCH_SIZE || 25)
  );
}
