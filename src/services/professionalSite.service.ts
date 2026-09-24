import { Types } from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { dealSiteOriginFromPublicSlug } from "../config/dealSitePublicHost";
import {
  assertLawyerFeeInRange,
  assertSurveyorFeeInRange,
  getLawyerPlatformChargePercent,
  getSurveyorPlatformChargePercent,
} from "./professionalFee.service";
import { assertProfessionalPayoutReady } from "./professionalRequest.service";
import { PaystackService } from "./paystack.service";
import type {
  IProfessionalSiteDoc,
  ProfessionalSiteKind,
  ProfessionalSiteStatus,
} from "../models/professionalSite";

const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "cdn",
  "static",
  "support",
  "help",
  "status",
  "deal-site",
  "professional-site",
]);

export function normalizePublicSlug(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function suggestProfessionalSlug(parts: Array<string | undefined | null>): string {
  const base = normalizePublicSlug(parts.filter(Boolean).join("-"));
  return base || `pro-${Date.now().toString(36)}`;
}

export async function isPublicSlugGloballyAvailable(
  publicSlug: string,
  options?: { ignoreOwnerId?: string; ignoreProfessionalSiteId?: string }
): Promise<{ available: boolean; message: string }> {
  const slug = normalizePublicSlug(publicSlug);
  if (!slug || slug.length < 3) {
    return {
      available: false,
      message: "Slug must be at least 3 characters.",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { available: false, message: "This slug is reserved." };
  }

  const deal = await DB.Models.DealSite.findOne({ publicSlug: slug })
    .select("_id")
    .lean();
  if (deal) {
    return {
      available: false,
      message: "This slug is already taken. Please choose another.",
    };
  }

  const proQuery: Record<string, unknown> = {
    publicSlug: slug,
    status: { $ne: "deleted" },
  };
  if (options?.ignoreProfessionalSiteId) {
    proQuery._id = { $ne: options.ignoreProfessionalSiteId };
  } else if (options?.ignoreOwnerId) {
    proQuery.ownerId = { $ne: options.ignoreOwnerId };
  }

  const existing = await DB.Models.ProfessionalSite.findOne(proQuery)
    .select("_id ownerId")
    .lean();
  if (existing) {
    if (
      options?.ignoreOwnerId &&
      String(existing.ownerId) === String(options.ignoreOwnerId)
    ) {
      return { available: true, message: "This slug is available." };
    }
    return {
      available: false,
      message: "This slug is already taken. Please choose another.",
    };
  }

  return { available: true, message: "This slug is available." };
}

export async function provisionProfessionalSiteOnKycApprove(params: {
  kind: ProfessionalSiteKind;
  ownerId: string;
  firstName?: string;
  lastName?: string;
  firmName?: string;
  logoUrl?: string;
  about?: string;
}): Promise<IProfessionalSiteDoc> {
  const existing = await DB.Models.ProfessionalSite.findOne({
    ownerId: params.ownerId,
  });
  if (existing && existing.status !== "deleted") {
    return existing as IProfessionalSiteDoc;
  }

  const displayName =
    params.firmName?.trim() ||
    `${params.firstName || ""} ${params.lastName || ""}`.trim() ||
    (params.kind === "lawyer" ? "Lawyer" : "Surveyor");

  let slug = suggestProfessionalSlug([
    params.firmName,
    params.firstName,
    params.lastName,
  ]);
  let attempt = 0;
  while (attempt < 8) {
    const check = await isPublicSlugGloballyAvailable(slug);
    if (check.available) break;
    attempt += 1;
    slug = normalizePublicSlug(`${slug}-${attempt + 1}`);
  }

  if (existing && existing.status === "deleted") {
    existing.kind = params.kind;
    existing.publicSlug = slug;
    existing.status = "running";
    existing.title = displayName;
    existing.logoUrl = params.logoUrl || existing.logoUrl;
    existing.about = params.about || existing.about;
    existing.tagline =
      params.kind === "lawyer"
        ? "Document verification"
        : "Survey services";
    existing.ctaLabel =
      params.kind === "lawyer" ? "Verify a document" : "Request a survey";
    await existing.save();
    return existing as IProfessionalSiteDoc;
  }

  return (await DB.Models.ProfessionalSite.create({
    kind: params.kind,
    ownerId: params.ownerId,
    publicSlug: slug,
    status: "running",
    title: displayName,
    tagline:
      params.kind === "lawyer"
        ? "Document verification"
        : "Survey services",
    logoUrl: params.logoUrl,
    about: params.about,
    primaryColor: "#09391C",
    ctaLabel:
      params.kind === "lawyer" ? "Verify a document" : "Request a survey",
  })) as IProfessionalSiteDoc;
}

async function requireOwnerProfile(
  kind: ProfessionalSiteKind,
  ownerId: string
) {
  const user = await DB.Models.User.findById(ownerId);
  if (
    !user ||
    (kind === "lawyer" && user.userType !== "Lawyer") ||
    (kind === "surveyor" && user.userType !== "Surveyor")
  ) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      `${kind === "lawyer" ? "Lawyer" : "Surveyor"} account required.`
    );
  }

  const profile =
    kind === "lawyer"
      ? await DB.Models.LawyerProfile.findOne({ userId: ownerId })
      : await DB.Models.SurveyorProfile.findOne({ userId: ownerId });

  if (!profile) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Profile not found.");
  }

  return { user, profile };
}

