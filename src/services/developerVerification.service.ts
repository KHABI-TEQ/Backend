import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import type { DeveloperDimensionStatus } from "../common/kycTypes";
import {
  dimensionFromYouverify,
  isYouverifyConfigured,
  lookupNigerianCompany,
  verifyNigerianId,
  normalizeCacNumber,
} from "./youverify.service";

const DIMENSION_STATUSES: DeveloperDimensionStatus[] = [
  "none",
  "pending",
  "verified",
  "requires_attention",
];

export function uiStatus(status?: string | null) {
  if (status === "verified" || status === "approved") return "Verified";
  if (status === "requires_attention" || status === "rejected") return "Requires Attention";
  if (status === "pending" || status === "in_review") return "Pending";
  return "Pending";
}

export async function ensureDeveloperProfile(userId: string) {
  const user = await DB.Models.User.findById(userId).exec();
  if (!user || user.userType !== "Developer") {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "This action is for Developer accounts only.");
  }
  const profile = await DB.Models.PublisherProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $setOnInsert: {
        userId: user._id,
        userType: "Developer",
        kycStatus: "none",
      },
    },
    { upsert: true, new: true }
  );
  return { user, profile };
}

export function isDeveloperFullyVerified(profile: {
  practitionerType?: string;
  verification?: {
    company?: { status?: string };
    representative?: { status?: string };
    address?: { status?: string };
  };
}) {
  const isCompany = profile.practitionerType === "Company";
  const repOk = profile.verification?.representative?.status === "verified";
  const addressOk = profile.verification?.address?.status === "verified";
  const companyOk = !isCompany || profile.verification?.company?.status === "verified";
  return Boolean(repOk && addressOk && companyOk);
}

export function verificationPublicView(profile: any, user: any) {
  const isCompany = profile.practitionerType === "Company";
  const v = profile.verification || {};
  return {
    practitionerType: profile.practitionerType || "Individual",
    isCompany,
    isVerifiedDeveloper: isDeveloperFullyVerified(profile),
    company: isCompany
      ? {
          status: uiStatus(v.company?.status),
          rawStatus: v.company?.status || "none",
          legalName: v.company?.legalName || profile.companyDetails?.companyName,
          cacNumber: v.company?.cacNumber || profile.companyDetails?.cacNumber,
          companyType: v.company?.companyType,
          note: v.company?.note,
          retrieved: v.company?.youverify
            ? {
                legalName: v.company.legalName,
                status: v.company.youverify.status,
                retrievedFields: v.company.youverify.retrievedFields || [],
              }
            : null,
        }
      : null,
    individual: !isCompany
      ? { status: uiStatus(v.representative?.status), rawStatus: v.representative?.status || "none" }
      : null,
    representative: {
      label: isCompany ? "Authorized Representative" : "Identity",
      status: uiStatus(v.representative?.status),
      rawStatus: v.representative?.status || "none",
      fullName: v.representative?.fullName,
      position: v.representative?.position,
      note: v.representative?.note,
      retrieved: v.representative?.youverify
        ? {
            fullName: v.representative.fullName,
            status: v.representative.youverify.status,
          }
        : null,
    },
    address: {
      status: uiStatus(v.address?.status),
      rawStatus: v.address?.status || "none",
      homeNo: v.address?.homeNo || profile.address?.homeNo,
      street: v.address?.street || profile.address?.street,
      localGovtArea: v.address?.localGovtArea || profile.address?.localGovtArea,
      state: v.address?.state || profile.address?.state,
      note: v.address?.note,
    },
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      bio: profile.kycData?.profileBio,
      regionOfOperation: profile.regionOfOperation || [],
      companyName: profile.companyDetails?.companyName || v.company?.legalName,
      businessPhone: profile.businessPhone,
      businessEmail: profile.businessEmail,
    },
  };
}

