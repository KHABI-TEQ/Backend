import { Types } from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { SystemSettingService } from "./systemSetting.service";
import { PaystackService } from "./paystack.service";
import { notifyAllActiveAdmins } from "./adminNotification.service";
import notificationService from "./notification.service";
import sendEmail from "../common/send.email";
import { dealSiteOriginFromPublicSlug, getDealSiteRootHost } from "../config/dealSitePublicHost";
import type { CustomDomainSiteKind } from "../models/customDomainRequest";
import {
  SUBSCRIPTION_PLAN_CATEGORIES,
  SUBSCRIPTION_PLAN_CATEGORY_LABELS,
  isWhiteLabelingCategory,
} from "../common/constants/subscriptionCategories";
import { SubscriptionPlanService } from "./subscriptionPlan.service";
import { UserSubscriptionSnapshotService } from "./userSubscriptionSnapshot.service";
import { computePaidSubscriptionExpiresAt, resolveAgentSubscriptionBonusDays } from "./agentSubscriptionIncentive.service";
import { resolveCatalogAudienceForUser, assertUserCanPurchasePlanAudience } from "./subscriptionPlanAudience.service";
import { publisherHasUnlimitedListings } from "./publisherListingEligibility.service";
import { isUnlimitedListingPlanCode } from "../common/constants/publisherListingLimits";

const DEFAULT_GRACE_DAYS = 14;

export type CustomDomainStatus = "none" | "pending" | "live" | "disabled";

export function normalizeHostname(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/\.$/, "");
}

async function numSetting(key: string, fallback: number): Promise<number> {
  const setting = await SystemSettingService.getSetting(key);
  const n = Number(setting?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function getCustomDomainGraceDays(): Promise<number> {
  return numSetting("custom_domain_grace_days", DEFAULT_GRACE_DAYS);
}

function addCalendarDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

function flattenWhiteLabelingCatalog(plans: any[]) {
  const items: Record<string, unknown>[] = [];
  for (const plan of plans) {
    const enriched = SubscriptionPlanService.enrichPlanForCatalog(plan);
    items.push({
      planCode: plan.code,
      name: enriched.name,
      price: enriched.price,
      currency: enriched.currency || "NGN",
      durationInDays: enriched.durationInDays,
      billingInterval: enriched.billingInterval,
      billingIntervalLabel: enriched.billingIntervalLabel,
      benefits: enriched.benefits,
      category: enriched.category,
      categoryLabel: enriched.categoryLabel,
      grantsListingEligibility: true,
      grantsCustomDomain: true,
      audience: enriched.audience,
      audienceLabel: enriched.audienceLabel,
      bonusDays: resolveAgentSubscriptionBonusDays({
        planName: enriched.name,
        planCode: plan.code,
        durationInDays: enriched.durationInDays,
        category: enriched.category,
      }),
    });
    for (const dp of enriched.discountedPlans || []) {
      items.push({
        planCode: dp.code,
        name: dp.name,
        price: dp.price,
        currency: enriched.currency || "NGN",
        durationInDays: dp.durationInDays,
        billingInterval: dp.billingInterval,
        billingIntervalLabel: dp.billingIntervalLabel,
        benefits: dp.benefits,
        category: dp.category,
        categoryLabel: dp.categoryLabel,
        grantsListingEligibility: true,
        grantsCustomDomain: true,
        audience: dp.audience,
        audienceLabel: dp.audienceLabel,
        bonusDays: resolveAgentSubscriptionBonusDays({
          planName: dp.name ?? enriched.name,
          planCode: dp.code,
          durationInDays: dp.durationInDays,
          category: dp.category,
        }),
      });
    }
  }
  const rank: Record<string, number> = { quarterly: 0, yearly: 1 };
  items.sort(
    (a, b) =>
      (rank[String(a.billingInterval)] ?? 9) -
      (rank[String(b.billingInterval)] ?? 9)
  );
  return items;
}

export async function findOwnerSite(ownerId: string): Promise<{
  siteKind: CustomDomainSiteKind;
  site: any;
  publicSlug: string;
}> {
  const deal = await DB.Models.DealSite.findOne({
    createdBy: ownerId,
    status: { $ne: "deleted" },
  });
  if (deal) {
    return {
      siteKind: "deal-site",
      site: deal,
      publicSlug: deal.publicSlug,
    };
  }

  const pro = await DB.Models.ProfessionalSite.findOne({
    ownerId,
    status: { $ne: "deleted" },
  });
  if (pro) {
    return {
      siteKind: "professional-site",
      site: pro,
      publicSlug: pro.publicSlug,
    };
  }

  throw new RouteError(
    HttpStatusCodes.BAD_REQUEST,
    "Set up your public page before requesting a custom domain."
  );
}

export async function assertCustomDomainAvailable(
  hostname: string,
  ignoreSiteId?: string
): Promise<void> {
  const host = normalizeHostname(hostname);
  if (!host || host.length < 3 || !host.includes(".")) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Enter a valid domain (e.g. example.com)."
    );
  }

  const root = getDealSiteRootHost();
  if (host === root || host.endsWith(`.${root}`)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Use a domain you own outside khabiteq.com subdomains."
    );
  }

  const dealQ: Record<string, unknown> = { customDomain: host };
  const proQ: Record<string, unknown> = { customDomain: host };
  if (ignoreSiteId) {
    dealQ._id = { $ne: ignoreSiteId };
    proQ._id = { $ne: ignoreSiteId };
  }

  const [deal, pro] = await Promise.all([
    DB.Models.DealSite.findOne(dealQ).select("_id").lean(),
    DB.Models.ProfessionalSite.findOne(proQ).select("_id").lean(),
  ]);
  if (deal || pro) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      "That custom domain is already assigned."
    );
  }
}

