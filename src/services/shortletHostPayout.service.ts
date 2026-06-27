import { Types } from "mongoose";
import { DB } from "../controllers";
import { PaystackService } from "./paystack.service";
import { BookingLogService } from "./bookingLog.service";
import { SHORTLET_HOST_COMMISSION_RATE } from "../utils/shortletPricing";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";

export type HostDisbursementStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed_no_bank"
  | "failed_insufficient_balance"
  | "failed_transfer"
  | "settled_via_subaccount";

export type HostBankDetails = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  contactEmail?: string;
  dealSiteId?: string;
};

function resolveHostPayoutAmount(meta: Record<string, unknown> | undefined): number {
  if (!meta) return 0;
  if (typeof meta.hostPayout === "number" && meta.hostPayout > 0) {
    return Math.round(meta.hostPayout);
  }
  const hostBase = typeof meta.hostBase === "number" ? meta.hostBase : 0;
  if (hostBase > 0) {
    return Math.round(hostBase * (1 - SHORTLET_HOST_COMMISSION_RATE));
  }
  const total = typeof meta.totalPrice === "number" ? meta.totalPrice : 0;
  if (total > 0) {
    const inferredHostBase = Math.round(total / 1.08);
    return Math.round(inferredHostBase * (1 - SHORTLET_HOST_COMMISSION_RATE));
  }
  return 0;
}

async function resolveHostBankDetails(booking: {
  ownerId: Types.ObjectId;
  receiverMode?: { type?: string; dealSiteID?: Types.ObjectId };
}): Promise<HostBankDetails | null> {
  let dealSite: any = null;

  if (booking.receiverMode?.type === "dealSite" && booking.receiverMode.dealSiteID) {
    dealSite = await DB.Models.DealSite.findById(booking.receiverMode.dealSiteID).lean();
  }

  if (!dealSite) {
    dealSite = await DB.Models.DealSite.findOne({
      createdBy: booking.ownerId,
      status: "running",
    }).lean();
  }

  const pd = dealSite?.paymentDetails;
  if (!pd?.accountNumber || !pd?.sortCode) return null;

  return {
    accountName: pd.accountName || pd.businessName || "Host",
    accountNumber: String(pd.accountNumber).trim(),
    bankCode: String(pd.sortCode).trim(),
    contactEmail: pd.primaryContactEmail || undefined,
    dealSiteId: dealSite?._id ? String(dealSite._id) : undefined,
  };
}

async function getOrCreateRecipientCode(
  bank: HostBankDetails
): Promise<string> {
  if (bank.dealSiteId) {
    const dealSite = await DB.Models.DealSite.findById(bank.dealSiteId);
    const cached = (dealSite as any)?.paymentDetails?.paystackTransferRecipientCode;
    if (cached) return String(cached);

    const created = await PaystackService.createTransferRecipient({
      name: bank.accountName,
      accountNumber: bank.accountNumber,
      bankCode: bank.bankCode,
      email: bank.contactEmail,
    });

    if (dealSite) {
      (dealSite as any).paymentDetails = {
        ...(dealSite as any).paymentDetails,
        paystackTransferRecipientCode: created.recipientCode,
      };
      await dealSite.save();
    }
    return created.recipientCode;
  }

  const created = await PaystackService.createTransferRecipient({
    name: bank.accountName,
    accountNumber: bank.accountNumber,
    bankCode: bank.bankCode,
    email: bank.contactEmail,
  });
  return created.recipientCode;
}

async function notifyHostPayoutSuccess(
  booking: any,
  amountNaira: number,
  transferReference: string
) {
  try {
    const owner = await DB.Models.User.findById(booking.ownerId)
      .select("firstName lastName email")
      .lean();
    if (!owner?.email) return;

    const html = `
      <p>Hi ${owner.firstName || "there"},</p>
      <p>Your shortlet booking payout has been sent.</p>
      <ul>
        <li><strong>Booking code:</strong> ${booking.bookingCode}</li>
        <li><strong>Amount:</strong> ₦${amountNaira.toLocaleString("en-NG")}</li>
        <li><strong>Transfer reference:</strong> ${transferReference}</li>
      </ul>
      <p>Funds should reflect in your settlement account shortly.</p>
    `;
    await sendEmail({
      to: owner.email,
      subject: `Shortlet payout sent — ${booking.bookingCode}`,
      html: generalEmailLayout(html),
      text: generalEmailLayout(html),
    });
  } catch (e) {
    console.warn("[ShortletHostPayout] Host payout email failed:", e);
  }
}

