import { Types } from "mongoose";
import { DB } from "../controllers";
import { dealSiteOriginFromPublicSlug } from "../config/dealSitePublicHost";
import type {
  ICertificateDueDiligence,
  ICertificateParty,
  ICertificateProfessional,
  ITransactionJourneyEvent,
  ITransactionRegistrationDoc,
  TransactionJourneyEventCode,
} from "../models/transactionRegistration";

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  rental_agreement: "Rent",
  outright_sale: "Sale",
  off_plan_purchase: "Off-plan purchase",
  joint_venture: "Joint venture",
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  sell: "Residential",
  rent: "Residential",
  shortlet: "Residential",
  jv: "Development",
  "off-plan": "Development",
  land: "Land",
  commercial: "Commercial",
};

function event(
  code: TransactionJourneyEventCode,
  title: string,
  occurredAt: Date | string | undefined,
  source: string
): ITransactionJourneyEvent | null {
  if (!occurredAt) return null;
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return null;
  return { code, title, occurredAt: date, source };
}

function locationLabel(property: any, ident: any): string {
  const parts = [
    property?.location?.streetAddress,
    property?.location?.area,
    property?.location?.estate,
    property?.location?.localGovernment,
    property?.location?.state,
    ident?.exactAddress,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return [...new Set(parts)].join(", ") || "As recorded on Khabiteq";
}

function propertyTypeLabel(property: any, transactionType: string): string {
  const raw = String(property?.propertyCategory || property?.typeOfBuilding || property?.propertyType || "")
    .trim()
    .toLowerCase();
  if (raw.includes("land")) return "Land";
  if (raw.includes("commercial")) return "Commercial";
  if (raw.includes("develop") || raw === "off-plan" || raw === "jv") return "Development";
  if (PROPERTY_TYPE_LABELS[raw]) return PROPERTY_TYPE_LABELS[raw];
  if (transactionType === "joint_venture" || transactionType === "off_plan_purchase") return "Development";
  return "Residential";
}

function partyRoleForType(transactionType: string): {
  buyerRole: ICertificateParty["role"];
  sellerRole: ICertificateParty["role"];
} {
  if (transactionType === "rental_agreement") {
    return { buyerRole: "tenant", sellerRole: "landlord" };
  }
  return { buyerRole: "buyer", sellerRole: "developer" };
}

export function transactionTypeLabel(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] || type;
}

export function registrationStatusLabel(status: string): string {
  if (status === "certificate_issued" || status === "completed") return "Registered";
  if (status === "rejected") return "Rejected";
  if (status === "submitted" || status === "pending_completion") return "Pending";
  return "Under review";
}

