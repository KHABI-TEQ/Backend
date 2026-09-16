import { DB } from "../controllers";
import { DealSiteService } from "./dealSite.service";
import { isLivePropertyStatus } from "../utils/liveListingFilter";

export function normalizePropertyCode(raw: string | undefined | null): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

function orgToken(source?: string | null): string {
  const letters = String(source || "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3);
  return (letters || "KHQ").padEnd(3, "X");
}

export async function generateUniquePropertyCode(owner: {
  firstName?: string;
  lastName?: string;
  userType?: string;
  companyName?: string;
}): Promise<string> {
  const token = orgToken(owner.companyName || owner.lastName || owner.firstName || owner.userType);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const serial = String(Math.floor(10000 + Math.random() * 90000));
    const code = `KH-${token}-${serial}`;
    const exists = await DB.Models.Property.exists({ propertyCode: code });
    if (!exists) return code;
  }
  return `KH-${token}-${Date.now().toString().slice(-5)}`;
}

export async function assignPropertyCodeIfMissing(params: {
  propertyId: string;
  owner: {
    firstName?: string;
    lastName?: string;
    userType?: string;
    companyName?: string;
  };
}): Promise<string> {
  const property = await DB.Models.Property.findById(params.propertyId).select("propertyCode");
  if (!property) return "";
  if (property.propertyCode) return property.propertyCode;
  const code = await generateUniquePropertyCode(params.owner);
  property.propertyCode = code;
  await property.save();
  return code;
}

export async function lookupPropertyByCode(rawCode: string) {
  const propertyCode = normalizePropertyCode(rawCode);
  if (!propertyCode || propertyCode.length < 6) return null;

  const property = await DB.Models.Property.findOne({
    propertyCode,
    isDeleted: { $ne: true },
  })
    .populate("owner", "firstName lastName userType profile_picture")
    .lean();

  if (!property) return null;

  const owner = property.owner as {
    _id?: unknown;
    firstName?: string;
    lastName?: string;
    userType?: string;
    profile_picture?: string;
  } | null;

  const live =
    Boolean(property.isApproved) &&
    property.isAvailable !== false &&
    isLivePropertyStatus(String(property.status || ""));

  let practitionerPage: { slug: string; url: string } | null = null;
  if (owner?._id) {
    try {
      const sites = await DealSiteService.getByAgent(String(owner._id), true);
      const site = sites?.[0];
      if (site?.publicSlug) {
        practitionerPage = {
          slug: site.publicSlug,
          url: `https://${site.publicSlug}.khabiteq.com`,
        };
      }
    } catch {
      practitionerPage = null;
    }
  }

  return {
    propertyCode,
    isLive: live,
    status: property.status,
    property: live
      ? {
          id: String(property._id),
          propertyType: property.propertyType,
          briefType: property.briefType,
          price: property.price,
          location: property.location,
          pictures: property.pictures?.slice(0, 4) || [],
          description: property.description,
        }
      : null,
    professional: owner
      ? {
          id: String(owner._id),
          name: `${owner.firstName || ""} ${owner.lastName || ""}`.trim(),
          userType: owner.userType,
          profilePicture: owner.profile_picture || null,
        }
      : null,
    practitionerPage,
  };
}
