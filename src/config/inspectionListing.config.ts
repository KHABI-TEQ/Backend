/**
 * All inspection listing endpoints must return only inspections with these statuses.
 * Corresponds to: pending_inspection, inspection_approved, inspection_rescheduled,
 * inspection_rejected_by_seller, completed (pending_inspection = pending_approval + pending_transaction;
 * inspection_rejected_by_seller = agent_rejected in schema).
 */
export const INSPECTION_LISTING_ALLOWED_STATUSES = [
  "pending_approval",
  "pending_transaction",
  "inspection_approved",
  "inspection_rescheduled",
  "agent_rejected",
  "completed",
] as const;

