/** Workflow states that keep a listing on-market (`isAvailable: true`). */
export const LIVE_LISTING_STATUSES = [
  "approved",
  "available",
  "back_on_market",
] as const;

/** Workflow states that mean a listing is not live / matchable. */
export const LIVE_LISTING_STATUSES_EXCLUDED = [
  "sold",
  "sold_leased_registered",
  "withdrawn",
  "cancelled",
  "expired",
  "rejected",
  "deleted",
  "unavailable",
  "failed",
  "never_listed",
  "booked",
  "draft",
  "flagged",
  "hold",
  "temporarily_off_market",
] as const;

/** Sold / registered-complete listings. */
export const SOLD_LISTING_STATUSES = ["sold", "sold_leased_registered"] as const;

/**
 * Workflow-inactive listings (not pending, not unpublished-by-toggle, not sold).
 * Includes the dashboard "Inactive" group plus similar off-market states.
 */
export const INACTIVE_LISTING_STATUSES = [
  "rejected",
  "flagged",
  "hold",
  "withdrawn",
  "cancelled",
  "expired",
  "booked",
  "failed",
  "never_listed",
  "temporarily_off_market",
  "coming_soon",
  "under_contract",
  "contingent",
] as const;

/** Removed listing statuses. Live-on-market is `approved` + `isAvailable: true`. */
export const REMOVED_PROPERTY_STATUSES = ["active", "inactive", "inActive"] as const;

export function isLivePropertyStatus(status: string): boolean {
  return (LIVE_LISTING_STATUSES as readonly string[]).includes(status);
}

export function isRemovedPropertyStatus(status: string): boolean {
  return (REMOVED_PROPERTY_STATUSES as readonly string[]).includes(status);
}

export function liveListingMongoFilter(): Record<string, unknown> {
  return {
    isDeleted: { $ne: true },
    isRejected: { $ne: true },
    isApproved: true,
    isAvailable: { $ne: false },
    status: { $nin: [...LIVE_LISTING_STATUSES_EXCLUDED] },
  };
}

/** Disjoint dashboard buckets for owned, non-deleted listings. */
export function dashboardListingCountFilters(ownerId: unknown) {
  const base = { owner: ownerId, isDeleted: { $ne: true } };
  const sold = [...SOLD_LISTING_STATUSES];
  const inactive = [...INACTIVE_LISTING_STATUSES];
  return {
    total: base,
    onMarket: {
      owner: ownerId,
      ...liveListingMongoFilter(),
      status: { $nin: [...LIVE_LISTING_STATUSES_EXCLUDED, "pending"] },
    },
    pending: { ...base, status: "pending" },
    sold: { ...base, status: { $in: sold } },
    inactive: { ...base, status: { $in: inactive } },
    unpublished: {
      ...base,
      status: {
        $nin: ["pending", ...sold, ...inactive],
      },
      $or: [{ status: "unavailable" }, { isAvailable: false }],
    },
  };
}
