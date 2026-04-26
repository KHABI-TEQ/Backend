import { DB } from "../controllers";
import { getPropertyTitleFromLocation } from "../utils/helper";
import { getWhatsAppServiceIfConfigured } from "./whatsappClient.service";
import { Types } from "mongoose";

const WINDOW_MS = 10 * 60 * 1000;

/**
 * 24h / 2h shortlet check-in WhatsApp reminders (user-facing viewing reminder templates).
 * Uses meta.whatsappViewing24hSent / meta.whatsappViewing2hSent to avoid duplicate sends.
 */
export async function processShortletViewingWhatsappReminders(): Promise<{
  sent24h: number;
  sent2h: number;
}> {
  const wa = getWhatsAppServiceIfConfigured();
  if (!wa) {
    return { sent24h: 0, sent2h: 0 };
  }

  const now = Date.now();
  const from = new Date(now - 48 * 60 * 60 * 1000);
  const to = new Date(now + 30 * 60 * 60 * 1000);

  const bookings = await DB.Models.Booking.find({
    status: "confirmed",
    "bookingDetails.checkInDateTime": { $gte: from, $lte: to },
  })
    .populate("bookedBy", "fullName email phoneNumber whatsAppNumber")
    .populate({ path: "propertyId", populate: { path: "owner", select: "firstName lastName fullName email phoneNumber" } })
    .lean();

  let sent24h = 0;
  let sent2h = 0;

  for (const b of bookings as any[]) {
    const checkIn = b.bookingDetails?.checkInDateTime
      ? new Date(b.bookingDetails.checkInDateTime)
      : null;
    if (!checkIn || isNaN(checkIn.getTime())) continue;

    const t = checkIn.getTime();
    const property = b.propertyId;
    if (!property) continue;

    const propertyTitle = getPropertyTitleFromLocation(property.location) || "Property";
    const buyer = b.bookedBy as any;
    const owner = property.owner as any;
    if (!buyer || !owner) continue;

    const userName = buyer.fullName || buyer.email || "there";
    const buyerPhone = (buyer.whatsAppNumber || buyer.phoneNumber || "") as string;
    const agentName =
      [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || "Agent";
    const agentPhone = (owner.phoneNumber || "") as string;
    if (!String(buyerPhone).replace(/\s/g, "").length || !String(agentPhone).replace(/\s/g, "").length) {
      continue;
    }

    const meta = (b.meta && typeof b.meta === "object" ? b.meta : {}) as Record<string, unknown>;

    // 24h before check-in
    const target24 = t - 24 * 60 * 60 * 1000;
    if (!meta.whatsappViewing24hSent && now >= target24 - WINDOW_MS && now <= target24 + WINDOW_MS) {
      const r = await wa.sendViewingReminder(
        {
          booking: {
            id: String(b._id),
            dateTime: checkIn,
            userPreferences: "",
            propertyName: propertyTitle,
          } as any,
          user: { name: userName, phone: buyerPhone },
          agent: { name: agentName, phone: agentPhone },
          property: {
            name: propertyTitle,
            address: propertyTitle,
            location: propertyTitle,
            price: property.price,
            bedrooms: property.additionalFeatures?.noOfBedroom,
            bathrooms: property.additionalFeatures?.noOfBathroom,
          },
        },
        "24h"
      );
      if (r.success) {
        sent24h += 1;
        await DB.Models.Booking.updateOne(
          { _id: b._id },
          { $set: { "meta.whatsappViewing24hSent": true, "meta.whatsappViewing24hSentAt": new Date() } }
        );
      }
      continue;
    }

    // 2h before check-in
    const target2 = t - 2 * 60 * 60 * 1000;
    if (!meta.whatsappViewing2hSent && now >= target2 - WINDOW_MS && now <= target2 + WINDOW_MS) {
      const r = await wa.sendViewingReminder(
        {
          booking: {
            id: String(b._id),
            dateTime: checkIn,
            userPreferences: "",
            propertyName: propertyTitle,
          } as any,
          user: { name: userName, phone: buyerPhone },
          agent: { name: agentName, phone: agentPhone },
          property: {
            name: propertyTitle,
            address: propertyTitle,
            location: propertyTitle,
            price: property.price,
            bedrooms: property.additionalFeatures?.noOfBedroom,
            bathrooms: property.additionalFeatures?.noOfBathroom,
          },
        },
        "2h"
      );
      if (r.success) {
        sent2h += 1;
        await DB.Models.Booking.updateOne(
          { _id: b._id },
          { $set: { "meta.whatsappViewing2hSent": true, "meta.whatsappViewing2hSentAt": new Date() } }
        );
      }
    }
  }

  return { sent24h, sent2h };
}