export async function saveDeveloperProfile(
  userId: string,
  body: {
    practitionerType: "Individual" | "Company";
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    email?: string;
    profileBio?: string;
    regionOfOperation?: string[];
    companyName?: string;
    businessPhone?: string;
    businessEmail?: string;
    address?: { homeNo?: string; street?: string; localGovtArea?: string; state?: string };
  }
) {
  const { user, profile } = await ensureDeveloperProfile(userId);
  profile.practitionerType = body.practitionerType;
  if (body.profileBio != null) {
    profile.kycData = { ...(profile.kycData || {}), profileBio: body.profileBio };
  }
  if (Array.isArray(body.regionOfOperation)) {
    profile.regionOfOperation = body.regionOfOperation;
  }
  if (body.companyName) {
    profile.companyDetails = {
      ...(profile.companyDetails || {}),
      companyName: body.companyName,
    };
  }
  if (body.businessPhone != null) profile.businessPhone = body.businessPhone;
  if (body.businessEmail != null) profile.businessEmail = body.businessEmail;
  if (body.address) {
    profile.address = {
      homeNo: body.address.homeNo || "",
      street: body.address.street || "",
      state: body.address.state || "",
      localGovtArea: body.address.localGovtArea || "",
    };
  }
  await profile.save();

  if (body.firstName) user.firstName = body.firstName;
  if (body.lastName) user.lastName = body.lastName;
  if (body.phoneNumber) user.phoneNumber = body.phoneNumber;
  if (body.email) user.email = body.email;
  await user.save();

  return verificationPublicView(profile, user);
}

export async function lookupCompany(userId: string, cacNumber: string) {
  await ensureDeveloperProfile(userId);
  const lookup = await lookupNigerianCompany(cacNumber);
  return {
    configured: isYouverifyConfigured(),
    ...lookup,
    cacNumber: normalizeCacNumber(cacNumber),
  };
}

export async function saveCompanyVerification(
  userId: string,
  body: {
    legalName?: string;
    cacNumber: string;
    companyType?: "business_name" | "limited_liability" | "other";
    cacCertificateUrls?: string[];
    registeredAddress?: { homeNo?: string; street?: string; localGovtArea?: string; state?: string };
    confirmProviderData?: boolean;
  }
) {
  const { user, profile } = await ensureDeveloperProfile(userId);
  const cacNumber = normalizeCacNumber(body.cacNumber);
  let lookup = profile.verification?.company?.youverify
    ? null
    : await lookupNigerianCompany(cacNumber);

  const nextStatus = lookup
    ? dimensionFromYouverify(lookup)
    : body.confirmProviderData
      ? "verified"
      : "pending";

  profile.practitionerType = "Company";
  profile.companyDetails = {
    companyName: body.legalName || lookup?.legalName || profile.companyDetails?.companyName,
    cacNumber,
  };
  profile.verification = {
    ...(profile.verification || {}),
    company: {
      legalName: body.legalName || lookup?.legalName,
      cacNumber,
      companyType: body.companyType,
      cacCertificateUrls: body.cacCertificateUrls || [],
      registeredAddress: body.registeredAddress || lookup?.registeredAddress,
      youverify: lookup
        ? {
            status: lookup.status,
            retrievedAt: new Date(),
            retrievedFields: lookup.retrievedFields,
            raw: lookup.raw,
          }
        : profile.verification?.company?.youverify,
      status: nextStatus,
    },
  };
  if (body.registeredAddress) {
    profile.address = {
      homeNo: body.registeredAddress.homeNo || "",
      street: body.registeredAddress.street || "",
      localGovtArea: body.registeredAddress.localGovtArea || "",
      state: body.registeredAddress.state || "",
    };
    profile.verification.address = {
      ...(profile.verification.address || {}),
      ...body.registeredAddress,
      source: lookup?.found ? "kyb" : "manual",
      status: profile.verification.address?.status || "pending",
    };
  }
  await profile.save();
  return verificationPublicView(profile, user);
}

function mapIdType(idType: string): "nin" | "passport" | "drivers_license" {
  const t = String(idType || "").toLowerCase();
  if (t.includes("passport")) return "passport";
  if (t.includes("driver")) return "drivers_license";
  return "nin";
}