async function loadWhiteLabelingCatalog(ownerId: string) {
  const audience = await resolveCatalogAudienceForUser(ownerId);
  const [whiteLabelPlans, activeWhiteLabelSub, graceDays, includedWithPortfolioUnlimited] =
    await Promise.all([
      SubscriptionPlanService.getAllActivePlans({
        category: SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING,
        audience,
      }),
      UserSubscriptionSnapshotService.getActiveSnapshot(ownerId, {
        category: "white-labeling",
      }),
      getCustomDomainGraceDays(),
      publisherHasUnlimitedListings(ownerId),
    ]);

  let includedSubscription: {
    id: string;
    status: string;
    expiresAt?: Date;
    planCode: string | null;
    autoRenew: boolean;
  } | null = null;

  if (includedWithPortfolioUnlimited && !activeWhiteLabelSub) {
    const snaps = await UserSubscriptionSnapshotService.getActiveSnapshots(ownerId);
    const pu = snaps.find((s) =>
      isUnlimitedListingPlanCode(String(s.meta?.planCode || ""))
    );
    if (pu) {
      includedSubscription = {
        id: String(pu._id),
        status: pu.status,
        expiresAt: pu.expiresAt,
        planCode: pu.meta?.planCode || null,
        autoRenew: !!pu.autoRenew,
      };
    }
  }

  return {
    plans: flattenWhiteLabelingCatalog(whiteLabelPlans),
    activeSubscription: activeWhiteLabelSub
      ? {
          id: String(activeWhiteLabelSub._id),
          status: activeWhiteLabelSub.status,
          expiresAt: activeWhiteLabelSub.expiresAt,
          planCode: activeWhiteLabelSub.meta?.planCode || null,
          autoRenew: !!activeWhiteLabelSub.autoRenew,
        }
      : includedSubscription,
    includedWithPortfolioUnlimited,
    graceDays,
    category: {
      key: SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING,
      label:
        SUBSCRIPTION_PLAN_CATEGORY_LABELS[
          SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING
        ],
    },
  };
}