export async function processShortletHostPayoutForBooking(
  bookingId: string
): Promise<{ ok: boolean; status: HostDisbursementStatus; message?: string }> {
  const now = new Date();

  const booking = await DB.Models.Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: "confirmed",
      "meta.hostDisbursementStatus": { $in: ["pending", "failed_insufficient_balance"] },
      "meta.hostDisbursementEligibleAt": { $lte: now },
    },
    { $set: { "meta.hostDisbursementStatus": "processing" } },
    { new: true }
  ).lean();

  if (!booking) {
    return { ok: false, status: "pending", message: "Not eligible or already processing" };
  }

  const meta = (booking.meta || {}) as Record<string, unknown>;

  if (!meta.settlementModel) {
    if (booking.receiverMode?.type === "dealSite") {
      await DB.Models.Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            "meta.hostDisbursementStatus": "settled_via_subaccount",
            "meta.hostDisbursementNote":
              "Legacy split settlement — host paid via Paystack subaccount at checkout.",
          },
        }
      );
      return { ok: true, status: "settled_via_subaccount" };
    }
    await DB.Models.Booking.updateOne(
      { _id: booking._id },
      { $set: { "meta.settlementModel": "escrow" } }
    );
  } else if (meta.settlementModel === "split") {
    await DB.Models.Booking.updateOne(
      { _id: booking._id },
      { $set: { "meta.hostDisbursementStatus": "settled_via_subaccount" } }
    );
    return { ok: true, status: "settled_via_subaccount" };
  }

  if (meta.hostDisbursementTransferReference) {
    await DB.Models.Booking.updateOne(
      { _id: booking._id },
      { $set: { "meta.hostDisbursementStatus": "completed" } }
    );
    return { ok: true, status: "completed", message: "Already transferred" };
  }

  const payoutAmount = resolveHostPayoutAmount(meta);
  if (payoutAmount <= 0) {
    await DB.Models.Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          "meta.hostDisbursementStatus": "failed_transfer",
          "meta.hostDisbursementFailureReason": "Invalid payout amount",
        },
      }
    );
    return { ok: false, status: "failed_transfer", message: "Invalid payout amount" };
  }

  const bank = await resolveHostBankDetails(booking as any);
  if (!bank) {
    await DB.Models.Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          "meta.hostDisbursementStatus": "failed_no_bank",
          "meta.hostDisbursementFailureReason":
            "Host settlement bank details not found. Complete Deal Site payment setup.",
        },
      }
    );
    return { ok: false, status: "failed_no_bank" };
  }

  const transferReference =
    "HP" + Math.floor(Math.random() * 9e14 + 1e14).toString();

  try {
    const recipientCode = await getOrCreateRecipientCode(bank);

    const transfer = await PaystackService.initiateTransfer({
      amountNaira: payoutAmount,
      recipientCode,
      reason: `Shortlet host payout ${booking.bookingCode}`,
      reference: transferReference,
      metadata: {
        bookingId: String(booking._id),
        bookingCode: booking.bookingCode,
        hostPayout: payoutAmount,
      },
    });

    let finalStatus = transfer.status;
    if (finalStatus === "pending" || finalStatus === "otp") {
      const verified = await PaystackService.verifyTransfer(transferReference);
      if (verified?.status) finalStatus = verified.status;
    }

    const successStatuses = new Set(["success", "completed"]);
    if (!successStatuses.has(finalStatus)) {
      throw new Error(`Transfer status: ${finalStatus}`);
    }

    await DB.Models.NewTransaction.create({
      reference: transferReference,
      fromWho: { kind: "User", item: booking.ownerId },
      amount: payoutAmount,
      transactionType: "shortlet-host-payout",
      paymentMode: "transfer",
      status: "success",
      currency: "NGN",
      meta: {
        bookingId: String(booking._id),
        bookingCode: booking.bookingCode,
        transferCode: transfer.transfer_code,
        recipientCode,
      },
      transactionFlow: "external",
    });

    await DB.Models.Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          "meta.hostDisbursementStatus": "completed",
          "meta.hostDisbursementTransferReference": transferReference,
          "meta.hostDisbursementTransferCode": transfer.transfer_code,
          "meta.hostDisbursementPaidAt": new Date(),
          "meta.hostDisbursementAmount": payoutAmount,
        },
        $unset: { "meta.hostDisbursementFailureReason": "" },
      }
    );

    await BookingLogService.logActivity({
      bookingId: String(booking._id),
      propertyId: String(booking.propertyId),
      senderId: String(booking.ownerId),
      senderRole: "owner",
      senderModel: booking.ownerModel,
      message: `Host payout of ₦${payoutAmount.toLocaleString("en-NG")} initiated`,
      status: "completed",
      stage: "payment",
      meta: { transferReference, payoutAmount },
    });

    void notifyHostPayoutSuccess(booking, payoutAmount, transferReference);

    return { ok: true, status: "completed" };
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || "Transfer failed";
    const isBalance =
      /balance|insufficient/i.test(msg) || err?.response?.data?.code === "insufficient_balance";

    const failureStatus: HostDisbursementStatus = isBalance
      ? "failed_insufficient_balance"
      : "failed_transfer";

    await DB.Models.Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          "meta.hostDisbursementStatus": failureStatus,
          "meta.hostDisbursementFailureReason": msg,
        },
      }
    );

    await BookingLogService.logActivity({
      bookingId: String(booking._id),
      propertyId: String(booking.propertyId),
      senderId: String(booking.ownerId),
      senderRole: "owner",
      senderModel: booking.ownerModel,
      message: `Host payout failed: ${msg}`,
      status: "cancelled",
      stage: "payment",
      meta: { payoutAmount, failureStatus },
    });

    return { ok: false, status: failureStatus, message: msg };
  }
}

/**
 * Process all confirmed shortlet bookings past the check-in payout window.
 */
export async function processShortletHostPayouts(batchSize = 25): Promise<{
  processed: number;
  completed: number;
  failed: number;
  skippedLegacy: number;
}> {
  const now = new Date();
  const candidates = await DB.Models.Booking.find({
    status: "confirmed",
    "meta.hostDisbursementStatus": { $in: ["pending", "failed_insufficient_balance"] },
    "meta.hostDisbursementEligibleAt": { $lte: now },
  })
    .select("_id")
    .limit(batchSize)
    .lean();

  let completed = 0;
  let failed = 0;
  let skippedLegacy = 0;

  for (const row of candidates) {
    const result = await processShortletHostPayoutForBooking(String(row._id));
    if (result.status === "completed" || result.status === "settled_via_subaccount") {
      if (result.status === "settled_via_subaccount") skippedLegacy++;
      else completed++;
    } else if (
      result.status.startsWith("failed") &&
      result.status !== "pending"
    ) {
      failed++;
    }
  }

  return {
    processed: candidates.length,
    completed,
    failed,
    skippedLegacy,
  };
}
