import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { sendTransactionRegistrationFollowUpEmail } from "../../../services/transactionConfirmationCron.service";
import { BUYER_CONFIRM_FLOW_INSPECTION_STATUSES } from "../../../constants/buyerInspectionConfirmationFlow";
import {
  CONFIRM_TOKEN_PURPOSE_TRANSACTION,
  verifyBuyerConfirmationToken,
} from "../../../services/buyerConfirmationToken.service";
import { InspectionLogService } from "../../../services/inspectionLog.service";

const CLIENT_LINK = (process.env.CLIENT_LINK || "").replace(/\/$/, "");
const REGISTER_URL = CLIENT_LINK ? `${CLIENT_LINK}/transaction-registration` : "#";

const ELIGIBLE_CONFIRM_STATUSES = new Set<string>(BUYER_CONFIRM_FLOW_INSPECTION_STATUSES);

/**
 * GET /inspections/confirm-transaction?token=xxx
 * Public. Buyer confirms a transaction took place (email from transaction confirmation cron, 3+ days after slot).
 * Sends transaction-registration follow-up on first use. Does not close the inspection (that is the inspection confirmation step).
 */
export const confirmTransaction = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = (req.query.token as string)?.trim();
    if (!token) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>Missing token. Please use the link from your email.</p></body></html>"
      );
      return;
    }

    const decoded = verifyBuyerConfirmationToken(token);
    if (!decoded) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>Invalid or expired link. Please request a new confirmation email if needed.</p></body></html>"
      );
      return;
    }

    if (decoded.purpose !== CONFIRM_TOKEN_PURPOSE_TRANSACTION) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>This link is for a different step. Please open the <strong>transaction</strong> confirmation email from Khabiteq.</p></body></html>"
      );
      return;
    }

    const inspection = await DB.Models.InspectionBooking.findById(decoded.inspectionId)
      .populate("requestedBy")
      .populate("propertyId")
      .lean();

    if (!inspection) {
      res.status(HttpStatusCodes.NOT_FOUND).send(
        "<html><body><p>Inspection not found.</p></body></html>"
      );
      return;
    }

    const buyer = inspection.requestedBy as any;
    const property = inspection.propertyId as any;
    if (!buyer?.email || !property?._id) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>Buyer contact not found for this inspection.</p></body></html>"
      );
      return;
    }

    const inv = inspection as any;
    const status = String(inv.status || "");

    if (!ELIGIBLE_CONFIRM_STATUSES.has(status)) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>This link is no longer valid for this inspection. If you need help, please contact support.</p></body></html>"
      );
      return;
    }

    const alreadyConfirmed = !!inv.buyerConfirmedTransactionAt;

    if (!alreadyConfirmed) {
      const now = new Date();
      await DB.Models.InspectionBooking.updateOne(
        { _id: decoded.inspectionId },
        { $set: { buyerConfirmedTransactionAt: now } }
      );

      try {
        await InspectionLogService.logActivity({
          inspectionId: String(decoded.inspectionId),
          propertyId: String(property._id),
          senderId: String(buyer._id),
          senderModel: "Buyer",
          senderRole: "buyer",
          message: "Buyer confirmed that a property transaction took place (transaction confirmation link).",
          status,
          stage: inv.stage,
          meta: { event: "buyer_confirmed_transaction" },
        });
      } catch (logErr) {
        console.warn("[confirmTransaction] log failed:", logErr);
      }

      try {
        await sendTransactionRegistrationFollowUpEmail(
          buyer.email,
          buyer.fullName || buyer.email,
          {
            propertyId: String(property._id),
            inspectionId: String(decoded.inspectionId),
          }
        );
      } catch (emailErr) {
        console.warn("[confirmTransaction] Follow-up email failed:", emailErr);
      }
    }

    const registerLink = REGISTER_URL
      ? `<a href="${REGISTER_URL}" style="color: #2563eb;">Register your transaction here</a>`
      : "your transaction registration page";

    res.status(HttpStatusCodes.OK).send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><title>Transaction confirmed</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px;">
          <h2>Thank you for confirming</h2>
          <p>We have recorded your confirmation that the transaction took place.</p>
          <p>We have sent you an email with a link to register your transaction and information about the benefits of registration. Please check your inbox (and spam folder).</p>
          <p>You can also ${registerLink} at any time.</p>
          <p>Best regards,<br/><strong>Khabi-Teq</strong></p>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
};