export async function getOrCreateCustomDomainRequest(ownerId: string, body?: {
  preferredNames?: string[];
  contactEmail?: string;
  notes?: string;
}) {
  const user = await DB.Models.User.findById(ownerId);
  if (!user) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found.");
  }

  const catalog = await loadWhiteLabelingCatalog(ownerId);
  const mutating = Boolean(body);

  let ownerSite: Awaited<ReturnType<typeof findOwnerSite>> | null = null;
  try {
    ownerSite = await findOwnerSite(ownerId);
  } catch (err) {
    if (mutating) throw err;
    return {
      request: null,
      site: null,
      needsPublicPage: true,
      needsKyc: false,
      ...catalog,
    };
  }

  const { siteKind, site, publicSlug } = ownerSite;
  if (siteKind === "professional-site") {
    const profile =
      site.kind === "lawyer"
        ? await DB.Models.LawyerProfile.findOne({ userId: ownerId })
        : await DB.Models.SurveyorProfile.findOne({ userId: ownerId });
    if (profile?.kycStatus !== "approved") {
      if (mutating) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "KYC must be approved before requesting a custom domain."
        );
      }
      return {
        request: null,
        site: {
          id: String(site._id),
          siteKind,
          publicSlug,
          publicUrl: dealSiteOriginFromPublicSlug(publicSlug),
          customDomain: site.customDomain || null,
          customDomainStatus: site.customDomainStatus || "none",
          customDomainExpiresAt: site.customDomainExpiresAt || null,
          customDomainGraceEndsAt: site.customDomainGraceEndsAt || null,
          status: site.status,
        },
        needsPublicPage: false,
        needsKyc: true,
        ...catalog,
      };
    }
  }

  let request = await DB.Models.CustomDomainRequest.findOne({
    ownerId,
    siteId: site._id,
    status: { $nin: ["rejected", "cancelled"] },
  }).sort({ updatedAt: -1 });

  if (!request) {
    const names = (body?.preferredNames || [])
      .map((n) => normalizeHostname(n))
      .filter(Boolean);
    request = await DB.Models.CustomDomainRequest.create({
      ownerId,
      siteKind,
      siteId: site._id,
      preferredNames: names,
      contactEmail:
        String(body?.contactEmail || user.email || "")
          .toLowerCase()
          .trim() || user.email,
      notes: body?.notes,
      amount: Number(catalog.plans[0]?.price) || 0,
      status: "draft",
    });
  } else if (body) {
    if (Array.isArray(body.preferredNames)) {
      request.preferredNames = body.preferredNames
        .map((n) => normalizeHostname(n))
        .filter(Boolean);
    }
    if (body.contactEmail) {
      request.contactEmail = String(body.contactEmail).toLowerCase().trim();
    }
    if (body.notes !== undefined) request.notes = String(body.notes || "").trim();
    await request.save();
  }

  return {
    request,
    site: {
      id: String(site._id),
      siteKind,
      publicSlug,
      publicUrl: dealSiteOriginFromPublicSlug(publicSlug),
      customDomain: site.customDomain || null,
      customDomainStatus: site.customDomainStatus || "none",
      customDomainExpiresAt: site.customDomainExpiresAt || null,
      customDomainGraceEndsAt: site.customDomainGraceEndsAt || null,
      status: site.status,
    },
    needsPublicPage: false,
    needsKyc: false,
    ...catalog,
  };
}

export async function submitCustomDomainIncludedWithPortfolioUnlimited(
  ownerId: string,
  body: {
    preferredNames?: string[];
    contactEmail?: string;
    notes?: string;
  }
) {
  const included = await publisherHasUnlimitedListings(ownerId);
  if (!included) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Custom domain / white-labeling is included with an active Portfolio Unlimited plan. Subscribe first, then submit your preferred domain."
    );
  }

  const names = (body?.preferredNames || [])
    .map((n) => normalizeHostname(n))
    .filter(Boolean);
  if (!names.length) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Add at least one preferred domain name."
    );
  }

  const payload = await getOrCreateCustomDomainRequest(ownerId, {
    preferredNames: names,
    contactEmail: body.contactEmail,
    notes: body.notes,
  });

  if (payload.needsPublicPage || !payload.request || !payload.site) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Set up your public page before requesting a custom domain."
    );
  }
  if (payload.needsKyc) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "KYC must be approved before requesting a custom domain."
    );
  }

  const request = payload.request;
  if (["live", "forwarded-to-tech", "paid"].includes(request.status)) {
    return payload;
  }

  const snaps = await UserSubscriptionSnapshotService.getActiveSnapshots(ownerId);
  const pu = snaps.find((s) =>
    isUnlimitedListingPlanCode(String(s.meta?.planCode || ""))
  );

  request.amount = 0;
  request.planCode = pu?.meta?.planCode || request.planCode;
  request.billingInterval = pu?.meta?.billingInterval || request.billingInterval;
  if (pu?._id) request.subscriptionSnapshot = pu._id as Types.ObjectId;
  request.status = "paid";
  await request.save();

  const siteDoc =
    payload.site.siteKind === "deal-site"
      ? await DB.Models.DealSite.findById(payload.site.id)
      : await DB.Models.ProfessionalSite.findById(payload.site.id);
  if (siteDoc) {
    siteDoc.customDomainStatus = "pending";
    await siteDoc.save();
  }

  void notifyAllActiveAdmins({
    type: "custom_domain_package_paid",
    title: "Custom domain included with Portfolio Unlimited",
    message: `Portfolio Unlimited subscriber submitted preferred domain (${names.join(", ")}). Forward to tech — no extra white-labeling charge.`,
    meta: {
      customDomainRequestId: String(request._id),
      ownerId,
      siteKind: payload.site.siteKind,
      preferredNames: names,
      includedWithPortfolioUnlimited: true,
      planCode: request.planCode,
    },
  });

  return getOrCreateCustomDomainRequest(ownerId);
}

