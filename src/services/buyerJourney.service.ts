import { Types } from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { effectiveRevealedCount } from "./matchBatch.service";

export type JourneyStepState = "done" | "current" | "upcoming";

export type JourneyStep = {
  key: string;
  title: string;
  state: JourneyStepState;
  detail: string;
  action?: { label: string; href: string } | null;
};

type DraftStep = {
  key: string;
  title: string;
  detail: string;
  complete: boolean;
  halt?: boolean;
  action?: { label: string; href: string } | null;
};

const INSPECTION_READY = new Set([
  "completed",
  "inspection_approved",
  "pending_transaction",
  "active_negotiation",
  "negotiation_accepted",
  "inspection_rescheduled",
]);

const BRIEF_PAID = new Set(["in-progress", "delivered", "completed"]);
const CERTIFICATE_READY = new Set(["certificate_issued", "completed", "approved"]);
const FEE_PAID = new Set([
  "pending_completion",
  "khabiteq_verified",
  "forwarded_to_lasrera",
  "info_requested",
  "approved",
  "certificate_issued",
  "completed",
]);

function applyStates(drafts: DraftStep[]): JourneyStep[] {
  let assigned = false;
  let halted = false;
  return drafts.map((step) => {
    if (halted) {
      return { key: step.key, title: step.title, detail: step.detail, state: "upcoming", action: null };
    }
    if (step.complete) {
      if (step.halt) halted = true;
      return { key: step.key, title: step.title, detail: step.detail, state: "done", action: null };
    }
    if (!assigned) {
      assigned = true;
      return {
        key: step.key,
        title: step.title,
        detail: step.detail,
        state: "current",
        action: step.action || null,
      };
    }
    return { key: step.key, title: step.title, detail: step.detail, state: "upcoming", action: null };
  });
}

function propertyTitle(property: any): string {
  const location = property?.location || {};
  return (
    [location.area, location.localGovernment, location.state].filter(Boolean).join(", ") ||
    property?.title ||
    property?.propertyName ||
    "Property"
  );
}

function preferenceTitle(preference: any): string {
  const location = preference?.location || {};
  return [location.area, location.state].filter(Boolean).join(", ") || "Your search";
}

function registrationDetail(status: string): string {
  if (CERTIFICATE_READY.has(status)) return "Registration is complete.";
  if (status === "rejected") return "This registration was not approved.";
  if (status === "info_requested") return "More information was requested.";
  if (status === "submitted") return "The registration form is saved. The registration fee is still due.";
  if (FEE_PAID.has(status)) return "Registration fee paid. Khabiteq is reviewing this registration.";
  return "Your registration has been submitted and is under review.";
}

function inspectionDetail(status: string): string {
  const label = String(status || "requested").replace(/_/g, " ");
  if (status === "pending_approval") return "Waiting for the agent to accept this inspection.";
  if (INSPECTION_READY.has(status) && status !== "completed") return "Inspection is scheduled.";
  if (status === "completed") return "The inspection is complete.";
  if (["cancelled", "agent_rejected", "transaction_failed"].includes(status)) {
    return "This inspection did not go ahead.";
  }
  return `Inspection status: ${label}.`;
}

function briefDetail(status: string): string {
  if (status === "awaiting-offers") return "Professionals can send offers. Compare them when they arrive.";
  if (status === "awaiting-payment") return "You selected an offer. Pay the fee to see the professional’s contact details.";
  if (BRIEF_PAID.has(status)) return "Payment received. The professional’s contact details are on this brief.";
  return `Brief status: ${String(status || "").replace(/-/g, " ")}.`;
}

