/**
 * Inspection booking `status` values eligible for buyer confirmation emails (inspection + transaction crons).
 * Keep in sync with cron query logic.
 */
export const BUYER_CONFIRM_FLOW_INSPECTION_STATUSES = [
  "inspection_approved",
  "pending_transaction",
  "active_negotiation",
  "negotiation_accepted",
  "completed",
] as const;

export type BuyerConfirmFlowInspectionStatus =
  (typeof BUYER_CONFIRM_FLOW_INSPECTION_STATUSES)[number];
