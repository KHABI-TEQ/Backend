import { ITransactionRegistrationDoc } from "../models/transactionRegistration";
import { getClientBaseUrl } from "../utils/clientAppUrl";
import { certificateVerifyPath } from "./transactionReference.service";
import {
  maskDisplayName,
  registrationStatusLabel,
  transactionTypeLabel,
} from "./transactionJourney.service";

export const CERTIFICATE_TITLE = "KHABITEQ TRANSACTION REGISTRATION CERTIFICATE";
export const CERTIFICATE_SUBTITLE = "DIGITAL RECORD OF TRANSACTION JOURNEY";
export const CERTIFICATE_DISCLAIMER =
  "THIS CERTIFICATE RECORDS TRANSACTION ACTIVITIES AND INFORMATION CAPTURED THROUGH THE KHABITEQ PLATFORM. IT DOES NOT CONSTITUTE A CERTIFICATE OF TITLE, PROOF OF OWNERSHIP, LEGAL DUE DILIGENCE, SURVEY CERTIFICATION, PROPERTY VALUATION, INSURANCE COVERAGE OR REGULATORY APPROVAL. PROFESSIONAL SERVICES AND OPINIONS REMAIN THE RESPONSIBILITY OF THE RELEVANT PROFESSIONAL OR SERVICE PROVIDER.";

export function certificateVerifyUrl(reference: string): string {
  const base = getClientBaseUrl() || "https://khabiteq.com";
  return `${base.replace(/\/$/, "")}${certificateVerifyPath(reference)}`;
}

