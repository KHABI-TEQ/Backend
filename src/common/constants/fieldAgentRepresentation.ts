/** Shown to agents before confirming a field-agent representation request. */
export const FIELD_AGENT_COMMISSION_DISCLOSURE =
  "When the property transaction is completed by the Field Agent, the commission on that property will be shared 40% to 60% between Khabi-Teq (the company) and you (the requesting Agent).";

/** Checkbox acknowledgement on the request modal (frontend mirrors this). */
export const FIELD_AGENT_COMMISSION_CHECKBOX_ACK =
  "I understand commission is shared 40% to 60% between Khabi-Teq (the company) and me (the requesting Agent) outside the app when the deal completes.";

/** Notification to the requesting agent when a Field Agent accepts. */
export const FIELD_AGENT_COMMISSION_ACCEPTED_MESSAGE =
  "Your Field Agent accepted the representation request and has been assigned to the inspection. Commission on a completed deal is shared 40% to 60% between Khabi-Teq (the company) and you outside the app.";

/** Notification to the Field Agent when an agent submits a request. */
export const FIELD_AGENT_COMMISSION_REQUESTED_MESSAGE_SUFFIX =
  "Commission is shared 40% to 60% between Khabi-Teq (the company) and the requesting Agent outside the app when the deal completes.";

/** Inspection activity log snippet when an agent requests representation. */
export const FIELD_AGENT_COMMISSION_LOG_SNIPPET =
  "commission 40% to 60% (Khabi-Teq / requesting Agent) outside app when deal completes";

/** Timeline step detail for completed deals involving Field Agent representation. */
export const FIELD_AGENT_COMMISSION_TIMELINE_DETAIL =
  "Commission on completed deals is settled outside the app (40% Khabi-Teq / 60% requesting Agent).";

export const FIELD_AGENT_REPRESENTATION_STATUSES = [
  "none",
  "pending",
  "accepted",
  "rejected",
  "cancelled",
] as const;

export type FieldAgentRepresentationStatus =
  (typeof FIELD_AGENT_REPRESENTATION_STATUSES)[number];
