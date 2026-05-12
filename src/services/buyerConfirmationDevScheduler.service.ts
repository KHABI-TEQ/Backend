import { sendSingleInspectionConfirmationEmail } from "./inspectionConfirmationCron.service";
import { sendSingleTransactionConfirmationEmail } from "./transactionConfirmationCron.service";

const DEV_INSPECTION_DELAY_MS = 60_000;
const DEV_TRANSACTION_DELAY_MS = 5 * 60_000;

const devBuyerConfirmTimers = new Map<
  string,
  { inspection?: ReturnType<typeof setTimeout>; transaction?: ReturnType<typeof setTimeout> }
>();

function clearDevBuyerConfirmationTimers(inspectionId: string): void {
  const prev = devBuyerConfirmTimers.get(inspectionId);
  if (!prev) return;
  if (prev.inspection) clearTimeout(prev.inspection);
  if (prev.transaction) clearTimeout(prev.transaction);
  devBuyerConfirmTimers.delete(inspectionId);
}

/**
 * Non-production only: 1 minute after seller acceptance (or successful inspection fee payment),
 * send the inspection confirmation email; 5 minutes after that email succeeds, send the
 * transaction confirmation email. Ignores scheduled slot and inspection-step gates used in prod crons.
 */
export function scheduleDevBuyerConfirmationSequenceAfterSellerAccept(inspectionId: string): void {
  if (process.env.NODE_ENV === "production") return;
  clearDevBuyerConfirmationTimers(inspectionId);

  const inspectionTimer = setTimeout(async () => {
    const sent = await sendSingleInspectionConfirmationEmail(inspectionId, { devBypassSlot: true });
    if (!sent) {
      clearDevBuyerConfirmationTimers(inspectionId);
      return;
    }
    const transactionTimer = setTimeout(async () => {
      try {
        await sendSingleTransactionConfirmationEmail(inspectionId, {
          devBypassInspectionStepAndSlot: true,
        });
      } finally {
        devBuyerConfirmTimers.delete(inspectionId);
      }
    }, DEV_TRANSACTION_DELAY_MS);
    devBuyerConfirmTimers.set(inspectionId, { transaction: transactionTimer });
  }, DEV_INSPECTION_DELAY_MS);

  devBuyerConfirmTimers.set(inspectionId, { inspection: inspectionTimer });
}