export async function getOrCreateProfessionalSiteForOwner(
  kind: ProfessionalSiteKind,
  ownerId: string
): Promise<{
  site: IProfessionalSiteDoc;
  publicUrl: string;
  profile: any;
  user: any;
}> {
  const { user, profile } = await requireOwnerProfile(kind, ownerId);
  const existingSite = await DB.Models.ProfessionalSite.findOne({ ownerId });
  const site = (
    existingSite && existingSite.status !== "deleted"
      ? existingSite
      : await provisionProfessionalSiteOnKycApprove({
          kind,
          ownerId,
          firstName: user.firstName,
          lastName: user.lastName,
          firmName: profile.firmName,
          logoUrl: profile.profilePhoto || user.profile_picture,
          about: profile.bio,
        })
  ) as IProfessionalSiteDoc;
  return {
    site,
    publicUrl: dealSiteOriginFromPublicSlug(site.publicSlug),
    profile,
    user,
  };
}

export async function updateProfessionalSiteForOwner(params: {
  kind: ProfessionalSiteKind;
  ownerId: string;
  publicSlug?: string;
  status?: ProfessionalSiteStatus;
  title?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  about?: string;
  ctaLabel?: string;
  isMarketplaceVisible?: boolean;
}) {
  const { site, profile, user } = await getOrCreateProfessionalSiteForOwner(
    params.kind,
    params.ownerId
  );

  if (profile.kycStatus !== "approved") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "KYC must be approved before setting up your public page."
    );
  }

  // Slug: claim once; only set if empty/new or same owner updating before first claim locked.
  // Plan: one slug forever after claim — allow first claim, then lock unless admin.
  if (params.publicSlug !== undefined) {
    const nextSlug = normalizePublicSlug(params.publicSlug);
    if (!nextSlug) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid slug.");
    }
    if (site.publicSlug && site.publicSlug !== nextSlug) {
      // Allow rename only while still paused and never running (first-time setup)
      if (site.status === "running") {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Slug cannot be changed after your public page is live. Contact support to rename."
        );
      }
    }
    const availability = await isPublicSlugGloballyAvailable(nextSlug, {
      ignoreOwnerId: params.ownerId,
      ignoreProfessionalSiteId: String(site._id),
    });
    if (!availability.available) {
      throw new RouteError(HttpStatusCodes.CONFLICT, availability.message);
    }
    site.publicSlug = nextSlug;
  }

  if (params.title !== undefined) site.title = String(params.title).trim() || site.title;
  if (params.tagline !== undefined) site.tagline = String(params.tagline).trim();
  if (params.logoUrl !== undefined) site.logoUrl = String(params.logoUrl).trim();
  if (params.primaryColor !== undefined) {
    site.primaryColor = String(params.primaryColor).trim() || "#09391C";
  }
  if (params.about !== undefined) site.about = String(params.about).trim();
  if (params.ctaLabel !== undefined) site.ctaLabel = String(params.ctaLabel).trim();

  if (params.isMarketplaceVisible !== undefined) {
    profile.isMarketplaceVisible = Boolean(params.isMarketplaceVisible);
    await profile.save();
  }

  if (params.status !== undefined) {
    if (params.status === "deleted") {
      site.status = "deleted";
    } else if (params.status === "running") {
      assertProfessionalPayoutReady(profile);
      if (params.kind === "lawyer") {
        await assertLawyerFeeInRange(Number(profile.verificationFee));
      } else {
        await assertSurveyorFeeInRange(Number(profile.surveyFee));
      }
      site.status = "running";
    } else {
      site.status = "paused";
    }
  }

  await site.save();

  return {
    site,
    publicUrl: dealSiteOriginFromPublicSlug(site.publicSlug),
    profile,
    user,
  };
}

export async function getRunningProfessionalSiteBySlug(publicSlug: string) {
  const slug = normalizePublicSlug(publicSlug);
  const site = await DB.Models.ProfessionalSite.findOne({
    publicSlug: slug,
    status: "running",
  });
  if (!site) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      "Professional page not found."
    );
  }
  return site;
}

