import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import {
  verifyConfirmationToken,
  sendTransactionRegistrationFollowUpEmail,
} from "../../../services/transactionConfirmationCron.service";

const CLIENT_LINK = (process.env.CLIENT_LINK || "").replace(/\/$/, "");
const REGISTER_URL = CLIENT_LINK ? `${CLIENT_LINK}/transaction-registration` : "#";

/**
 * GET /inspection/confirm-transaction?token=xxx
 * Public. Called when the buyer clicks "Confirm transaction took place" in the email sent 3 days after the inspection.
 * Verifies the token, marks the inspection as confirmed, sends a follow-up email asking the buyer to register the transaction (with benefits), and returns an HTML thank-you page.
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

    const decoded = verifyConfirmationToken(token);
    if (!decoded) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>Invalid or expired link. Please request a new confirmation email if needed.</p></body></html>"
      );
      return;
    }

    const inspection = await DB.Models.InspectionBooking.findById(decoded.inspectionId)
      .populate("requestedBy")
      .lean();

    if (!inspection) {
      res.status(HttpStatusCodes.NOT_FOUND).send(
        "<html><body><p>Inspection not found.</p></body></html>"
      );
      return;
    }

    const buyer = inspection.requestedBy as any;
    if (!buyer?.email) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>Buyer contact not found for this inspection.</p></body></html>"
      );
      return;
    }

    // Idempotent: if already confirmed, still send success page and optionally resend email (we skip resend if already confirmed to avoid spam)
    const alreadyConfirmed = !!(inspection as any).buyerConfirmedTransactionAt;

    if (!alreadyConfirmed) {
      await DB.Models.InspectionBooking.updateOne(
        { _id: decoded.inspectionId },
        { $set: { buyerConfirmedTransactionAt: new Date() } }
      );

      try {
        await sendTransactionRegistrationFollowUpEmail(
          buyer.email,
          buyer.fullName || buyer.email
        );
      } catch (emailErr) {
        console.warn("[confirmTransaction] Follow-up email failed:", emailErr);
        // Still show success page
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
          <p>Best regards,<br/><strong>Khabiteq Realty</strong></p>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
};