export async function prepareCustomDomainRequestForUnlimitedCheckout(
  ownerId: string
) {
  const payload = await getOrCreateCustomDomainRequest(ownerId);
  if (payload.needsPublicPage || !payload.request || !payload.site) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Set up your public page and save at least one preferred domain name before subscribing to Portfolio Unlimited."
    );
  }
  if (payload.needsKyc) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "KYC must be approved before requesting a custom domain."
    );
  }
  if (["live", "forwarded-to-tech", "paid"].includes(payload.request.status)) {
    return payload;
  }
  if (!payload.request.preferredNames?.length) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Save at least one preferred domain name and a contact email before subscribing to Portfolio Unlimited."
    );
  }
  return payload;
}

export async function linkCustomDomainRequestToUnlimitedCheckout(
  ownerId: string,
  opts: {
    snapshotId: string;
    transactionId: string;
    planCode: string;
  }
) {
  const payload = await prepareCustomDomainRequestForUnlimitedCheckout(ownerId);
  const request = payload.request;
  if (!request) return payload;
  if (!["live", "forwarded-to-tech", "paid"].includes(request.status)) {
    request.status = "awaiting-payment";
    request.planCode = opts.planCode;
    request.amount = 0;
    request.subscriptionSnapshot = new Types.ObjectId(opts.snapshotId);
    request.transaction = new Types.ObjectId(opts.transactionId);
    await request.save();
  }

  if (payload.site?.id) {
    await DB.Models.UserSubscriptionSnapshot.findByIdAndUpdate(opts.snapshotId, {
      $set: {
        "meta.customDomainRequestId": String(request._id),
        "meta.includedWithPortfolioUnlimited": true,
        "meta.siteId": payload.site.id,
        "meta.siteKind": payload.site.siteKind,
      },
    });
  }
  return { ...payload, request };
}

export async function initializeCustomDomainPackagePayment(
  ownerId: string,
  opts: { planCode: string; autoRenewal?: boolean }
) {
  return initializeCustomDomainSubscriptionPayment(ownerId, "package", opts);
}

export async function initializeCustomDomainRenewalPayment(
  ownerId: string,
  opts: { planCode: string; autoRenewal?: boolean }
) {
  return initializeCustomDomainSubscriptionPayment(ownerId, "renewal", opts);
}