export async function buildPublicProfessionalCard(site: IProfessionalSiteDoc) {
  const user = await DB.Models.User.findById(site.ownerId).select(
    "firstName lastName profile_picture userType"
  );
  if (!user) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Owner not found.");
  }

  const { buildPublicPractitionerProfile } = await import("./publicPractitionerProfile.service");
  const publicProfile = await buildPublicPractitionerProfile({
    ownerId: site.ownerId,
    professionalKind: site.kind,
    site: {
      title: site.title,
      description: site.about || site.tagline,
      logoUrl: site.logoUrl,
      status: site.status,
      about: { whoWeAre: { description: site.about } },
    },
  });

  if (site.kind === "lawyer") {
    const profile = await DB.Models.LawyerProfile.findOne({
      userId: site.ownerId,
      kycStatus: "approved",
    });
    if (!profile) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Professional is not available."
      );
    }
    return {
      kind: "lawyer" as const,
      publicSlug: site.publicSlug,
      status: site.status,
      title: site.title,
      tagline: site.tagline,
      logoUrl: site.logoUrl || profile.profilePhoto || user.profile_picture,
      primaryColor: site.primaryColor || "#09391C",
      about: site.about || profile.bio,
      ctaLabel: site.ctaLabel || "Verify a document",
      firmName: profile.firmName,
      practiceAreas: profile.practiceAreas || [],
      fee: Number(profile.verificationFee || 0),
      displayName:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || site.title,
      photoUrl: profile.profilePhoto || user.profile_picture || site.logoUrl,
      publicProfile,
    };
  }

  const profile = await DB.Models.SurveyorProfile.findOne({
    userId: site.ownerId,
    kycStatus: "approved",
  });
  if (!profile) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Professional is not available."
    );
  }
  return {
    kind: "surveyor" as const,
    publicSlug: site.publicSlug,
    status: site.status,
    title: site.title,
    tagline: site.tagline,
    logoUrl: site.logoUrl || profile.profilePhoto || user.profile_picture,
    primaryColor: site.primaryColor || "#09391C",
    about: site.about || profile.bio,
    ctaLabel: site.ctaLabel || "Request a survey",
    firmName: profile.firmName,
    serviceTypes: profile.serviceTypes || ["plan-verification"],
    fee: Number(profile.surveyFee || 0),
    displayName:
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || site.title,
    photoUrl: profile.profilePhoto || user.profile_picture || site.logoUrl,
    publicProfile,
  };
}

function paymentCallbackBase(publicSlug: string): string {
  return (
    dealSiteOriginFromPublicSlug(publicSlug) ||
    process.env.CLIENT_LINK?.replace(/\/$/, "") ||
    "https://khabiteq.com"
  );
}

export async function submitPublicPageDocumentVerification(params: {
  publicSlug: string;
  contactInfo: {
    email: string;
    fullName?: string;
    phoneNumber?: string;
  };
  documentsMetadata: Array<{
    documentType: string;
    documentNumber?: string;
    uploadedUrl?: string;
  }>;
}) {
  const site = await getRunningProfessionalSiteBySlug(params.publicSlug);
  if (site.kind !== "lawyer") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This page belongs to a surveyor, not a lawyer."
    );
  }

  const { contactInfo, documentsMetadata } = params;
  if (
    !contactInfo?.email ||
    !Array.isArray(documentsMetadata) ||
    documentsMetadata.length === 0
  ) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Missing required fields (contactInfo, documents)."
    );
  }
  if (documentsMetadata.length > 2) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "You can only upload a maximum of 2 documents."
    );
  }

  const profile = await DB.Models.LawyerProfile.findOne({
    userId: site.ownerId,
    kycStatus: "approved",
  });
  if (!profile) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Lawyer is not available."
    );
  }
  assertProfessionalPayoutReady(profile);
  await assertLawyerFeeInRange(Number(profile.verificationFee));

  const buyer = await DB.Models.Buyer.findOneAndUpdate(
    { email: String(contactInfo.email).toLowerCase().trim() },
    {
      $set: {
        fullName: contactInfo.fullName || undefined,
        phoneNumber: contactInfo.phoneNumber || undefined,
      },
      $setOnInsert: {
        email: String(contactInfo.email).toLowerCase().trim(),
      },
    },
    { upsert: true, new: true }
  );

  const docCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const amount = Number(profile.verificationFee);
  const assignedLawyerId = new Types.ObjectId(String(site.ownerId));

  const createdDocs = await Promise.all(
    documentsMetadata.map((doc) => {
      const documentPayload: any = { documentType: doc.documentType };
      if (doc.documentNumber) documentPayload.documentNumber = doc.documentNumber;
      if (doc.uploadedUrl) documentPayload.documentUrl = doc.uploadedUrl;

      return DB.Models.DocumentVerification.create({
        buyerId: buyer._id,
        lawyerId: assignedLawyerId,
        docCode,
        amountPaid: amount,
        documents: documentPayload,
        docType: doc.documentType,
        status: "pending",
        source: "public-page",
      });
    })
  );

  const platformPct = await getLawyerPlatformChargePercent();
  const platformCharge = Math.round((amount * platformPct) / 100);
  const publicPageUrl = paymentCallbackBase(site.publicSlug);

  const paymentResponse = await PaystackService.initializeSplitPayment({
    subAccount: profile.paystackSubaccountCode!,
    publicPageUrl,
    amountCharge: platformCharge,
    email: String(contactInfo.email).toLowerCase().trim(),
    amount,
    fromWho: {
      kind: "Buyer",
      item: new Types.ObjectId(buyer._id as Types.ObjectId),
    },
    transactionType: "document-verification",
    metadata: {
      lawyerId: String(site.ownerId),
      docCode,
      documentVerificationId: String(createdDocs[0]._id),
      source: "public-page",
      publicSlug: site.publicSlug,
    },
  });

  const txId = new Types.ObjectId(String(paymentResponse.transactionId));
  await DB.Models.DocumentVerification.updateMany(
    { docCode, lawyerId: assignedLawyerId },
    { $set: { amountPaid: amount, transaction: txId } }
  );

  return {
    docs: createdDocs,
    docCode,
    payment: paymentResponse,
    amount,
  };
}

