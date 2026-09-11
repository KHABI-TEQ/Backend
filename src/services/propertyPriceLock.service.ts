import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";

/** Bookings that mean the listing is still in an inspection / booking pipeline. */
export const ACTIVE_INSPECTION_STATUSES_FOR_PRICE_LOCK = [
  "pending_approval",
  "pending_transaction",
  "active_negotiation",
  "inspection_approved",
  "inspection_rescheduled",
  "negotiation_countered",
  "negotiation_accepted",
] as const;

export const PRICE_LOCKED_MESSAGE =
  "Price cannot be changed while this property has an active or upcoming inspection booking. Update the price after those inspections are completed or cancelled.";

export function userCanEditListedProperty(
  userId: unknown,
  property: {
    owner?: unknown;
    marketedByAgentId?: unknown;
    marketedByAgentIds?: unknown[];
  },
  role?: string,
): boolean {
  if (String(role || "").toLowerCase() === "admin") return true;
  const uid = String(userId || "");
  if (!uid) return false;

  const ownerId = String((property.owner as any)?._id || property.owner || "");
  if (ownerId && ownerId === uid) return true;

  if (property.marketedByAgentId != null && String(property.marketedByAgentId) === uid) {
    return true;
  }

  const marketed = Array.isArray(property.marketedByAgentIds)
    ? property.marketedByAgentIds
    : [];
  return marketed.some((id) => String(id) === uid);
}

function asFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function listingPriceFieldsChanged(
  current: { price?: unknown; pricing?: { nightly?: unknown } },
  incoming: { price?: unknown; pricing?: { nightly?: unknown } },
): boolean {
  if (incoming.price !== undefined) {
    const oldP = asFiniteNumber(current.price);
    const newP = asFiniteNumber(incoming.price);
    if (oldP !== newP) return true;
  }

  if (incoming.pricing && Object.prototype.hasOwnProperty.call(incoming.pricing, "nightly")) {
    const oldN = asFiniteNumber(current.pricing?.nightly);
    const newN = asFiniteNumber(incoming.pricing.nightly);
    if (oldN !== newN) return true;
  }

  return false;
}

export type PropertyPriceLockInfo = {
  priceChangeBlocked: boolean;
  upcomingInspectionCount: number;
  priceChangeBlockedMessage?: string;
};

export async function getPropertyPriceLock(
  propertyId: string | Types.ObjectId | unknown,
): Promise<PropertyPriceLockInfo> {
  const count = await DB.Models.InspectionBooking.countDocuments({
    propertyId: String(propertyId),
    status: { $in: [...ACTIVE_INSPECTION_STATUSES_FOR_PRICE_LOCK] },
  });

  return {
    priceChangeBlocked: count > 0,
    upcomingInspectionCount: count,
    priceChangeBlockedMessage: count > 0 ? PRICE_LOCKED_MESSAGE : undefined,
  };
}

export async function assertPropertyPriceChangeAllowed(
  propertyId: string | Types.ObjectId | unknown,
): Promise<void> {
  const lock = await getPropertyPriceLock(propertyId);
  if (lock.priceChangeBlocked) {
    throw new RouteError(HttpStatusCodes.CONFLICT, PRICE_LOCKED_MESSAGE);
  }
}
