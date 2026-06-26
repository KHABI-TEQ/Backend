import { DB } from "../controllers";
import { normalizeNigerianPhone } from "../common/phoneUtils";
import { Types } from "mongoose";

function channelPayerEmail(phone: string): string {
  const digits = normalizeNigerianPhone(phone) || phone.replace(/\D/g, "");
  return `channel+${digits}@khabiteq.com`;
}

/** Find or create a lightweight Buyer record for anonymous channel payments. */
export async function findOrCreateChannelBuyer(phone: string): Promise<Types.ObjectId> {
  const normalized = normalizeNigerianPhone(phone) || phone;
  const email = channelPayerEmail(phone);

  const existing = await DB.Models.Buyer.findOne({
    $or: [{ phoneNumber: normalized }, { email }, { whatsAppNumber: normalized }],
  })
    .select("_id")
    .lean();

  if (existing?._id) {
    return existing._id as Types.ObjectId;
  }

  const buyer = await DB.Models.Buyer.create({
    fullName: "Channel User",
    phoneNumber: normalized,
    email,
    whatsAppNumber: normalized,
  });

  return buyer._id as Types.ObjectId;
}
