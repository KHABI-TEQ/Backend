import { Types } from "mongoose";
import { DB } from "../controllers";
import { isPreferenceInsuredSearch, preferenceIdFromBooking } from "../utils/seekerJourney";
import { hasKhabiteqProfessionalEngagement } from "../utils/seekerTransactionGate";

export type InspectionFeeStatus = "waived" | "paid" | "none";

function feeStatus(booking: any): InspectionFeeStatus {
  if (booking?.isInsuredSearch) return "waived";
  if (booking?.status === "pending_transaction") return "none";
  if (booking?.transaction) return "paid";
  return "none";
}

export async function summarizePreferenceJourney(preference: any) {
  const preferenceId = String(preference._id);
  const insured = isPreferenceInsuredSearch(preference);
  const [match, policy, inspections] = await Promise.all([
    DB.Models.MatchedPreferenceProperty.findOne({ preference: preferenceId })
      .select("matchedProperties revealedCount")
      .lean(),
    DB.Models.SearchInsurancePolicy.findOne({ preference: preferenceId })
      .sort({ createdAt: -1 })
      .lean(),
    DB.Models.InspectionBooking.find({
      $or: [
        { "meta.preferenceId": preferenceId },
        { "meta.requestSource.preferenceId": preferenceId },
      ],
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const inspectionIds = inspections.map((row) => row._id);
  const registrations = inspectionIds.length
    ? await DB.Models.TransactionRegistration.find({
        inspectionId: { $in: inspectionIds },
      })
        .select("status transactionType inspectionId createdAt")
        .lean()
    : [];

  const ddPath = inspections.find((row) => row.dueDiligencePath)?.dueDiligencePath;
  const buyerId = String(preference.buyer?._id || preference.buyer || "");
  const khabiteqDd =
    ddPath === "platform" && buyerId
      ? (
          await Promise.all(
            inspections.map((row) =>
              hasKhabiteqProfessionalEngagement(buyerId, String(row._id))
            )
          )
        ).some(Boolean)
      : false;

  return {
    preferenceId,
    preferenceType: preference.preferenceType,
    status: preference.status,
    createdAt: preference.createdAt,
    contact: preference.contactInfo,
    location: preference.location,
    insured,
    policyReference: (policy as any)?.policyReference || preference.searchInsurance?.policyReference,
    policyStatus: (policy as any)?.status || preference.searchInsurance?.status,
    matchCount: Array.isArray(match?.matchedProperties) ? match.matchedProperties.length : 0,
    inspections: inspections.map((row) => ({
      id: String(row._id),
      status: row.status,
      isInsuredSearch: Boolean(row.isInsuredSearch),
      feeStatus: feeStatus(row),
      dueDiligencePath: row.dueDiligencePath || null,
      wishToProceed: row.wishToProceed,
      inspectionDate: row.inspectionDate,
      inspectionTime: row.inspectionTime,
    })),
    dueDiligencePath: ddPath || null,
    dueDiligenceWithKhabiteqProfessionals: khabiteqDd,
    registrations: registrations.map((row) => ({
      id: String(row._id),
      status: row.status,
      transactionType: row.transactionType,
      inspectionId: String(row.inspectionId || ""),
      createdAt: row.createdAt,
    })),
  };
}

export async function listSeekerJourneys(params: {
  page: number;
  limit: number;
  insured?: "yes" | "no";
  search?: string;
}) {
  const page = Math.max(params.page, 1);
  const limit = Math.min(Math.max(params.limit, 1), 50);
  const filter: Record<string, unknown> = {
    $or: [
      { "receiverMode.type": { $ne: "dealSite" } },
      { receiverMode: { $exists: false } },
    ],
  };
  if (params.insured === "yes") {
    filter["searchInsurance.status"] = { $in: ["active", "claimed"] };
  } else if (params.insured === "no") {
    filter["searchInsurance.status"] = { $nin: ["active", "claimed"] };
  }
  if (params.search?.trim()) {
    const q = params.search.trim();
    filter.$and = [
      {
        $or: [
          { "contactInfo.email": new RegExp(q, "i") },
          { "contactInfo.fullName": new RegExp(q, "i") },
          { "location.state": new RegExp(q, "i") },
        ],
      },
    ];
  }

  const [total, rows] = await Promise.all([
    DB.Models.Preference.countDocuments(filter),
    DB.Models.Preference.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const journeys = [];
  for (const pref of rows) {
    journeys.push(await summarizePreferenceJourney(pref));
  }

  return {
    journeys,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getSeekerJourneyByPreferenceId(preferenceId: string) {
  if (!Types.ObjectId.isValid(preferenceId)) return null;
  const preference = await DB.Models.Preference.findById(preferenceId).lean();
  if (!preference) return null;
  return summarizePreferenceJourney(preference);
}

export async function seekerJourneyFieldsFromInspection(inspection: any) {
  const preferenceId = preferenceIdFromBooking(inspection);
  let insured = Boolean(inspection?.isInsuredSearch);
  let policyReference: string | undefined;
  if (preferenceId) {
    const pref = await DB.Models.Preference.findById(preferenceId)
      .select("searchInsurance")
      .lean();
    insured = insured || isPreferenceInsuredSearch(pref);
    policyReference = (pref as any)?.searchInsurance?.policyReference;
    const policy = await DB.Models.SearchInsurancePolicy.findOne({
      preference: preferenceId,
    })
      .sort({ createdAt: -1 })
      .lean();
    if ((policy as any)?.policyReference) {
      policyReference = (policy as any).policyReference;
    }
  }
  const buyerId = String(inspection?.bookedBy || inspection?.requestedBy || "");
  const khabiteqDd =
    inspection?.dueDiligencePath === "platform" && buyerId
      ? await hasKhabiteqProfessionalEngagement(buyerId, String(inspection._id))
      : false;
  return {
    searchInsured: insured,
    policyReference,
    dueDiligencePath: inspection?.dueDiligencePath || null,
    dueDiligenceWithKhabiteqProfessionals: khabiteqDd,
    inspectionFeeStatus: feeStatus(inspection),
  };
}
