import crypto from "crypto";
import { Types } from "mongoose";
import { DB } from "../controllers";
import { dealSiteOriginFromPublicSlug } from "../config/dealSitePublicHost";

type SyndicationEvent = "property.created" | "property.updated" | "property.status_changed" | "property.unpublished";

function normalizePlatformKey(platformKey: string): string {
  return String(platformKey || "").trim().toLowerCase();
}

function buildInspectionRedirectUrl(propertyId: string, ownerId: string): string {
  const base = (process.env.API_BASE_URL || process.env.CLIENT_LINK || "").replace(/\/+$/, "");
  if (!base) return "";
  const secret = process.env.SYNDICATION_LINK_SECRET || "khabiteq-syndication";
  const raw = `${propertyId}:${ownerId}`;
  const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex").slice(0, 24);
  return `${base}/api/third-party/syndication/inspection-redirect/${propertyId}?ownerId=${ownerId}&sig=${signature}`;
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
    }).lean();

    if (!connections.length) return;

    await Promise.all(
      connections.map((connection: any) =>
        DB.Models.SyndicationJob.create({
          propertyId: new Types.ObjectId(params.propertyId),
          userId: new Types.ObjectId(params.userId),
          platformKey: normalizePlatformKey(connection.platformKey),
          eventType: params.eventType,
          status: "pending",
          payload,
        })
      )
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