async function initializeCustomDomainSubscriptionPayment(
  ownerId: string,
  mode: "package" | "renewal",
  opts: { planCode: string; autoRenewal?: boolean }
) {
  const planCode = String(opts?.planCode || "").trim();
  if (!planCode) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Choose a quarterly or yearly Custom Domain / White Labeling plan."
    );
  }

  let resolved;
  try {
    resolved = await SubscriptionPlanService.resolveActivePlanByCode(planCode);
  } catch (err: any) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      err?.message || "Subscription plan not found"
    );
  }

  if (!isWhiteLabelingCategory(resolved.category)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "That plan is not a Custom Domain / White Labeling subscription."
    );
  }

  await assertUserCanPurchasePlanAudience({
    userId: String(ownerId),
    planAudience: (resolved.plan as any).audience,
    planCode: resolved.planCode,
  });

  const payload = await getOrCreateCustomDomainRequest(ownerId);
  if (payload.needsPublicPage || !payload.request || !payload.site) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Set up your public page before requesting a custom domain."
    );
  }
  if (payload.needsKyc) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "KYC must be approved before requesting a custom domain."
    );
  }
  const { request, site } = payload;

  if (mode === "package") {
    if (["live", "forwarded-to-tech", "paid"].includes(request.status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This custom domain request is already paid or in progress. Use renewal for an existing domain."
      );
    }
    if (!request.preferredNames?.length) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Add at least one preferred domain name before paying."
      );
    }
  } else {
    const status = site.customDomainStatus || "none";
    if (!site.customDomain || !["live", "disabled"].includes(status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "No custom domain is ready for renewal."
      );
    }
  }

  const user = await DB.Models.User.findById(ownerId);
  const email = String(request.contactEmail || user?.email || "")
    .toLowerCase()
    .trim();
  if (!email) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Contact email is required.");
  }

  const publicPageUrl =
    process.env.CLIENT_LINK?.replace(/\/$/, "") || "https://khabiteq.com";

  const startDate = new Date();
  let expiryStart = startDate;
  if (mode === "renewal" && site.customDomainExpiresAt) {
    const currentExpiry = new Date(site.customDomainExpiresAt);
    if (currentExpiry > startDate) expiryStart = currentExpiry;
  }
  const { expiresAt: endDate } = computePaidSubscriptionExpiresAt({
    startDate: expiryStart,
    baseDurationInDays: resolved.durationInDays,
    planName: resolved.appliedPlanName,
    planCode: resolved.planCode,
    category: resolved.category,
  });

  const payment = await PaystackService.initializePayment({
    email,
    amount: resolved.price,
    fromWho: {
      kind: "User",
      item: new Types.ObjectId(ownerId),
    },
    transactionType: "subscription",
    metadata: {
      category: SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING,
      customDomainRequestId: String(request._id),
      siteKind: site.siteKind,
      siteId: site.id,
      ownerId,
      planCode: resolved.planCode,
      planType: resolved.planType,
      isRenewal: mode === "renewal",
      customDomain: site.customDomain || null,
      durationInDays: resolved.durationInDays,
    },
    callbackUrl: `${publicPageUrl}/payment-verification`,
  });

  const snapshot = await UserSubscriptionSnapshotService.createSnapshot({
    user: ownerId,
    plan: String(resolved.plan._id),
    transaction: payment.transactionId as string,
    status: "pending",
    expiresAt: endDate,
    autoRenew: opts.autoRenewal ?? false,
    meta: {
      planType: resolved.planType,
      planCode: resolved.planCode,
      appliedPlanName: resolved.appliedPlanName,
      durationInDays: resolved.durationInDays,
      category: SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING,
      customDomainRequestId: String(request._id),
      siteKind: site.siteKind,
      siteId: site.id,
      isRenewal: mode === "renewal",
      customDomain: site.customDomain || null,
      billingInterval: resolved.billingInterval,
    },
  });

  request.amount = resolved.price;
  request.planCode = resolved.planCode;
  request.billingInterval = resolved.billingInterval || undefined;
  request.subscriptionSnapshot = snapshot._id as Types.ObjectId;
  request.transaction = new Types.ObjectId(String(payment.transactionId));
  if (mode === "package") {
    request.status = "awaiting-payment";
  }
  await request.save();

  if (mode === "package") {
    const siteDoc =
      site.siteKind === "deal-site"
        ? await DB.Models.DealSite.findById(site.id)
        : await DB.Models.ProfessionalSite.findById(site.id);
    if (siteDoc) {
      siteDoc.customDomainStatus = "pending";
      await siteDoc.save();
    }
  }

  return {
    request,
    payment,
    amount: resolved.price,
    customDomain: site.customDomain || null,
    subscription: {
      subscriptionId: snapshot._id,
      planName: resolved.appliedPlanName,
      planCode: resolved.planCode,
      category: resolved.category,
      billingInterval: resolved.billingInterval,
      benefits: resolved.benefits,
      expiresAt: endDate,
      autoRenew: opts.autoRenewal ?? false,
    },
  };
}

