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
  return {
    title: CERTIFICATE_TITLE,
    subtitle: CERTIFICATE_SUBTITLE,
    transactionReference: reference || null,
    propertyCode: reg.propertyCode || null,
    propertyType: reg.propertyTypeLabel || null,
    propertyLocation: reg.propertyLocationLabel || null,
    transactionType: transactionTypeLabel(reg.transactionType),
    transactionStatus: registrationStatusLabel(reg.status),
    certificateStatus: reg.certificateStatus || null,
    certificateVersion: reg.certificateVersion || null,
    registrationDate: formatDate(reg.createdAt),
    issuedAt: formatDate(reg.certificateIssuedAt),
    lastUpdated: formatDate(reg.certificateLastUpdatedAt || reg.updatedAt),
    valid: ["ACTIVE", "UPDATED"].includes(String(reg.certificateStatus || "")),
    verifyUrl: reference ? certificateVerifyUrl(reference) : null,
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
