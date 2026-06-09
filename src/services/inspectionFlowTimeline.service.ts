import { IInspectionBookingDoc } from "../models";

export type InspectionFlowStepStatus = "done" | "pending" | "skipped" | "active";

export interface InspectionFlowStep {
  key: string;
  label: string;
  status: InspectionFlowStepStatus;
  at?: string;
  detail?: string;
}

function iso(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString();
}

function userLabel(u: unknown): string | undefined {
  if (!u || typeof u !== "object") return undefined;
  const o = u as { firstName?: string; lastName?: string; email?: string };
  const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim();
  return name || o.email;
}

/**
 * Ordered lifecycle for admin auditing: buyer request → agent → payment → FA request → on-site → completion.
 */
export function buildInspectionFlowTimeline(
  inspection: IInspectionBookingDoc | Record<string, unknown>,
): InspectionFlowStep[] {
  const ins = inspection as Record<string, unknown>;
  const status = String(ins.status ?? "");
  const stage = String(ins.stage ?? "");
  const tx = ins.transaction as { status?: string } | null | undefined;
  const report = (ins.inspectionReport ?? {}) as Record<string, unknown>;
  const receiverMode = ins.receiverMode as { type?: string } | undefined;
  const isDealSite = receiverMode?.type === "dealSite";

  const faStatus = String(ins.fieldAgentRequestStatus ?? "none");
  const requestedBy = userLabel(ins.fieldAgentRequestedBy);
  const targetFa = userLabel(ins.fieldAgentRequestTargetId);
  const assignedFa = userLabel(ins.assignedFieldAgent);

  const agentRejected = status === "agent_rejected";
  const agentAccepted =
    !agentRejected &&
    !["pending_approval", "new"].includes(status) &&
    status !== "";

  const buyerPaid = tx?.status === "success";
  const dealSiteApproved = isDealSite && status === "inspection_approved";
  const paymentReady = buyerPaid || dealSiteApproved || status === "confirmed";

  const faRequestDone = faStatus !== "none" && faStatus !== undefined;
  const faPending = faStatus === "pending";
  const faRejected = faStatus === "rejected";
  const faCancelled = faStatus === "cancelled";
  const faAccepted = faStatus === "accepted" || Boolean(ins.assignedFieldAgent);

  const hasAssignment = Boolean(ins.assignedFieldAgent);
  const reportStatus = String(report.status ?? "pending");
  const onsiteStarted = Boolean(report.inspectionStartedAt);
  const onsiteStopped = Boolean(report.inspectionCompletedAt);
  const reportSubmitted = Boolean(report.submittedAt) || reportStatus === "completed";
  const inspectionDone = status === "completed" || stage === "completed";

  const steps: InspectionFlowStep[] = [
    {
      key: "buyer_request",
      label: "Buyer inspection request",
      status: "done",
      at: iso(ins.createdAt as Date),
    },
    {
      key: "agent_response",
      label: agentRejected ? "Agent rejected request" : "Agent accepted request",
      status: agentRejected ? "done" : agentAccepted ? "done" : status === "pending_approval" ? "active" : "pending",
      at: agentAccepted || agentRejected ? iso(ins.updatedAt as Date) : undefined,
      detail: agentRejected ? "Buyer was notified" : undefined,
    },
    {
      key: "payment_or_approval",
      label: isDealSite ? "DealSite approval / buyer payment" : "Buyer inspection payment",
      status: paymentReady
        ? "done"
        : status === "pending_transaction"
          ? "active"
          : agentAccepted
            ? "pending"
            : "skipped",
      at: paymentReady ? iso((tx as { updatedAt?: Date })?.updatedAt ?? ins.updatedAt as Date) : undefined,
      detail: dealSiteApproved && !buyerPaid ? "Approved without fee (DealSite)" : buyerPaid ? "Payment successful" : undefined,
    },
    {
      key: "field_agent_request",
      label: "Agent requested Field Agent",
      status: faRequestDone
        ? "done"
        : paymentReady && !hasAssignment
          ? "pending"
          : "skipped",
      at: iso(ins.fieldAgentRequestedAt as Date),
      detail: requestedBy
        ? `Requested by ${requestedBy}${targetFa ? ` → ${targetFa}` : ""}`
        : undefined,
    },
    {
      key: "field_agent_response",
      label: faRejected
        ? "Field Agent declined"
        : faCancelled
          ? "Agent cancelled request"
          : faAccepted
            ? "Field Agent accepted"
            : "Field Agent response",
      status: faRejected || faCancelled || faAccepted
        ? "done"
        : faPending
          ? "active"
          : faRequestDone
            ? "pending"
            : "skipped",
      at: iso(ins.fieldAgentRespondedAt as Date),
      detail: ins.fieldAgentRequestNote ? String(ins.fieldAgentRequestNote) : undefined,
    },
    {
      key: "field_agent_assigned",
      label: "Field Agent assigned",
      status: hasAssignment ? "done" : faPending ? "pending" : "skipped",
      at: hasAssignment ? iso(ins.fieldAgentRespondedAt as Date ?? ins.updatedAt as Date) : undefined,
      detail: assignedFa ? assignedFa : undefined,
    },
    {
      key: "onsite_start",
      label: "On-site inspection started",
      status: onsiteStarted ? "done" : hasAssignment ? "pending" : "skipped",
      at: iso(report.inspectionStartedAt as Date),
    },
    {
      key: "onsite_stop",
      label: "On-site visit completed",
      status: onsiteStopped ? "done" : onsiteStarted ? "pending" : "skipped",
      at: iso(report.inspectionCompletedAt as Date),
    },
    {
      key: "report_submitted",
      label: "Field Agent report submitted",
      status: reportSubmitted
        ? "done"
        : onsiteStopped || reportStatus === "awaiting-report"
          ? "active"
          : hasAssignment
            ? "pending"
            : "skipped",
      at: iso(report.submittedAt as Date),
      detail: report.buyerPresent != null
        ? `Buyer: ${report.buyerPresent ? "present" : "absent"}, Seller: ${report.sellerPresent ? "present" : "absent"}`
        : undefined,
    },
    {
      key: "inspection_closed",
      label: "Inspection marked completed",
      status: inspectionDone ? "done" : reportSubmitted ? "pending" : "skipped",
      at: inspectionDone ? iso(ins.updatedAt as Date) : undefined,
    },
    {
      key: "buyer_confirmed_viewing",
      label: "Buyer confirmed viewing took place",
      status: ins.buyerConfirmedInspectionAt ? "done" : inspectionDone ? "pending" : "skipped",
      at: iso(ins.buyerConfirmedInspectionAt as Date),
    },
    {
      key: "buyer_confirmed_deal",
      label: "Buyer confirmed transaction completed",
      status: ins.buyerConfirmedTransactionAt ? "done" : "skipped",
      at: iso(ins.buyerConfirmedTransactionAt as Date),
      detail: "Commission on completed deals is settled outside the app (50/50 company / requesting Agent).",
    },
  ];

  return steps;
}
