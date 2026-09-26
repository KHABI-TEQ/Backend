import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { parseInspectionScheduledAt } from "../utils/inspectionSchedule";
import { clientAbsoluteUrl } from "../utils/seekerJourney";
import { getPropertyTitleFromLocation } from "../utils/helper";
import { createBuyerInboxNotification } from "./buyerNotification.service";

const CANCELLED = new Set(["cancelled", "agent_rejected", "transaction_failed"]);
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const CRON_BATCH_LIMIT = 150;

export async function processProceedToTransactionPrompts(): Promise<{ sent: number }> {
  const now = Date.now();
  const candidates = await DB.Models.InspectionBooking.find({
    $and: [
      {
        $or: [
          { proceedToTransactionPromptSentAt: { $exists: false } },
          { proceedToTransactionPromptSentAt: null },
        ],
      },
      { status: { $nin: Array.from(CANCELLED) } },
    ],
  })
    .sort({ inspectionDate: 1 })
    .limit(CRON_BATCH_LIMIT)
    .populate("propertyId", "location propertyType")
    .populate("requestedBy", "email fullName")
    .lean();

  let sent = 0;

  for (const insp of candidates) {
    try {
      const slot = parseInspectionScheduledAt(
        insp.inspectionDate as Date,
        String((insp as any).inspectionTime || "")
      );
      if (!slot) continue;
      if (now < slot.getTime() + TWO_HOURS_MS) continue;

      const claimed = await DB.Models.InspectionBooking.findOneAndUpdate(
        {
          _id: insp._id,
          $or: [
            { proceedToTransactionPromptSentAt: { $exists: false } },
            { proceedToTransactionPromptSentAt: null },
          ],
        },
        { $set: { proceedToTransactionPromptSentAt: new Date() } },
        { new: true }
      );
      if (!claimed) continue;

      const buyer = (insp as any).requestedBy;
      const buyerId = String(buyer?._id || insp.bookedBy || insp.requestedBy || "");
      const email = String(buyer?.email || "").trim();
      const name = String(buyer?.fullName || "there");
      const property = (insp as any).propertyId;
      const location =
        getPropertyTitleFromLocation(property?.location) ||
        property?.propertyType ||
        "your inspected property";
      const path = `/buyer/inspections/${insp._id}`;
      const buttonUrl = clientAbsoluteUrl(path);

      if (email && email !== "unknown@example.com") {
        const html = generalEmailLayout(`
          <p>Hi <strong>${name}</strong>,</p>
          <p>It has been two hours since your agreed inspection time for <strong>${location}</strong>.</p>
          <p>Do you want to proceed with this property toward transaction registration?</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${buttonUrl}" style="background-color:#09391C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:5px;font-size:16px;">
              Tell us if you want to proceed
            </a>
          </div>
          <p style="font-size:13px;color:#5A5D63;">If you are signed out, you will be asked to log in first.</p>
        `);
        await sendEmail({
          to: email,
          subject: "Do you want to proceed with this property?",
          html,
          text: `Hi ${name}, it has been two hours since your inspection for ${location}. Decide here: ${buttonUrl}`,
          skipBuyerInbox: true,
        });
      }

      if (buyerId) {
        await createBuyerInboxNotification({
          buyerId,
          title: "Do you want to proceed with this property?",
          message: `Your inspection for ${location} was two hours ago. Choose whether to proceed to due diligence and transaction registration.`,
          type: "inspection",
          meta: {
            source: "system",
            audience: "buyer",
            screen: "inspection",
            inspectionId: String(insp._id),
            actionPath: path,
          },
        });
      }

      sent += 1;
    } catch (e) {
      console.warn(
        "[proceedPrompt] Failed for inspection",
        String((insp as any)._id),
        e
      );
    }
  }

  return { sent };
}