export async function snapshotTransactionCertificateRecord(
  reg: ITransactionRegistrationDoc
): Promise<{
  propertyCode?: string;
  propertyTypeLabel: string;
  propertyLocationLabel: string;
  journeyEvents: ITransactionJourneyEvent[];
  participatingProfessionals: ICertificateProfessional[];
  parties: ICertificateParty[];
  dueDiligence: ICertificateDueDiligence[];
}> {
  const property = reg.propertyId
    ? await DB.Models.Property.findById(reg.propertyId)
        .select("propertyCode propertyType propertyCategory typeOfBuilding location createdBy owner")
        .lean()
    : null;

  const propertyCode = String(reg.propertyCode || property?.propertyCode || "").trim().toUpperCase() || undefined;
  const ident = reg.propertyIdentification as { exactAddress?: string } | undefined;
  const buyerEmail = String(reg.buyer?.email || "").toLowerCase().trim();

  const buyer = buyerEmail
    ? await DB.Models.Buyer.findOne({ email: buyerEmail }).select("_id").lean()
    : null;

  const [inspection, preferences, documentJobs, surveyJobs, dealSite, owner] = await Promise.all([
    reg.inspectionId
      ? DB.Models.InspectionBooking.findById(reg.inspectionId).lean()
      : Promise.resolve(null),
    buyerEmail
      ? DB.Models.Preference.find({ "contactInfo.email": buyerEmail })
          .sort({ createdAt: 1 })
          .limit(8)
          .lean()
      : Promise.resolve([]),
    buyer?._id
      ? DB.Models.DocumentVerification.find({ buyerId: buyer._id })
          .sort({ createdAt: 1 })
          .limit(8)
          .lean()
      : Promise.resolve([]),
    buyer?._id
      ? DB.Models.SurveyRequest.find({ buyerId: buyer._id })
          .sort({ createdAt: 1 })
          .limit(8)
          .lean()
      : Promise.resolve([]),
    property?.createdBy
      ? DB.Models.DealSite.findOne({ createdBy: property.createdBy })
          .select("publicSlug title createdBy")
          .lean()
      : Promise.resolve(null),
    property?.createdBy
      ? DB.Models.User.findById(property.createdBy).select("firstName lastName userType").lean()
      : Promise.resolve(null),
  ]);

  const events: ITransactionJourneyEvent[] = [];
  const preferenceRows = Array.isArray(preferences) ? preferences : [];
  const firstPreference =
    (propertyCode
      ? preferenceRows.find(
          (row) => String((row as any).propertyCode || "").toUpperCase() === propertyCode
        )
      : null) || preferenceRows[0] || null;
  if (firstPreference) {
    const submitted = event(
      "PROPERTY_PREFERENCE_SUBMITTED",
      "Property Preference Submitted",
      (firstPreference as any).createdAt,
      "preference"
    );
    if (submitted) events.push(submitted);
    if ((firstPreference as any).status === "matched" || (firstPreference as any).matchedProperties?.length) {
      const matched = event(
        "PROPERTY_MATCHED",
        "Property Matched",
        (firstPreference as any).updatedAt || (firstPreference as any).createdAt,
        "preference"
      );
      if (matched) events.push(matched);
    }
  }

  if (propertyCode) {
    const identified = event(
      "PROPERTY_IDENTIFIED",
      "Property Identified",
      (property as any)?.createdAt || reg.createdAt,
      "property"
    );
    if (identified) events.push(identified);
  }

  if (reg.practitioner?.fullName || dealSite || owner) {
    const connected = event(
      "PROFESSIONAL_CONNECTED",
      "Professional Connected",
      (dealSite as any)?.createdAt || (inspection as any)?.createdAt || reg.createdAt,
      "professional"
    );
    if (connected) events.push(connected);
  }

  if (inspection) {
    const requested = event(
      "INSPECTION_REQUESTED",
      "Inspection Requested",
      (inspection as any).createdAt,
      "inspection"
    );
    if (requested) events.push(requested);

    if ((inspection as any).inspectionDate) {
      const scheduled = event(
        "INSPECTION_SCHEDULED",
        "Inspection Scheduled",
        (inspection as any).inspectionDate,
        "inspection"
      );
      if (scheduled) events.push(scheduled);
    }

    const completedAt =
      (inspection as any).inspectionReport?.inspectionCompletedAt ||
      ((inspection as any).status === "completed" || (inspection as any).stage === "completed"
        ? (inspection as any).updatedAt
        : undefined);
    if (completedAt) {
      const completed = event(
        "INSPECTION_COMPLETED",
        "Inspection Completed",
        completedAt,
        "inspection"
      );
      if (completed) events.push(completed);
    }
  }

  const firstDoc = Array.isArray(documentJobs) ? documentJobs[0] : null;
  const firstSurvey = Array.isArray(surveyJobs) ? surveyJobs[0] : null;
  if (firstDoc || firstSurvey) {
    const engaged = event(
      "DUE_DILIGENCE_PROFESSIONAL_ENGAGED",
      "Due Diligence Professional Engaged",
      (firstDoc as any)?.createdAt || (firstSurvey as any)?.createdAt,
      "due-diligence"
    );
    if (engaged) events.push(engaged);
  }

  const completedDoc = (documentJobs as any[])?.find((job) =>
    ["approved", "completed", "registered"].includes(String(job.status || ""))
  );
  const completedSurvey = (surveyJobs as any[])?.find((job) => job.status === "completed" || job.status === "approved");
  if (completedDoc || completedSurvey) {
    const done = event(
      "RELEVANT_PROFESSIONAL_SERVICE_COMPLETED",
      "Relevant Professional Service Completed",
      (completedDoc as any)?.updatedAt || (completedSurvey as any)?.updatedAt,
      "due-diligence"
    );
    if (done) events.push(done);
  }

  const proceeded = event(
    "TRANSACTION_PROCEEDED",
    "Transaction Proceeded",
    (inspection as any)?.updatedAt || reg.createdAt,
    "registration"
  );
  if (proceeded && (inspection || reg.status !== "submitted")) events.push(proceeded);

  const registered = event(
    "TRANSACTION_REGISTERED",
    "Transaction Registered",
    reg.createdAt,
    "registration"
  );
  if (registered) events.push(registered);

  if (reg.insurance?.provider && reg.insurance.date) {
    const insured = event(
      "INSURANCE_RECORDED",
      "Insurance Accessed / Policy Recorded",
      reg.insurance.date,
      "insurance"
    );
    if (insured) events.push(insured);
  }

  if (reg.certificateIssuedAt) {
    const issued = event(
      "CERTIFICATE_ISSUED",
      "Certificate Issued",
      reg.certificateIssuedAt,
      "certificate"
    );
    if (issued) events.push(issued);
  }

  events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const professionals: ICertificateProfessional[] = [];
  if (reg.practitioner?.fullName) {
    professionals.push({
      name: reg.practitioner.fullName,
      category: reg.offPlatformPartyType === "property_owner" ? "Property Owner" : "Real Estate Agent",
      licenceNumber: reg.practitioner.licenceNumber,
      verificationStatus: reg.practitioner.isOnPlatform ? "Recorded on Khabiteq" : "Off-platform participant",
      practitionerPageSlug: dealSite?.publicSlug,
      practitionerPageUrl: dealSite?.publicSlug
        ? dealSiteOriginFromPublicSlug(String(dealSite.publicSlug))
        : undefined,
    });
  } else if (owner) {
    const category =
      owner.userType === "Developer"
        ? "Developer"
        : owner.userType === "Lawyer"
          ? "Property Lawyer"
          : owner.userType === "Surveyor"
            ? "Licensed Surveyor"
            : owner.userType === "Valuer"
              ? "Valuer"
              : "Real Estate Agent";
    professionals.push({
      name: `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || "Recorded professional",
      category,
      verificationStatus: "Recorded on Khabiteq",
      practitionerPageSlug: dealSite?.publicSlug,
      practitionerPageUrl: dealSite?.publicSlug
        ? dealSiteOriginFromPublicSlug(String(dealSite.publicSlug))
        : undefined,
    });
  }

  const { buyerRole, sellerRole } = partyRoleForType(reg.transactionType);
  const parties: ICertificateParty[] = [];
  if (reg.buyer?.fullName) {
    parties.push({ role: buyerRole, displayName: reg.buyer.fullName });
  }
  const sellerName =
    reg.practitioner?.fullName ||
    (owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() : "");
  if (sellerName) {
    parties.push({
      role: owner?.userType === "Developer" ? "developer" : sellerRole,
      displayName: sellerName,
    });
  }

  const dueDiligence: ICertificateDueDiligence[] = [];
  if (firstDoc) {
    dueDiligence.push({
      category: "lawyer",
      label: "Property Lawyer",
      professionalName: (firstDoc as any).assignedLawyerName || (firstDoc as any).lawyerName,
      engagedAt: (firstDoc as any).createdAt,
      status: ["approved", "completed", "registered"].includes(String((firstDoc as any).status || ""))
        ? "Completed"
        : "Engaged",
    });
  }
  if (firstSurvey) {
    dueDiligence.push({
      category: "surveyor",
      label: "Licensed Surveyor",
      professionalName: (firstSurvey as any).assignedSurveyorName || (firstSurvey as any).surveyorName,
      engagedAt: (firstSurvey as any).createdAt,
      status: (firstSurvey as any).status === "completed" || (firstSurvey as any).status === "approved"
        ? "Completed"
        : "Engaged",
    });
  }

  return {
    propertyCode,
    propertyTypeLabel: propertyTypeLabel(property, reg.transactionType),
    propertyLocationLabel: locationLabel(property, ident),
    journeyEvents: events,
    participatingProfessionals: professionals,
    parties,
    dueDiligence,
  };
}

export async function applyCertificateSnapshot(
  reg: ITransactionRegistrationDoc
): Promise<ITransactionRegistrationDoc> {
  const snapshot = await snapshotTransactionCertificateRecord(reg);
  reg.propertyCode = snapshot.propertyCode;
  reg.propertyTypeLabel = snapshot.propertyTypeLabel;
  reg.propertyLocationLabel = snapshot.propertyLocationLabel;
  reg.journeyEvents = snapshot.journeyEvents;
  reg.participatingProfessionals = snapshot.participatingProfessionals;
  reg.parties = snapshot.parties;
  reg.dueDiligence = snapshot.dueDiligence;
  return reg;
}

export function maskDisplayName(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Recorded party";
  if (parts.length === 1) return `${parts[0].slice(0, 1).toUpperCase()}.`;
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1).toUpperCase()}.`;
}
