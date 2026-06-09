/** Shown to agents before confirming a field-agent representation request. No Paystack payment. */
export const FIELD_AGENT_COMMISSION_DISCLOSURE =
  "When the property transaction is completed by the Field Agent, the commission on that property will be shared 50% to 50% between Khabi-Teq (the company) and you (the requesting Agent) outside the app. No payment through Paystack is required for this request.";

export const FIELD_AGENT_REPRESENTATION_STATUSES = [
  "none",
  "pending",
  "accepted",
  "rejected",
  "cancelled",
] as const;

export type FieldAgentRepresentationStatus =
  (typeof FIELD_AGENT_REPRESENTATION_STATUSES)[number];
