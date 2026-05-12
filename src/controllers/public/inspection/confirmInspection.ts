import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { BUYER_CONFIRM_FLOW_INSPECTION_STATUSES } from "../../../constants/buyerInspectionConfirmationFlow";
import {
  CONFIRM_TOKEN_PURPOSE_INSPECTION,
  verifyBuyerConfirmationToken,
} from "../../../services/buyerConfirmationToken.service";
import { sendInspectionRateReportEmailToBuyer } from "../../../services/inspectionWorkflow.service";
import { InspectionLogService } from "../../../services/inspectionLog.service";

const ELIGIBLE = new Set<string>(BUYER_CONFIRM_FLOW_INSPECTION_STATUSES);

const OPEN_FOR_BUYER_CLOSE_VIEWING = [
  "inspection_approved",
  "pending_transaction",
  "active_negotiation",
  "negotiation_accepted",
];

function viewingAlreadyClosed(inv: { status?: string; stage?: string }): boolean {
  return inv.stage === "completed" && inv.status === "completed";
}

/**
 * GET /inspections/confirm-inspection?token=xxx
 * Public. Buyer confirms the scheduled inspection took place (email from inspection confirmation cron, 1+ day after slot).
 * May close the viewing and trigger rate/report email when not already closed by a field agent.
 */
export const confirmInspection = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const token = (req.query.token as string)?.trim();
    if (!token) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>Missing token. Please use the link from your email.</p></body></html>"
      );
      return;
    }

    const decoded = verifyBuyerConfirmationToken(token);
    if (!decoded || decoded.purpose !== CONFIRM_TOKEN_PURPOSE_INSPECTION) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>Invalid or expired link. Please use the latest email from us.</p></body></html>"
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
        "<html><body><p>Buyer or property not found for this inspection.</p></body></html>"
      );
      return;
    }

    const inv = inspection as any;
    const status = String(inv.status || "");

    if (!ELIGIBLE.has(status)) {
      res.status(HttpStatusCodes.BAD_REQUEST).send(
        "<html><body><p>This link is no longer valid for this inspection.</p></body></html>"
      );
      return;
    }

    const alreadyConfirmedInspection = !!inv.buyerConfirmedInspectionAt;
    const wasViewingClosed = viewingAlreadyClosed(inv);
    const shouldCloseViewingViaBuyer =
      !wasViewingClosed && status !== "completed" && OPEN_FOR_BUYER_CLOSE_VIEWING.includes(status);

    if (!alreadyConfirmedInspection) {
      const now = new Date();
      const existingReport =
        inv.inspectionReport && typeof inv.inspectionReport === "object" ? inv.inspectionReport : {};

      if (shouldCloseViewingViaBuyer) {
        await DB.Models.InspectionBooking.updateOne(
          { _id: decoded.inspectionId },
          {
            $set: {
              buyerConfirmedInspectionAt: now,
              status: "completed",
              stage: "completed",
              inspectionReport: {
                ...existingReport,
                buyerPresent: true,
                sellerPresent: true,
                status: "completed",
                wasSuccessful: true,
                notes:
                  (existingReport as any).notes ||
                  "Buyer confirmed scheduled inspection took place via inspection confirmation link.",
                submittedAt: (existingReport as any).submittedAt || now,
              },
            },
          }
        );

        try {
          await sendInspectionRateReportEmailToBuyer(String(decoded.inspectionId));
        } catch (rateErr) {
          console.warn("[confirmInspection] Rate/report email failed:", rateErr);
        }
      } else {
        await DB.Models.InspectionBooking.updateOne(
          { _id: decoded.inspectionId },
          { $set: { buyerConfirmedInspectionAt: now } }
        );
      }

      try {
        await InspectionLogService.logActivity({
          inspectionId: String(decoded.inspectionId),
          propertyId: String(property._id),
          senderId: String(buyer._id),
          senderModel: "Buyer",
          senderRole: "buyer",
          message: wasViewingClosed
            ? "Buyer confirmed inspection took place (viewing was already closed on platform; timestamp recorded)."
            : shouldCloseViewingViaBuyer
              ? "Buyer confirmed inspection took place; viewing closed and rate/report notification sent."
              : "Buyer confirmed inspection took place (timestamp recorded).",
          status,
          stage: shouldCloseViewingViaBuyer ? "completed" : inv.stage,
          meta: { event: "buyer_confirmed_inspection", closedViewingViaLink: shouldCloseViewingViaBuyer },
        });
      } catch (logErr) {
        console.warn("[confirmInspection] log failed:", logErr);
      }
    }

    res.status(HttpStatusCodes.OK).send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><title>Inspection confirmed</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px;">
          <h2>Thank you</h2>
          <p>We have recorded your confirmation that the inspection took place.</p>
          ${
            !alreadyConfirmedInspection && shouldCloseViewingViaBuyer
              ? "<p>You should receive a separate email with links to <strong>rate your experience</strong> and optionally <strong>report the agent</strong> for this inspection.</p>"
              : ""
          }
          <p>You will receive a separate message later about confirming a <strong>transaction</strong> (if applicable).</p>
          <p>Best regards,<br/><strong>Khabi-Teq</strong></p>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
};