function propertySteps(params: {
  inspection: any | null;
  propertyId: string;
  preferenceId: string;
  matchedId?: string | null;
  brief: any | null;
  registration: any | null;
}): DraftStep[] {
  const inspection = params.inspection;
  const inspectionId = inspection ? String(inspection._id) : "";
  const matchHref = params.propertyId
    ? `/buyer/matches/${params.propertyId}?${new URLSearchParams({
        preferenceId: params.preferenceId,
        ...(params.matchedId ? { matchedId: params.matchedId } : {}),
      }).toString()}`
    : `/buyer/searches/${params.preferenceId}/matches`;

  if (!inspection) {
    return [
      {
        key: "inspection",
        title: "Inspection",
        detail: "Request an inspection for this property.",
        complete: false,
        action: { label: "Open this match", href: matchHref },
      },
      {
        key: "proceed",
        title: "Proceed decision",
        detail: "After the visit, decide whether to continue with this property.",
        complete: false,
      },
      {
        key: "diligence",
        title: "Due diligence",
        detail: "Engage a Khabiteq professional, or confirm you handled this yourself.",
        complete: false,
      },
      {
        key: "registration",
        title: "Transaction registration",
        detail: "Register the transaction after due diligence.",
        complete: false,
      },
      {
        key: "certificate",
        title: "Certificate",
        detail: "Download the certificate when it is issued.",
        complete: false,
      },
    ];
  }

  const status = String(inspection.status || "");
  const closed = ["cancelled", "agent_rejected", "transaction_failed"].includes(status);
  const wish = inspection.wishToProceed;
  const visitDone =
    status === "completed" ||
    wish === true ||
    wish === false ||
    Boolean(inspection.proceedToTransactionPromptSentAt) ||
    Boolean(inspection.buyerConfirmedInspectionAt);
  const path = inspection.dueDiligencePath;
  const brief = params.brief;
  const briefStatus = String(brief?.status || "");
  const diligenceDone =
    path === "independent" || (path === "platform" && BRIEF_PAID.has(briefStatus));
  const registration = params.registration;
  const regStatus = String(registration?.status || "");
  const certificateReady = Boolean(registration) && (CERTIFICATE_READY.has(regStatus) || Boolean(registration?.certificateUrl));

  const steps: DraftStep[] = [
    {
      key: "inspection",
      title: "Inspection",
      detail: inspectionDetail(status),
      complete: visitDone || closed,
      halt: closed,
      action: { label: "View inspection", href: `/buyer/inspections/${inspectionId}` },
    },
    {
      key: "proceed",
      title: "Proceed decision",
      detail:
        wish === false
          ? "You chose to keep searching."
          : wish === true
            ? "You chose to proceed with this property."
            : "Decide whether to continue with this property.",
      complete: wish === true || wish === false,
      halt: wish === false,
      action: { label: "Decide on this property", href: `/buyer/inspections/${inspectionId}` },
    },
    {
      key: "diligence",
      title: "Due diligence",
      detail:
        path === "independent"
          ? "You confirmed due diligence was handled outside Khabiteq."
          : brief
            ? briefDetail(briefStatus)
            : "Create a service brief so verified professionals can send offers.",
      complete: diligenceDone,
      action: brief
        ? { label: briefStatus === "awaiting-payment" ? "Pay this offer" : "Open this brief", href: `/buyer/service-requests/${brief._id}` }
        : { label: "Create a service brief", href: `/buyer/service-requests/new?inspectionId=${inspectionId}` },
    },
    {
      key: "registration",
      title: "Transaction registration",
      detail: registration ? registrationDetail(regStatus) : "Register this transaction after due diligence.",
      complete: Boolean(registration) && FEE_PAID.has(regStatus),
      action: registration
        ? { label: FEE_PAID.has(regStatus) ? "View registration" : "Complete the registration fee", href: "/my-transactions" }
        : { label: "Register this transaction", href: `/transaction-registration?inspectionId=${inspectionId}` },
    },
    {
      key: "certificate",
      title: "Certificate",
      detail: certificateReady
        ? "Your certificate is ready to download."
        : "The certificate appears here after the registration is issued.",
      complete: certificateReady,
      action: certificateReady
        ? { label: "Download certificate", href: "/transaction-registration?tab=certificate" }
        : undefined,
    },
  ];

  return steps;
}