export async function saveRepresentativeVerification(
  userId: string,
  body: {
    fullName: string;
    position?: string;
    phone?: string;
    email?: string;
    idType: string;
    idNumber: string;
    idDocumentUrls?: string[];
    consent: boolean;
    runVerify?: boolean;
  }
) {
  if (!body.consent) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Consent is required to verify this identity with our verification provider."
    );
  }
  const { user, profile } = await ensureDeveloperProfile(userId);
  const parts = String(body.fullName || "").trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  let lookup = null as Awaited<ReturnType<typeof verifyNigerianId>> | null;
  if (body.runVerify !== false) {
    lookup = await verifyNigerianId({
      idType: mapIdType(body.idType),
      idNumber: body.idNumber,
      firstName,
      lastName,
    });
  }
  const status = lookup ? dimensionFromYouverify(lookup) : "pending";
  profile.verification = {
    ...(profile.verification || {}),
    representative: {
      fullName: lookup?.fullName || body.fullName,
      position: body.position,
      phone: body.phone,
      email: body.email,
      idType: body.idType,
      idNumber: body.idNumber,
      idDocumentUrls: body.idDocumentUrls || [],
      youverify: lookup
        ? {
            status: lookup.status,
            retrievedAt: new Date(),
            retrievedFields: lookup.retrievedFields,
            raw: lookup.raw,
          }
        : undefined,
      status,
    },
  };
  profile.meansOfId = [
    { name: body.idType, docImg: body.idDocumentUrls || [] },
  ];
  await profile.save();
  return { view: verificationPublicView(profile, user), lookup };
}

export async function saveAddressVerification(
  userId: string,
  body: {
    homeNo?: string;
    street: string;
    localGovtArea: string;
    state: string;
  }
) {
  const { user, profile } = await ensureDeveloperProfile(userId);
  profile.address = {
    homeNo: body.homeNo || "",
    street: body.street,
    localGovtArea: body.localGovtArea,
    state: body.state,
  };
  const existing = profile.verification?.address?.status;
  profile.verification = {
    ...(profile.verification || {}),
    address: {
      ...(profile.verification?.address || {}),
      homeNo: body.homeNo,
      street: body.street,
      localGovtArea: body.localGovtArea,
      state: body.state,
      source: profile.verification?.address?.source || "manual",
      status: existing === "verified" ? "verified" : "pending",
    },
  };
  await profile.save();
  return verificationPublicView(profile, user);
}

export async function submitDeveloperVerification(userId: string) {
  const { user, profile } = await ensureDeveloperProfile(userId);
  const isCompany = profile.practitionerType === "Company";
  const v = profile.verification || {};
  const markPending = (status?: string) =>
    !status || status === "none" ? "pending" : status;

  if (isCompany && v.company) {
    v.company.status = markPending(v.company.status) as DeveloperDimensionStatus;
  }
  if (v.representative) {
    v.representative.status = markPending(v.representative.status) as DeveloperDimensionStatus;
  }
  if (v.address) {
    v.address.status = markPending(v.address.status) as DeveloperDimensionStatus;
  }
  profile.verification = v;
  profile.kycStatus = isDeveloperFullyVerified(profile) ? "approved" : "pending";
  await profile.save();
  return verificationPublicView(profile, user);
}

export async function adminReviewDimension(
  userId: string,
  dimension: "company" | "representative" | "address",
  response: "approve" | "reject",
  note: string | undefined,
  adminId?: string
) {
  const { user, profile } = await ensureDeveloperProfile(userId);
  const v = profile.verification || {};
  const slot = v[dimension] || {};
  const approved = response === "approve";
  const next: DeveloperDimensionStatus = approved ? "verified" : "requires_attention";
  (v as any)[dimension] = {
    ...slot,
    status: next,
    note: note?.trim() || slot.note,
    reviewedAt: new Date(),
    reviewedBy: adminId ? new Types.ObjectId(adminId) : undefined,
  };
  profile.verification = v;
  if (isDeveloperFullyVerified(profile)) {
    profile.kycStatus = "approved";
    user.accountApproved = true;
    user.accountStatus = "active";
    await user.save();
  } else if (!approved) {
    profile.kycStatus = "rejected";
  }
  await profile.save();
  return verificationPublicView(profile, user);
}

export function isDimensionStatus(value: string): value is DeveloperDimensionStatus {
  return DIMENSION_STATUSES.includes(value as DeveloperDimensionStatus);
}