export async function submitPublicPageSurveyRequest(params: {
  publicSlug: string;
  contactInfo: {
    email: string;
    fullName?: string;
    phoneNumber?: string;
  };
  serviceType: "plan-verification" | "site-survey";
  propertyAddress?: string;
  surveyPlanUrl?: string;
  notes?: string;
}) {
  const site = await getRunningProfessionalSiteBySlug(params.publicSlug);
  if (site.kind !== "surveyor") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This page belongs to a lawyer, not a surveyor."
    );
  }

  const { contactInfo, serviceType } = params;
  if (!contactInfo?.email || !serviceType) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Missing required fields."
    );
  }
  if (!["plan-verification", "site-survey"].includes(serviceType)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid serviceType.");
  }

  const profile = await DB.Models.SurveyorProfile.findOne({
    userId: site.ownerId,
    kycStatus: "approved",
  });
  if (!profile) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Surveyor is not available."
    );
  }
  assertProfessionalPayoutReady(profile);
  await assertSurveyorFeeInRange(Number(profile.surveyFee));

  const buyer = await DB.Models.Buyer.findOneAndUpdate(
    { email: String(contactInfo.email).toLowerCase().trim() },
    {
      $set: {
        fullName: contactInfo.fullName || undefined,
        phoneNumber: contactInfo.phoneNumber || undefined,
      },
      $setOnInsert: {
        email: String(contactInfo.email).toLowerCase().trim(),
      },
    },
    { upsert: true, new: true }
  );

  const amount = Number(profile.surveyFee);
  const request = await DB.Models.SurveyRequest.create({
    buyerId: buyer._id,
    surveyorId: site.ownerId,
    serviceType,
    propertyAddress: params.propertyAddress,
    surveyPlanUrl: params.surveyPlanUrl,
    notes: params.notes,
    amountPaid: amount,
    status: "pending",
    source: "public-page",
  });

  const platformPct = await getSurveyorPlatformChargePercent();
  const platformCharge = Math.round((amount * platformPct) / 100);
  const publicPageUrl = paymentCallbackBase(site.publicSlug);

  const paymentResponse = await PaystackService.initializeSplitPayment({
    subAccount: profile.paystackSubaccountCode!,
    publicPageUrl,
    amountCharge: platformCharge,
    email: String(contactInfo.email).toLowerCase().trim(),
    amount,
    fromWho: {
      kind: "Buyer",
      item: new Types.ObjectId(buyer._id as Types.ObjectId),
    },
    transactionType: "survey-request",
    metadata: {
      surveyorId: String(site.ownerId),
      surveyRequestId: String(request._id),
      serviceType,
      source: "public-page",
      publicSlug: site.publicSlug,
    },
  });

  request.transaction = new Types.ObjectId(String(paymentResponse.transactionId));
  await request.save();

  return {
    request,
    requestCode: String(request._id).slice(-8).toUpperCase(),
    payment: paymentResponse,
    amount,
  };
}