export async function buildPreferenceJourney(buyerId: string, preferenceId: string) {
  if (!Types.ObjectId.isValid(preferenceId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Preference not found.");
  }
  const preference = await DB.Models.Preference.findOne({
    _id: preferenceId,
    buyer: buyerId,
  }).lean();
  if (!preference) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found.");
  }

  const match = await DB.Models.MatchedPreferenceProperty.findOne({ preference: preferenceId })
    .select("matchedProperties revealedCount")
    .lean();
  const matchedIds = (match?.matchedProperties || []).map((id) => String(id));
  const revealed = match ? effectiveRevealedCount(match) : 0;
  const visibleCount = revealed > 0 ? revealed : matchedIds.length;
  const allIds = matchedIds.slice(0, visibleCount);
  const propertyDocs = allIds.length
    ? await DB.Models.Property.find({ _id: { $in: allIds } })
        .select("location title propertyName")
        .lean()
    : [];
  const titleById = new Map(propertyDocs.map((row: any) => [String(row._id), propertyTitle(row)]));

  const inspections = await DB.Models.InspectionBooking.find({
    requestedBy: buyerId,
    $or: [
      { "meta.preferenceId": preferenceId },
      { "meta.requestSource.preferenceId": preferenceId },
    ],
  })
    .sort({ createdAt: -1 })
    .populate("propertyId", "location title propertyName propertyCode")
    .lean();

  const inspectionIds = inspections.map((row) => row._id);
  const propertyIds = inspections
    .map((row: any) => row.propertyId?._id || row.propertyId)
    .filter((id: unknown) => id && Types.ObjectId.isValid(String(id)));
  const propertyCodes = inspections
    .map((row: any) => String(row.propertyId?.propertyCode || "").trim())
    .filter(Boolean);
  const briefs = inspectionIds.length
    ? await DB.Models.ProfessionalServiceRequest.find({
        buyerId,
        inspectionId: { $in: inspectionIds },
      })
        .sort({ createdAt: -1 })
        .lean()
    : [];
  const registrationQuery: Record<string, unknown>[] = [];
  if (inspectionIds.length) registrationQuery.push({ inspectionId: { $in: inspectionIds } });
  if (propertyIds.length) registrationQuery.push({ propertyId: { $in: propertyIds } });
  if (propertyCodes.length) registrationQuery.push({ propertyCode: { $in: propertyCodes } });
  const registrations = registrationQuery.length
    ? await DB.Models.TransactionRegistration.find({ $or: registrationQuery })
        .sort({ createdAt: -1 })
        .select("inspectionId propertyId propertyCode status certificateUrl certificateNumber buyer.email")
        .lean()
    : [];

  const briefByInspection = new Map<string, any>();
  for (const brief of briefs) {
    const key = String(brief.inspectionId);
    if (!briefByInspection.has(key)) briefByInspection.set(key, brief);
  }
  const registrationForInspection = (inspection: any) => {
    const inspectionId = String(inspection._id);
    const propertyId = String(inspection.propertyId?._id || inspection.propertyId || "");
    const propertyCode = String(inspection.propertyId?.propertyCode || "").trim();
    return (
      registrations.find((row: any) => String(row.inspectionId || "") === inspectionId) ||
      registrations.find((row: any) => propertyId && String(row.propertyId || "") === propertyId) ||
      registrations.find((row: any) => propertyCode && String(row.propertyCode || "") === propertyCode) ||
      null
    );
  };

  const inspectedPropertyIds = new Set(
    inspections.map((row: any) => String(row.propertyId?._id || row.propertyId || ""))
  );

  const properties = inspections.map((inspection: any) => {
    const propertyId = String(inspection.propertyId?._id || inspection.propertyId || "");
    const title = propertyTitle(inspection.propertyId) || titleById.get(propertyId) || "Property";
    return {
      propertyId: propertyId || null,
      inspectionId: String(inspection._id),
      title,
      steps: applyStates(
        propertySteps({
          inspection,
          propertyId,
          preferenceId,
          matchedId: match ? String(match._id) : null,
          brief: briefByInspection.get(String(inspection._id)) || null,
          registration: registrationForInspection(inspection),
        })
      ),
    };
  });

  for (const propertyId of allIds) {
    if (inspectedPropertyIds.has(propertyId)) continue;
    properties.push({
      propertyId,
      inspectionId: null,
      title: titleById.get(propertyId) || "Property",
      steps: applyStates(
        propertySteps({
          inspection: null,
          propertyId,
          preferenceId,
          matchedId: match ? String(match._id) : null,
          brief: null,
          registration: null,
        })
      ),
    });
  }

  const hasMatches = allIds.length > 0;
  const steps = applyStates([
    {
      key: "preference",
      title: "Preference submitted",
      detail: preferenceTitle(preference),
      complete: true,
    },
    {
      key: "matches",
      title: "Matches",
      detail: hasMatches
        ? `${allIds.length} propert${allIds.length === 1 ? "y" : "ies"} matched this search.`
        : "Matches will appear here when a property fits this search.",
      complete: hasMatches,
      action: hasMatches
        ? { label: "Open matches", href: `/buyer/searches/${preferenceId}/matches` }
        : null,
    },
  ]);

  return {
    preference: {
      id: String(preference._id),
      title: preferenceTitle(preference),
      status: preference.status || "",
    },
    steps,
    properties,
  };
}
