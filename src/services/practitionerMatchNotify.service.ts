import { Types } from "mongoose";
import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { listingMatchedPreferenceMail } from "../common/emailTemplates/preference";
import { getPropertyTitleFromLocation } from "../utils/helper";
import { getClientDashboardUrl } from "../utils/clientAppUrl";
import notificationService from "./notification.service";
import { pushToPractitionerDevices } from "./practitionerNotification.service";
import { buildPractitionerListingMatchMeta } from "../utils/notificationDeepLinks";

function preferenceTypeLabel(preferenceType?: string | null): string {
  switch (String(preferenceType || "").toLowerCase()) {
    case "buy":
      return "buy";
    case "rent":
      return "rent";
    case "shortlet":
      return "shortlet";
    case "joint-venture":
      return "joint venture";
    case "off-plan":
      return "off-plan";
    default:
      return preferenceType || "N/A";
  }
}

function preferenceSummaryForOwner(preference: any) {
  const locationString =
    preference?.location?.customLocation ||
    `${preference?.location?.state || ""}${
      preference?.location?.localGovernmentAreas?.length
        ? `, ${preference.location.localGovernmentAreas.join(", ")}`
        : ""
    }` ||
    "N/A";
  const { minPrice, maxPrice, currency } = preference?.budget || {};
  const priceRange = `${minPrice?.toLocaleString() || "N/A"} - ${maxPrice?.toLocaleString() || "N/A"} ${currency || "NGN"}`;
  return {
    propertyType: preferenceTypeLabel(preference?.preferenceType),
    locationString: String(locationString).trim() || "N/A",
    priceRange,
  };
}

function collectRecipientUserIds(property: any): string[] {
  const ids = new Set<string>();
  const ownerModel = String(property?.ownerModel || "User");
  if (ownerModel !== "Admin" && property?.owner) {
    ids.add(String(property.owner._id || property.owner));
  }
  if (property?.marketedByAgentId != null) {
    ids.add(String(property.marketedByAgentId));
  }
  if (Array.isArray(property?.marketedByAgentIds)) {
    for (const x of property.marketedByAgentIds) {
      if (x != null) ids.add(String(x));
    }
  }
  return [...ids];
}

/**
 * Email + in-app + push listing owners (and accepted marketers) when their
 * properties are newly paired with a buyer preference.
 */
export async function notifyPractitionersOfListingMatches(params: {
  preference: any;
  newlyMatchedPropertyIds: Types.ObjectId[];
  matchedRecordId?: string;
}): Promise<void> {
  const { preference, newlyMatchedPropertyIds, matchedRecordId } = params;
  if (!newlyMatchedPropertyIds.length) return;

  const properties = await DB.Models.Property.find({
    _id: { $in: newlyMatchedPropertyIds },
  })
    .select(
      "location propertyType owner ownerModel marketedByAgentId marketedByAgentIds"
    )
    .lean();
  if (!properties.length) return;

  const byRecipient = new Map<string, any[]>();
  for (const property of properties) {
    for (const userId of collectRecipientUserIds(property)) {
      const list = byRecipient.get(userId) || [];
      list.push(property);
      byRecipient.set(userId, list);
    }
  }
  if (!byRecipient.size) return;

  const summary = preferenceSummaryForOwner(preference);
  const preferenceId = String(preference?._id || "");
  const dashboardLink = getClientDashboardUrl();

  const users = await DB.Models.User.find({
    _id: { $in: [...byRecipient.keys()] },
  })
    .select("email firstName lastName userType enableNotifications")
    .lean();
  const userById = new Map(users.map((u: any) => [String(u._id), u]));

  for (const [userId, owned] of byRecipient) {
    const user = userById.get(userId);
    if (!user) continue;

    const listingRows = owned.map((p: any) => ({
      title: getPropertyTitleFromLocation(p.location) || p.propertyType || "Property",
      propertyType: p.propertyType,
      id: String(p._id),
    }));
    const count = listingRows.length;
    const first = listingRows[0];
    const title =
      count === 1 ? "Your listing matched a buyer" : "Your listings matched a buyer";
    const message =
      count === 1
        ? `${first.title} matched a buyer looking to ${summary.propertyType} in ${summary.locationString}.`
        : `${count} of your listings matched a buyer looking to ${summary.propertyType} in ${summary.locationString}.`;

    const meta = buildPractitionerListingMatchMeta({
      userType: user.userType,
      propertyId: first.id,
      preferenceId,
      matchedId: matchedRecordId,
    });

    try {
      await notificationService.createNotification({
        user: userId,
        title,
        message,
        type: "property_update",
        meta,
      });
    } catch (e) {
      console.warn("[practitionerMatchNotify] In-app failed:", e);
    }

    const to = String(user.email || "").trim();
    if (to) {
      try {
        const name =
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          "there";
        const html = generalEmailLayout(
          listingMatchedPreferenceMail({
            practitionerName: name,
            properties: listingRows,
            preferenceSummary: summary,
            dashboardLink,
          })
        );
        await sendEmail({
          to,
          subject:
            count === 1
              ? "Your listing matched a buyer preference"
              : `${count} of your listings matched a buyer preference`,
          html,
          text: message,
          skipBuyerInbox: true,
        });
      } catch (e) {
        console.warn("[practitionerMatchNotify] Email failed:", e);
      }
    }

    try {
      await pushToPractitionerDevices({
        userId,
        title,
        body: message,
        type: "property_update",
        meta,
      });
    } catch (e) {
      console.warn("[practitionerMatchNotify] Push failed:", e);
    }
  }
}