export async function syncCustomDomainExpiryFromSubscription(snapshot: {
  expiresAt?: Date;
  meta?: Record<string, any>;
}) {
  const includedWithPortfolioUnlimited =
    !!snapshot.meta?.includedWithPortfolioUnlimited ||
    isUnlimitedListingPlanCode(snapshot.meta?.planCode);
  if (
    !isWhiteLabelingCategory(snapshot.meta?.category) &&
    !includedWithPortfolioUnlimited
  ) {
    return null;
  }
  const siteId = snapshot.meta?.siteId;
  const siteKind = snapshot.meta?.siteKind as CustomDomainSiteKind | undefined;
  const expiresAt = snapshot.expiresAt ? new Date(snapshot.expiresAt) : null;
  if (!siteId || !siteKind || !expiresAt || Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  const site =
    siteKind === "deal-site"
      ? await DB.Models.DealSite.findById(siteId)
      : await DB.Models.ProfessionalSite.findById(siteId);
  if (!site?.customDomain) return null;

  site.customDomainStatus = "live";
  site.customDomainExpiresAt = expiresAt;
  site.customDomainGraceEndsAt = undefined;
  site.customDomainLastRenewedAt = new Date();
  await site.save();
  return site;
}

export async function handleCustomDomainPackagePaid(tx: {
  _id: any;
  amount?: number;
  meta?: Record<string, any>;
  reference?: string;
}) {
  const requestId = tx.meta?.customDomainRequestId;
  if (!requestId) return null;

  const request = await DB.Models.CustomDomainRequest.findById(requestId);
  if (!request) return null;

  if (["live", "forwarded-to-tech", "paid"].includes(request.status)) {
    return request;
  }

  request.status = "paid";
  request.transaction = tx._id;
  await request.save();

  const site =
    request.siteKind === "deal-site"
      ? await DB.Models.DealSite.findById(request.siteId)
      : await DB.Models.ProfessionalSite.findById(request.siteId);
  if (site) {
    site.customDomainStatus = "pending";
    await site.save();
  }

  void notifyAllActiveAdmins({
    type: "custom_domain_package_paid",
    title: "Custom domain package paid",
    message: `₦${Number(tx.amount || 0).toLocaleString()} paid for custom domain (${request.preferredNames?.join(", ") || "n/a"}). Forward to tech.`,
    meta: {
      customDomainRequestId: String(request._id),
      ownerId: String(request.ownerId),
      siteKind: request.siteKind,
      preferredNames: request.preferredNames,
      transactionId: String(tx._id),
      amount: tx.amount,
    },
  });

  return request;
}

export async function handleCustomDomainRenewalPaid(tx: {
  _id: any;
  amount?: number;
  meta?: Record<string, any>;
}, options?: { expiresAt?: Date; durationInDays?: number }) {
  const siteId = tx.meta?.siteId;
  const siteKind = tx.meta?.siteKind as CustomDomainSiteKind | undefined;
  if (!siteId || !siteKind) return null;

  const site =
    siteKind === "deal-site"
      ? await DB.Models.DealSite.findById(siteId)
      : await DB.Models.ProfessionalSite.findById(siteId);
  if (!site?.customDomain) return null;

  const now = new Date();
  let next: Date;
  if (options?.expiresAt && !Number.isNaN(options.expiresAt.getTime())) {
    next = new Date(options.expiresAt);
  } else {
    const base =
      site.customDomainExpiresAt && site.customDomainExpiresAt > now
        ? new Date(site.customDomainExpiresAt)
        : now;
    const days = Number(options?.durationInDays || tx.meta?.durationInDays);
    if (Number.isFinite(days) && days > 0) {
      next = addCalendarDays(base, days);
    } else {
      next = new Date(base);
      next.setFullYear(next.getFullYear() + 1);
    }
  }

  site.customDomainStatus = "live";
  site.customDomainExpiresAt = next;
  site.customDomainGraceEndsAt = undefined;
  site.customDomainLastRenewedAt = now;
  await site.save();

  const request = await DB.Models.CustomDomainRequest.findOne({
    siteId: site._id,
    status: { $in: ["live", "forwarded-to-tech", "paid"] },
  }).sort({ updatedAt: -1 });
  if (request && request.status !== "live") {
    request.status = "live";
    await request.save();
  }

  void notifyAllActiveAdmins({
    type: "custom_domain_renewal_paid",
    title: "Custom domain renewal paid",
    message: `Renewal paid for ${site.customDomain}. Keep Namecheap auto-renew on. New expiry: ${next.toISOString().slice(0, 10)}.`,
    meta: {
      siteId: String(site._id),
      siteKind,
      customDomain: site.customDomain,
      expiresAt: next.toISOString(),
      amount: tx.amount,
    },
  });

  return site;
}

export async function forwardCustomDomainRequest(
  requestId: string,
  adminNote?: string
) {
  const request = await DB.Models.CustomDomainRequest.findById(requestId);
  if (!request) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Request not found.");
  }
  if (request.status !== "paid" && request.status !== "forwarded-to-tech") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Only paid requests can be forwarded to tech."
    );
  }
  request.status = "forwarded-to-tech";
  if (adminNote?.trim()) request.adminNote = adminNote.trim();
  await request.save();

  const techEmail = process.env.TECH_TEAM_EMAIL?.trim();
  if (techEmail) {
    void sendEmail({
      to: techEmail,
      subject: `Custom domain request – ${request.preferredNames?.join(", ")}`,
      text: [
        `Request ID: ${request._id}`,
        `Owner: ${request.ownerId}`,
        `Site kind: ${request.siteKind}`,
        `Preferred: ${(request.preferredNames || []).join(", ")}`,
        `Contact: ${request.contactEmail}`,
        `Notes: ${request.notes || "-"}`,
        `Admin note: ${request.adminNote || "-"}`,
      ].join("\n"),
      skipBuyerInbox: true,
    });
  }

  return request;
}

