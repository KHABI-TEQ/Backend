import { Types } from "mongoose";
import { Request } from "express";
import { DB } from "../controllers";
import {
  PROPERTY_VIEW_SOURCES,
  PropertyViewSource,
} from "../models/propertyView";
import { resolveLeanRefToObjectId } from "../utils/mongooseId";

const VIEW_DEDUP_MS = 6 * 60 * 60 * 1000;
const CLIENT_PLATFORM_HEADER = "x-client-platform";

function isViewSource(value: unknown): value is PropertyViewSource {
  return (
    typeof value === "string" &&
    (PROPERTY_VIEW_SOURCES as readonly string[]).includes(value)
  );
}

export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function resolvePropertyViewSource(
  req: Request,
  fallback: PropertyViewSource
): PropertyViewSource {
  const header = req.headers[CLIENT_PLATFORM_HEADER];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (isViewSource(headerValue)) return headerValue;

  const queryValue = (req.query as Record<string, unknown>)?.client;
  if (isViewSource(queryValue)) return queryValue;

  return fallback;
}

function asObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  const resolved = resolveLeanRefToObjectId(value);
  if (resolved) return resolved;
  if (typeof value === "string" && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  return null;
}

/**
 * Record a public listing-detail view. Dedupes the same visitor (viewer id or IP)
 * on the same property for 6 hours. Never throws — callers should fire-and-forget.
 */
export async function recordListingView(params: {
  property: { _id: unknown; owner?: unknown };
  source: PropertyViewSource;
  ipAddress?: string;
  userAgent?: string;
  viewerId?: string | null;
  pageOwnerId?: string | null;
}): Promise<boolean> {
  try {
    const propertyId = asObjectId(params.property?._id);
    const ownerId = asObjectId(params.property?.owner);
    if (!propertyId || !ownerId) return false;

    const viewerId = params.viewerId && Types.ObjectId.isValid(params.viewerId)
      ? new Types.ObjectId(params.viewerId)
      : null;
    const pageOwnerId =
      params.pageOwnerId && Types.ObjectId.isValid(params.pageOwnerId)
        ? new Types.ObjectId(params.pageOwnerId)
        : null;

    if (viewerId && (viewerId.equals(ownerId) || (pageOwnerId && viewerId.equals(pageOwnerId)))) {
      return false;
    }

    const ipAddress = (params.ipAddress || "unknown").slice(0, 128);
    const since = new Date(Date.now() - VIEW_DEDUP_MS);
    const dedupFilter = viewerId
      ? { viewer: viewerId }
      : params.source === "practitioner_page"
        ? null
        : { ipAddress };

    if (dedupFilter) {
      const recent = await DB.Models.PropertyView.findOne({
        property: propertyId,
        viewedAt: { $gte: since },
        ...dedupFilter,
      })
        .select("_id")
        .lean();

      if (recent) return false;
    }

    await DB.Models.PropertyView.create({
      property: propertyId,
      owner: ownerId,
      pageOwner: pageOwnerId && !pageOwnerId.equals(ownerId) ? pageOwnerId : undefined,
      viewer: viewerId || undefined,
      ipAddress,
      userAgent: (params.userAgent || "").slice(0, 512) || undefined,
      source: params.source,
      viewedAt: new Date(),
    });
    return true;
  } catch (err) {
    console.warn("[recordListingView] failed:", err);
    return false;
  }
}

export function recordListingViewFromRequest(
  req: Request,
  property: { _id: unknown; owner?: unknown },
  fallbackSource: PropertyViewSource,
  pageOwnerId?: string | null
): void {
  const skip = String(req.headers["x-skip-listing-view"] || "").trim() === "1";
  if (skip) return;

  const viewerId = (req as any).user?._id ? String((req as any).user._id) : null;
  void recordListingView({
    property,
    source: resolvePropertyViewSource(req, fallbackSource),
    ipAddress: clientIpFromRequest(req),
    userAgent: String(req.headers["user-agent"] || ""),
    viewerId,
    pageOwnerId: pageOwnerId || null,
  });
}

export async function countListingViewsForUser(userId: string): Promise<number> {
  if (!userId || !Types.ObjectId.isValid(userId)) return 0;
  const oid = new Types.ObjectId(userId);
  const ownedIds = await DB.Models.Property.distinct("_id", { owner: oid });
  return DB.Models.PropertyView.countDocuments({
    $or: [
      { owner: oid },
      { pageOwner: oid },
      ...(ownedIds.length
        ? [{ owner: { $exists: false }, property: { $in: ownedIds } }]
        : []),
    ],
  });
}

export async function sumAgentCommissionForUser(userId: string): Promise<number> {
  if (!userId || !Types.ObjectId.isValid(userId)) return 0;
  const rows = await DB.Models.RequestToMarket.aggregate([
    {
      $match: {
        requestedByAgentId: new Types.ObjectId(userId),
        status: "accepted",
        saleRegisteredAt: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$agentCommissionAmount", 0] } },
      },
    },
  ]);
  return Number(rows[0]?.total) || 0;
}
