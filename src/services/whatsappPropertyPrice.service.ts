import { DB } from "../controllers";
import { getPropertyTitleFromLocation } from "../utils/helper";
import { runWhatsapp } from "./whatsappClient.service";
import { Types } from "mongoose";

/**
 * When a property price is reduced, notify interested buyers (matched preferences) on WhatsApp.
 */
export async function notifyPriceDropToMatchedPreferences(params: {
  propertyId: Types.ObjectId;
  oldPrice: number;
  newPrice: number;
}): Promise<void> {
  const { propertyId, oldPrice, newPrice } = params;
  if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || newPrice >= oldPrice) {
    return;
  }

  const property = await DB.Models.Property.findById(propertyId).lean();
  if (!property) return;

  const propertyName = getPropertyTitleFromLocation((property as any).location) || "A property";
  const propertyLocation = propertyName;

  const records = await DB.Models.MatchedPreferenceProperty.find({
    matchedProperties: propertyId,
  })
    .select("preference")
    .lean();

  const sentPhones = new Set<string>();

  for (const rec of records) {
    const preference = await DB.Models.Preference.findById((rec as any).preference).lean();
    if (!preference) continue;
    const contact = (preference as any).contactInfo as { fullName?: string; phoneNumber?: string } | undefined;
    const phone = (contact?.phoneNumber || "").replace(/\s/g, "");
    if (phone.length < 10 || sentPhones.has(phone)) continue;
    sentPhones.add(phone);

    const userName = contact?.fullName || "there";

    await runWhatsapp("price_drop_alert", async (wa) => {
      await wa.sendPriceDropAlert({
        user: { name: userName, phone, id: String(preference.buyer) },
        property: {
          id: String(propertyId),
          name: propertyName,
          location: propertyLocation,
          price: newPrice,
        } as any,
        oldPrice,
        newPrice,
      });
    });
  }
}