export async function markCustomDomainLive(params: {
  requestId: string;
  customDomain: string;
  expiresAt?: string | Date;
  techNote?: string;
}) {
  const request = await DB.Models.CustomDomainRequest.findById(params.requestId);
  if (!request) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Request not found.");
  }
  if (!["paid", "forwarded-to-tech", "live"].includes(request.status)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Request must be paid or forwarded before going live."
    );
  }

  const host = normalizeHostname(params.customDomain);
  await assertCustomDomainAvailable(host, String(request.siteId));

  const site =
    request.siteKind === "deal-site"
      ? await DB.Models.DealSite.findById(request.siteId)
      : await DB.Models.ProfessionalSite.findById(request.siteId);
  if (!site) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Site not found.");
  }

  let expiresAt: Date;
  if (params.expiresAt) {
    expiresAt = new Date(params.expiresAt);
  } else if (request.subscriptionSnapshot) {
    const snapshot = await DB.Models.UserSubscriptionSnapshot.findById(
      request.subscriptionSnapshot
    )
      .select("expiresAt")
      .lean();
    expiresAt = snapshot?.expiresAt
      ? new Date(snapshot.expiresAt)
      : addCalendarDays(new Date(), 365);
  } else {
    expiresAt = addCalendarDays(new Date(), 365);
  }
  if (Number.isNaN(expiresAt.getTime())) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid expiresAt.");
  }

  site.customDomain = host;
  site.customDomainStatus = "live";
  site.customDomainExpiresAt = expiresAt;
  site.customDomainGraceEndsAt = undefined;
  site.customDomainLastRenewedAt = new Date();
  await site.save();

  request.status = "live";
  request.assignedCustomDomain = host;
  if (params.techNote?.trim()) request.techNote = params.techNote.trim();
  await request.save();

  return { request, site };
}

export async function rejectCustomDomainRequest(
  requestId: string,
  adminNote?: string
) {
  const request = await DB.Models.CustomDomainRequest.findById(requestId);
  if (!request) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Request not found.");
  }
  request.status = "rejected";
  if (adminNote?.trim()) request.adminNote = adminNote.trim();
  await request.save();

  const site =
    request.siteKind === "deal-site"
      ? await DB.Models.DealSite.findById(request.siteId)
      : await DB.Models.ProfessionalSite.findById(request.siteId);
  if (site && site.customDomainStatus === "pending" && !site.customDomain) {
    site.customDomainStatus = "none";
    await site.save();
  }

  return request;
}

