import crypto from "crypto";
import axios from "axios";
import { Types } from "mongoose";
import { DB } from "../controllers";
import { dealSiteOriginFromPublicSlug } from "../config/dealSitePublicHost";

type SyndicationEvent = "property.created" | "property.updated" | "property.status_changed" | "property.unpublished";

function normalizePlatformKey(platformKey: string): string {
  return String(platformKey || "").trim().toLowerCase();
}

/**
 * Public API root for routes mounted under `app.use('/api', ...)` (e.g. third-party syndication).
 * Supports both `API_BASE_URL=https://host` and `https://host/api` without duplicating `/api`.
 */
function resolvePublicApiBase(): string {
  const raw = (process.env.API_BASE_URL || process.env.CLIENT_LINK || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (/\/api$/i.test(raw)) return raw;
  return `${raw}/api`;
}

function buildInspectionRedirectUrl(propertyId: string, ownerId: string): string {
  const base = resolvePublicApiBase();
  if (!base) return "";
  const secret = process.env.SYNDICATION_LINK_SECRET || "khabiteq-syndication";
  const raw = `${propertyId}:${ownerId}`;
  const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex").slice(0, 24);
  const q = new URLSearchParams({
    ownerId: String(ownerId),
    sig: signature,
  });
  return `${base}/third-party/syndication/inspection-redirect/${encodeURIComponent(propertyId)}?${q.toString()}`;
}

function mapOutboundStatus(status: string): "active" | "inactive" {
  const inactive = new Set([
    "withdrawn",
    "unavailable",
    "expired",
    "coming_soon",
    "under_contract",
    "sold",
    "flagged",
    "cancelled",
    "temporarily_off_market",
    "hold",
    "failed",
    "never_listed",
    "rejected",
    "deleted",
    "pending",
  ]);
  return inactive.has(status) ? "inactive" : "active";
}

async function buildSyndicationPayload(propertyId: string) {
  const property = await DB.Models.Property.findById(propertyId).lean();
  if (!property) return null;

  const ownerId = String((property as any).owner);
  const dealSite = await DB.Models.DealSite.findOne({ createdBy: new Types.ObjectId(ownerId), status: "running" })
    .sort({ updatedAt: -1 })
    .lean();

  const dealsiteUrl = dealSite?.publicSlug ? dealSiteOriginFromPublicSlug(dealSite.publicSlug) : "";
  const inspectionUrl =
    buildInspectionRedirectUrl(String((property as any)._id), ownerId) ||
    (dealsiteUrl ? `${dealsiteUrl}/inspection?propertyId=${(property as any)._id}` : "");

  return {
    propertyId: String((property as any)._id),
    externalRef: String((property as any)._id),
    title: `${(property as any).propertyType || "Property"} in ${(property as any)?.location?.area || (property as any)?.location?.state || "Nigeria"}`,
    propertyType: (property as any).propertyType,
    propertyCategory: (property as any).propertyCategory,
    description: (property as any).description,
    price: (property as any).price,
    location: (property as any).location,
    media: {
      pictures: (property as any).pictures || [],
      videos: (property as any).videos || [],
    },
    listingStatus: mapOutboundStatus(String((property as any).status || "pending")),
    khabiteqStatus: (property as any).status,
    inspectionUrl,
    dealsiteUrl,
  };
}

export async function enqueuePropertySyndicationJobs(params: {
  propertyId: string;
  userId: string;
  eventType: SyndicationEvent;
}) {
  try {
    if ((process.env.SYNDICATION_ENABLED || "false").toLowerCase() !== "true") return;

    const payload = await buildSyndicationPayload(params.propertyId);
    if (!payload) return;

    const connections = await DB.Models.PlatformConnection.find({
      userId: new Types.ObjectId(params.userId),
      status: "active",
      "config.outboundEnabled": { $ne: false },
    })
      .populate("platformId")
      .lean();

    if (!connections.length) return;

    await Promise.all(
      connections.map((connection: any) => {
        const platform = connection.platformId as any;
        if (!platform || platform.status !== "approved" || platform?.config?.outboundEnabled === false) {
          return Promise.resolve(null);
        }
        return DB.Models.SyndicationJob.create({
          propertyId: new Types.ObjectId(params.propertyId),
          userId: new Types.ObjectId(params.userId),
          platformKey: normalizePlatformKey(platform.platformKey || connection.platformKey),
          eventType: params.eventType,
          status: "pending",
          payload,
        });
      })
    );
  } catch (error) {
    console.warn("[enqueuePropertySyndicationJobs] failed:", error);
  }
}

export async function saveInboundSyndicationWebhook(params: {
  platformKey: string;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const platformKey = normalizePlatformKey(params.platformKey);
  const eventId = String(params.payload?.eventId || params.payload?.id || "");
  const eventType = String(params.payload?.type || params.payload?.eventType || "");

  let status: "received" | "processed" | "failed" = "received";
  let errorMessage = "";

  try {
    const platform = await DB.Models.SyndicationPlatform.findOne({ platformKey }).lean();
    if (!platform || platform.status !== "approved") {
      throw new Error("Platform is not approved for inbound webhook processing");
    }
    if (platform?.config?.inboundWebhookEnabled === false) {
      throw new Error("Inbound webhook is disabled for this platform");
    }

    // Idempotency: upsert by (platformKey, eventId) when eventId is provided.
    if (eventId) {
      const existing = await DB.Models.WebhookEvent.findOne({ platformKey, eventId }).lean();
      if (existing) {
        return { duplicated: true };
      }
    }

    // Minimal mapping update for listing status callbacks.
    if (eventType === "listing.published" || eventType === "listing.updated") {
      const externalRef = String(params.payload?.externalRef || "");
      const platformListingId = String(params.payload?.listingId || params.payload?.id || "");
      if (externalRef && platformListingId && Types.ObjectId.isValid(externalRef)) {
        const property = await DB.Models.Property.findById(externalRef).lean();
        if (!property) {
          throw new Error("Referenced property not found for webhook mapping");
        }
        await DB.Models.SyndicatedListingMapping.updateOne(
          { propertyId: new Types.ObjectId(externalRef), platformKey },
          {
            $set: {
              propertyId: new Types.ObjectId(externalRef),
              userId: new Types.ObjectId(String((property as any).owner)),
              platformKey,
              platformListingId,
              lastSyncedStatus: "active",
              isActive: true,
              listingUrl: params.payload?.url || undefined,
            },
          },
          { upsert: true }
        );
      }
    }

    status = "processed";
  } catch (error: any) {
    status = "failed";
    errorMessage = error?.message || "Failed to process webhook";
  } finally {
    await DB.Models.WebhookEvent.create({
      platformKey,
      eventId: eventId || undefined,
      eventType: eventType || undefined,
      headers: params.headers,
      payload: params.payload,
      status,
      processedAt: new Date(),
      errorMessage: errorMessage || undefined,
    });
  }

  return { duplicated: false, status };
}

function buildAuthHeaders(connection: any): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authType = String(connection?.authType || "");
  if (authType === "api_key" && connection?.credentials?.apiKey) {
    headers.Authorization = `Bearer ${connection.credentials.apiKey}`;
  }
  if (authType === "oauth2" && connection?.credentials?.accessToken) {
    headers.Authorization = `Bearer ${connection.credentials.accessToken}`;
  }
  if (authType === "basic" && connection?.credentials?.apiKey) {
    headers.Authorization = `Basic ${connection.credentials.apiKey}`;
  }

  return headers;
}

function resolveEndpointForEvent(baseUrl: string, eventType: SyndicationEvent): string {
  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  if (!normalizedBase) return "";
  if (eventType === "property.unpublished") return `${normalizedBase}/listings/unpublish`;
  if (eventType === "property.status_changed") return `${normalizedBase}/listings/status`;
  return `${normalizedBase}/listings`;
}

async function markJobAsFailed(jobId: string, attempts: number, maxAttempts: number, message: string) {
  // After this update, attempts becomes attempts+1. Mark failed when no retries remain (dispatcher only picks attempts < maxAttempts).
  const exceeded = attempts + 1 >= maxAttempts;
  await DB.Models.SyndicationJob.updateOne(
    { _id: new Types.ObjectId(jobId) },
    {
      $set: {
        status: exceeded ? "failed" : "pending",
        errorMessage: message,
        lastAttemptAt: new Date(),
      },
      $inc: { attempts: 1 },
    }
  );
}

async function processSingleSyndicationJob(job: any) {
  const connection = await DB.Models.PlatformConnection.findOne({
    userId: job.userId,
    platformKey: job.platformKey,
    status: "active",
    "config.outboundEnabled": { $ne: false },
  })
    .populate("platformId")
    .lean();

  if (!connection) {
    await markJobAsFailed(job._id.toString(), job.attempts, job.maxAttempts, "Active platform connection not found");
    return;
  }

  const platform = connection.platformId as any;
  if (!platform || platform.status !== "approved") {
    await markJobAsFailed(job._id.toString(), job.attempts, job.maxAttempts, "Platform is not approved");
    return;
  }
  if (platform?.config?.outboundEnabled === false) {
    await markJobAsFailed(job._id.toString(), job.attempts, job.maxAttempts, "Platform outbound is disabled by admin");
    return;
  }

  const endpoint = resolveEndpointForEvent(platform?.config?.baseUrl || connection?.config?.baseUrl || "", job.eventType);
  if (!endpoint) {
    await markJobAsFailed(job._id.toString(), job.attempts, job.maxAttempts, "Platform baseUrl is missing");
    return;
  }

  const headers = buildAuthHeaders({
    ...connection,
    authType: platform?.authType || connection?.authType,
  });
  const body = {
    eventType: job.eventType,
    ...job.payload,
  };

  try {
    const response = await axios.post(endpoint, body, {
      headers,
      timeout: Number(process.env.SYNDICATION_HTTP_TIMEOUT_MS || 12000),
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300) {
      await DB.Models.SyndicationJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "sent",
            sentAt: new Date(),
            lastAttemptAt: new Date(),
            errorMessage: undefined,
          },
          $inc: { attempts: 1 },
        }
      );

      const platformListingId = String(
        response.data?.listingId || response.data?.id || response.data?.data?.listingId || ""
      );
      const listingUrl = String(response.data?.url || response.data?.data?.url || "");
      if (platformListingId) {
        await DB.Models.SyndicatedListingMapping.updateOne(
          { propertyId: job.propertyId, platformKey: job.platformKey },
          {
            $set: {
              propertyId: job.propertyId,
              userId: job.userId,
              platformKey: job.platformKey,
              platformListingId,
              listingUrl: listingUrl || undefined,
              lastSyncedStatus: "active",
              isActive: true,
            },
          },
          { upsert: true }
        );
      }
      return;
    }

    await markJobAsFailed(
      job._id.toString(),
      job.attempts,
      job.maxAttempts,
      `HTTP ${response.status}: ${JSON.stringify(response.data || {}).slice(0, 500)}`
    );
  } catch (error: any) {
    await markJobAsFailed(
      job._id.toString(),
      job.attempts,
      job.maxAttempts,
      error?.message || "Unknown outbound syndication error"
    );
  }
}

export async function dispatchPendingSyndicationJobs(options?: { batchSize?: number }) {
  if ((process.env.SYNDICATION_ENABLED || "false").toLowerCase() !== "true") return;

  const batchSize = Math.max(1, Math.min(Number(options?.batchSize || process.env.SYNDICATION_DISPATCH_BATCH_SIZE || 10), 50));
  for (let i = 0; i < batchSize; i += 1) {
    const job = await DB.Models.SyndicationJob.findOneAndUpdate(
      {
        status: "pending",
        $expr: { $lt: ["$attempts", "$maxAttempts"] },
      },
      { $set: { status: "processing", lastAttemptAt: new Date() } },
      { sort: { createdAt: 1 }, new: true }
    ).lean();

    if (!job) break;
    await processSingleSyndicationJob(job);
  }
}

