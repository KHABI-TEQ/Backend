import { DB } from "../controllers";
import { Types } from "mongoose";

/** Tenant front origin for DealSites (e.g. https://realhomes.khabiteq.com). */
export function dealSiteBaseUrlFromPublicSlug(publicSlug: string): string {
  const s = String(publicSlug || "").trim();
  if (!s) return "";
  return `https://${s}.khabiteq.com`;
}

async function dealSitePublicSlugForUser(userId: unknown): Promise<string | null> {
  if (userId == null || !Types.ObjectId.isValid(String(userId))) return null;
  const sites = await DB.Models.DealSite.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .select("publicSlug status")
    .lean();
  if (!sites.length) return null;
  const running = sites.find((x: any) => x.status === "running");
  const slug = (running as any)?.publicSlug ?? (sites[0] as any)?.publicSlug;
  return slug ? String(slug).trim() || null : null;
}

/**
 * DealSite slug for a listing: marketed agent(s) first, then owner when ownerModel is User.
 * Admin-only owners have no User DealSite here — returns null.
 */
export async function dealSitePublicSlugForProperty(property: any): Promise<string | null> {
  if (!property) return null;

  const marketed: unknown[] = [];
  if (Array.isArray(property.marketedByAgentIds) && property.marketedByAgentIds.length) {
    marketed.push(...property.marketedByAgentIds);
  } else if (property.marketedByAgentId != null) {
    marketed.push(property.marketedByAgentId);
  }

  for (const uid of marketed) {
    const slug = await dealSitePublicSlugForUser(uid);
    if (slug) return slug;
  }

  if (property.ownerModel === "User" && property.owner != null) {
    return dealSitePublicSlugForUser(property.owner);
  }

  return null;
}

/**
 * Base URL for "view matches" links: first matched listing that yields a DealSite slug wins (array order).
 * Falls back to CLIENT_LINK (trimmed) so legacy / admin-only listings still get a working URL.
 */
export async function resolveMatchedPropertiesEmailBaseUrl(
  propertiesInOrder: any[],
): Promise<string> {
  for (const p of propertiesInOrder) {
    const slug = await dealSitePublicSlugForProperty(p);
    if (slug) return dealSiteBaseUrlFromPublicSlug(slug);
  }
  const fallback = (process.env.CLIENT_LINK || "").replace(/\/$/, "");
  return fallback || "https://khabiteq.com";
}
