import { CaseStatus } from "../models/case";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";

const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  petition_submitted: ["case_opened"],
  case_opened: ["mediation", "closed"],
  mediation: ["transferred_to_efcc", "closed"],
  transferred_to_efcc: ["closed"],
  closed: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  const allowed = VALID_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (from === "closed") {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Cannot change status of a closed case.");
  }

  if (from === "petition_submitted" && to !== "case_opened") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Petition must be opened into a formal case first."
    );
  }

  if (to === "transferred_to_efcc") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Use the EFCC transfer endpoint to transfer a case to the EFCC."
    );
  }

  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `Invalid case status transition from '${from}' to '${to}'. Allowed transitions: ${allowed.join(", ") || "none"}`
    );
  }
}

export function getAllowedTransitions(current: CaseStatus): CaseStatus[] {
  return VALID_TRANSITIONS[current] || [];
}

export function computeAllowedActions(caseStatus: CaseStatus) {
  const isClosed = caseStatus === "closed";
  return {
    startMediation: !isClosed && ["case_opened", "mediation"].includes(caseStatus),
    requestInformation: !isClosed,
    transferToEfcc: caseStatus === "mediation",
    updateStatus: (() => {
      const map: Record<CaseStatus, CaseStatus[]> = {
        petition_submitted: [],
        case_opened: ["mediation", "closed"],
        mediation: ["closed"],
        transferred_to_efcc: ["closed"],
        closed: [],
      };
      return map[caseStatus] ?? [];
    })(),
    close: !isClosed && caseStatus !== "petition_submitted",
  };
}