export async function resolvePublicSiteByHost(hostRaw: string) {
  const host = normalizeHostname(hostRaw);
  if (!host) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "host is required.");
  }

  const root = getDealSiteRootHost();
  const isSubdomain =
    host !== root &&
    host !== `www.${root}` &&
    host.endsWith(`.${root}`);

  if (isSubdomain) {
    const publicSlug = host.slice(0, -(root.length + 1));
    const deal = await DB.Models.DealSite.findOne({ publicSlug }).lean();
    if (deal) {
      return {
        kind: "deal-site" as const,
        publicSlug: deal.publicSlug,
        customDomain: (deal as any).customDomain || null,
        status: deal.status,
        customDomainStatus: (deal as any).customDomainStatus || "none",
        resolvedVia: "subdomain" as const,
      };
    }
    const pro = await DB.Models.ProfessionalSite.findOne({
      publicSlug,
      status: { $ne: "deleted" },
    }).lean();
    if (pro) {
      return {
        kind: "professional-site" as const,
        publicSlug: pro.publicSlug,
        customDomain: (pro as any).customDomain || null,
        status: pro.status,
        customDomainStatus: (pro as any).customDomainStatus || "none",
        siteKind: pro.kind,
        resolvedVia: "subdomain" as const,
      };
    }
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Site not found.");
  }

  const deal = await DB.Models.DealSite.findOne({ customDomain: host }).lean();
  if (deal) {
    const cdStatus = (deal as any).customDomainStatus || "none";
    if (cdStatus !== "live") {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Custom domain is not active."
      );
    }
    return {
      kind: "deal-site" as const,
      publicSlug: deal.publicSlug,
      customDomain: (deal as any).customDomain,
      status: deal.status,
      customDomainStatus: cdStatus,
      resolvedVia: "custom-domain" as const,
    };
  }

  const pro = await DB.Models.ProfessionalSite.findOne({
    customDomain: host,
    status: { $ne: "deleted" },
  }).lean();
  if (pro) {
    const cdStatus = (pro as any).customDomainStatus || "none";
    if (cdStatus !== "live") {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Custom domain is not active."
      );
    }
    return {
      kind: "professional-site" as const,
      publicSlug: pro.publicSlug,
      customDomain: (pro as any).customDomain,
      status: pro.status,
      customDomainStatus: cdStatus,
      siteKind: pro.kind,
      resolvedVia: "custom-domain" as const,
    };
  }

  throw new RouteError(HttpStatusCodes.NOT_FOUND, "Site not found.");
}

export async function runCustomDomainRenewalCron(): Promise<{
  reminded: number;
  disabled: number;
}> {
  const graceDays = await getCustomDomainGraceDays();
  const now = new Date();
  let reminded = 0;
  let disabled = 0;

  const liveSites = [
    ...(await DB.Models.DealSite.find({
      customDomainStatus: "live",
      customDomain: { $exists: true, $ne: "" },
      customDomainExpiresAt: { $exists: true },
    })),
    ...(await DB.Models.ProfessionalSite.find({
      customDomainStatus: "live",
      customDomain: { $exists: true, $ne: "" },
      customDomainExpiresAt: { $exists: true },
    })),
  ];

  for (const site of liveSites) {
    const expiresAt = site.customDomainExpiresAt
      ? new Date(site.customDomainExpiresAt)
      : null;
    if (!expiresAt) continue;

    const msLeft = expiresAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    const ownerId =
      (site as any).createdBy || (site as any).ownerId
        ? String((site as any).createdBy || (site as any).ownerId)
        : "";

    const graceEnd = new Date(expiresAt);
    graceEnd.setDate(graceEnd.getDate() + graceDays);

    if (now > graceEnd) {
      site.customDomainStatus = "disabled";
      site.customDomainGraceEndsAt = graceEnd;
      await site.save();
      disabled += 1;

      if (ownerId) {
        await notificationService.createNotification({
          user: ownerId,
          title: "Custom domain disabled",
          message: `${site.customDomain} was disabled after the renewal grace period. Pay renewal to restore it. Your ${getDealSiteRootHost()} page still works.`,
          type: "system",
          meta: {
            screen: "custom-domain",
            customDomain: site.customDomain,
          },
        });
      }
      void notifyAllActiveAdmins({
        type: "custom_domain_renewal_due",
        title: "Custom domain disabled (unpaid)",
        message: `${site.customDomain} disabled after grace. Turn off Namecheap auto-renew if needed.`,
        meta: { customDomain: site.customDomain, siteId: String(site._id) },
      });
      continue;
    }

    if ([30, 14, 7].includes(daysLeft) || (daysLeft <= 0 && daysLeft > -graceDays)) {
      if (ownerId) {
        const user = await DB.Models.User.findById(ownerId).select("email firstName");
        const msg =
          daysLeft > 0
            ? `Your custom domain ${site.customDomain} renews in ${daysLeft} day(s). Subscribe quarterly or yearly in the app to keep it live.`
            : `Your custom domain ${site.customDomain} is past expiry. Pay renewal within the grace period to keep it live.`;
        await notificationService.createNotification({
          user: ownerId,
          title: "Custom domain renewal",
          message: msg,
          type: "system",
          meta: { screen: "custom-domain", customDomain: site.customDomain },
        });
        if (user?.email) {
          void sendEmail({
            to: user.email,
            subject: "Custom domain renewal reminder",
            text: `Hello ${user.firstName || ""},\n\n${msg}\n\nKhabiteq`,
            skipBuyerInbox: true,
          });
        }
        reminded += 1;
      }
    }
  }

  return { reminded, disabled };
}