function formatDate(value?: Date | string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatLongDate(value?: Date | string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function toPublicCertificateView(reg: ITransactionRegistrationDoc) {
  const reference = String(reg.transactionReference || "").toUpperCase();
  const propertyCandidate = reg.propertyId && typeof reg.propertyId === "object"
    ? reg.propertyId as any
    : null;
  const listedProperty = propertyCandidate?.location || propertyCandidate?.propertyName || propertyCandidate?.title
    ? propertyCandidate
    : null;
  return {
    title: CERTIFICATE_TITLE,
    subtitle: CERTIFICATE_SUBTITLE,
    transactionReference: reference || null,
    propertyCode: reg.propertyCode || null,
    propertyType: reg.propertyTypeLabel || null,
    propertyLocation: reg.propertyLocationLabel || null,
    propertyDetails: listedProperty ? {
      title: listedProperty.title || listedProperty.propertyName || null,
      listingType: listedProperty.briefType || listedProperty.listingType || null,
      address: [listedProperty.location?.streetAddress, listedProperty.location?.area, listedProperty.location?.localGovernment, listedProperty.location?.state].filter(Boolean).join(", ") || null,
      bedrooms: listedProperty.additionalFeatures?.noOfBedroom ?? null,
      bathrooms: listedProperty.additionalFeatures?.noOfBathroom ?? null,
      parking: listedProperty.additionalFeatures?.noOfCarPark ?? null,
      landSize: listedProperty.landSize?.size ? `${listedProperty.landSize.size} ${listedProperty.landSize.measurementType || ""}`.trim() : null,
      listedAt: formatDate(listedProperty.createdAt),
      imageUrl: listedProperty.pictures?.[0] || null,
    } : null,
    transactionType: transactionTypeLabel(reg.transactionType),
    transactionStatus: registrationStatusLabel(reg.status),
    certificateStatus: reg.certificateStatus || null,
    certificateVersion: reg.certificateVersion || null,
    registrationDate: formatDate(reg.createdAt),
    issuedAt: formatDate(reg.certificateIssuedAt),
    lastUpdated: formatDate(reg.certificateLastUpdatedAt || reg.updatedAt),
    valid: ["ACTIVE", "UPDATED"].includes(String(reg.certificateStatus || "")),
    verifyUrl: reference ? certificateVerifyUrl(reference) : null,
    journey: (reg.journeyEvents || []).map((item, index) => ({
      step: String(index + 1).padStart(2, "0"),
      code: item.code,
      title: item.title,
      date: formatLongDate(item.occurredAt),
      notApplicable: Boolean(item.notApplicable),
    })),
    parties: (reg.parties || []).map((party) => ({
      role: party.role,
      displayName: maskDisplayName(party.displayName),
    })),
    participatingProfessionals: (reg.participatingProfessionals || []).map((pro) => ({
      name: pro.name,
      category: pro.category,
      licenceNumber: pro.licenceNumber || null,
      verificationStatus: pro.verificationStatus || null,
      practitionerPageUrl: pro.practitionerPageUrl || null,
    })),
    dueDiligence: (reg.dueDiligence || []).map((row) => ({
      category: row.category,
      label: row.label,
      professionalName: row.professionalName || null,
      engagedAt: formatLongDate(row.engagedAt),
      status: row.status,
    })),
    documentTrail: [
      ...(reg.paymentReceiptFileName || reg.paymentReceiptUrl ? [{ type: "Deal payment receipt", status: "Available" }] : []),
      ...(reg.deedsOfAssignmentFileName || reg.deedsOfAssignmentUrl ? [{ type: "Deed of Assignment", status: "Available" }] : []),
      ...(reg.conveyanceFileName || reg.conveyanceUrl ? [{ type: "Conveyance", status: "Available" }] : []),
    ],
    paymentRecord: [
      ...(reg.inspectionId ? [{
        description: "Inspection fee",
        reference: String(reg.inspectionId),
        status: reg.seekerJourney?.inspectionFeeStatus === "paid" ? "Completed" : reg.seekerJourney?.inspectionFeeStatus === "waived" ? "Waived" : "Not recorded",
        date: formatDate(reg.createdAt),
      }] : []),
      ...(reg.dueDiligence || []).filter((row) => row.status === "Completed").map((row) => ({
        description: `${row.label} fee`,
        reference: row.professionalName || row.category,
        status: "Completed",
        date: formatDate(row.engagedAt),
      })),
      ...(reg.paymentReceiptFileName || reg.paymentReceiptUrl ? [{
        description: "Transaction payment",
        reference: reference || null,
        amount: reg.transactionValue,
        status: "Receipt recorded",
        date: formatDate(reg.createdAt),
      }] : []),
      ...(reg.processingFee > 0 ? [{
        description: "Transaction registration processing fee",
        reference: reference || null,
        amount: reg.processingFee,
        status: reg.paymentTransactionId ? "Completed" : "Pending",
        date: formatDate(reg.createdAt),
      }] : []),
    ],
    seekerJourney: reg.seekerJourney ? {
      searchInsured: Boolean(reg.seekerJourney.searchInsured),
      policyReference: reg.seekerJourney.policyReference || null,
      dueDiligencePath: reg.seekerJourney.dueDiligencePath || null,
      dueDiligenceWithKhabiteqProfessionals: Boolean(reg.seekerJourney.dueDiligenceWithKhabiteqProfessionals),
      inspectionFeeStatus: reg.seekerJourney.inspectionFeeStatus || null,
    } : null,
    disclaimer: CERTIFICATE_DISCLAIMER,
  };
}

export function toAuthorizedCertificateView(reg: ITransactionRegistrationDoc) {
  const publicView = toPublicCertificateView(reg);
  return {
    ...publicView,
    registrationId: String(reg._id),
    certificateUrl: reg.certificateUrl || null,
    journey: (reg.journeyEvents || []).map((item, index) => ({
      step: String(index + 1).padStart(2, "0"),
      code: item.code,
      title: item.title,
      date: formatLongDate(item.occurredAt),
      notApplicable: Boolean(item.notApplicable),
    })),
    participatingProfessionals: (reg.participatingProfessionals || []).map((pro) => ({
      name: pro.name,
      category: pro.category,
      licenceNumber: pro.licenceNumber || null,
      verificationStatus: pro.verificationStatus || null,
      practitionerPageUrl: pro.practitionerPageUrl || null,
    })),
    parties: (reg.parties || []).map((party) => ({
      role: party.role,
      displayName: party.displayName,
    })),
    dueDiligence: (reg.dueDiligence || []).map((row) => ({
      category: row.category,
      label: row.label,
      professionalName: row.professionalName || null,
      engagedAt: formatLongDate(row.engagedAt),
      status: row.status,
    })),
    insurance: reg.insurance?.provider
      ? {
          provider: reg.insurance.provider,
          policyReference: reg.insurance.policyReference || null,
          status: reg.insurance.status || null,
          date: formatLongDate(reg.insurance.date),
          providedByInsurer: true,
        }
      : null,
    seekerJourney: (reg as any).seekerJourney
      ? {
          searchInsured: Boolean((reg as any).seekerJourney.searchInsured),
          policyReference: (reg as any).seekerJourney.policyReference || null,
          dueDiligencePath: (reg as any).seekerJourney.dueDiligencePath || null,
          dueDiligenceWithKhabiteqProfessionals: Boolean(
            (reg as any).seekerJourney.dueDiligenceWithKhabiteqProfessionals
          ),
          inspectionFeeStatus: (reg as any).seekerJourney.inspectionFeeStatus || null,
        }
      : null,
    versions: (reg.certificateVersions || []).map((version) => ({
      version: version.version,
      snapshotAt: formatLongDate(version.snapshotAt),
      reason: version.reason || null,
    })),
  };
}

export function toUnauthorizedPartyView(reg: ITransactionRegistrationDoc) {
  return {
    ...toPublicCertificateView(reg),
    parties: (reg.parties || []).map((party) => ({
      role: party.role,
      displayName: maskDisplayName(party.displayName),
    })),
  };
}
