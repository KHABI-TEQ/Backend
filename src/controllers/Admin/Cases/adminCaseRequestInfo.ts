import { Request, Response } from "express";
import { DB } from "../../index";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import sendEmail from "../../../common/send.email";
import { caseInfoRequestMail } from "../../../common/emailTemplates/caseMails";
import { logCaseActivity } from "../../../services/caseActivity.service";

/**
 * @swagger
 * /admin/cases/{id}/request-information/preview:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases > Communications
 *     summary: Preview information request email
 *     description: Returns a preview of the email that would be sent to the buyer — including the replyTo address, buyer details, and case reference — before actually dispatching it.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Preview data returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 to: { type: string }
 *                 replyTo: { type: string }
 *                 caseNumber: { type: string }
 *                 buyerName: { type: string }
 *       404:
 *         description: Case or petition not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_REQUEST_INFO permission
 */
export const previewRequestInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseDoc = await DB.Models.Case.findById(id).lean();
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    const petition = await DB.Models.Petition.findById(caseDoc.petitionId).lean();
    if (!petition) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Petition not found" });
    }

    const recipient = {
      name: petition.buyer.fullName,
      email: petition.buyer.email,
    };
    const subject = `Request for Additional Information — Case #${caseDoc.caseNumber}`;
    const defaultMessage = `Dear ${petition.buyer.fullName},\n\nLASRERA is currently reviewing your petition regarding Case #${caseDoc.caseNumber}.\n\nTo assist the dispute resolution panel, please provide further details or documentation regarding your transaction claim.\n\nThank you,\nLASRERA Dispute Resolution Directorate`;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Request preview generated",
      data: {
        caseNumber: caseDoc.caseNumber,
        recipient,
        subject,
        defaultMessage,
      },
    });
  } catch (error: any) {
    console.error("[AdminRequestInfo] Error in previewRequestInfo:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to preview request info",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/request-information:
 *   post:
 *     tags:
 *       - Admin
 *       - Admin > Cases > Communications
 *     summary: Send information request to buyer
 *     description: |
 *       Sends a formal information request email to the buyer and records a `CaseCommunication` document.
 *       - The `replyTo` header is set to `LASRERA_CASE_REPLY_EMAIL` so buyer replies are monitored.
 *       - The `providerMessageId` from the email provider is stored for delivery tracking.
 *       - Buyer sees the request as a pending item in their case view.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 3000
 *                 example: Please provide a bank transfer confirmation statement.
 *     responses:
 *       201:
 *         description: Information request sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     commId: { type: string }
 *                     deliveryStatus: { type: string, enum: [sent, failed] }
 *                     providerMessageId: { type: string }
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_REQUEST_INFO permission
 */
export const sendRequestInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const adminUser = req.admin;

    const caseDoc = await DB.Models.Case.findById(id);
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    if (caseDoc.status === "closed") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Cannot request information on a closed case",
      });
    }

    const petition = await DB.Models.Petition.findById(caseDoc.petitionId).lean();
    if (!petition || !petition.buyer?.email) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Buyer contact email not found on case petition",
      });
    }

    const subject = `Request for Additional Information — Case #${caseDoc.caseNumber}`;
    const html = caseInfoRequestMail({
      buyerFirstName: petition.buyer.fullName.split(" ")[0] || petition.buyer.fullName,
      caseNumber: caseDoc.caseNumber,
      officerMessage: message,
    });

    let providerMessageId: string | undefined;
    let deliveryStatus: "sent" | "failed" = "sent";
    let deliveryError: string | undefined;

    try {
      providerMessageId = await sendEmail({
        to: petition.buyer.email,
        // to: "habeebllah77@gmail.com",
        subject,
        text: message,
        html,
        replyTo: process.env.LASRERA_CASE_REPLY_EMAIL,
      });
    } catch (err: any) {
      deliveryStatus = "failed";
      deliveryError = err.message || "Email dispatch failed";
      console.error("[AdminRequestInfo] Email send error:", err);
    }

    const communication = await DB.Models.CaseCommunication.create({
      caseId: caseDoc._id,
      direction: "outbound",
      type: "information_request",
      officer: adminUser?._id,
      recipientEmail: petition.buyer.email,
      recipientName: petition.buyer.fullName,
      subject,
      message,
      sentAt: new Date(),
      deliveryStatus,
      deliveryError,
      providerMessageId,
      responseStatus: deliveryStatus === "sent" ? "awaiting" : "not_required",
    });

    caseDoc.lastActivityAt = new Date();
    await caseDoc.save();

    await logCaseActivity({
      caseId: caseDoc._id,
      registrationId: caseDoc.registrationId,
      actorType: "Admin",
      actorId: adminUser?._id,
      actorLabel: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "LASRERA Officer",
      action: "INFORMATION_REQUESTED",
      visibility: "buyer",
      message: `Information requested from ${petition.buyer.fullName}`,
      meta: { communicationId: communication._id, deliveryStatus },
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: deliveryStatus === "sent" ? "Information request sent to buyer" : "Request recorded, but email failed",
      data: communication,
    });
  } catch (error: any) {
    console.error("[AdminRequestInfo] Error in sendRequestInfo:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to send request information",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/communications/{commId}/mark-responded:
 *   patch:
 *     tags:
 *       - Admin
 *       - Admin > Cases > Communications
 *     summary: Manually mark a communication as responded
 *     description: Used when the buyer responds via email reply (outside the app) and the officer wants to record the response manually in the system.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Case ObjectId
 *         schema: { type: string }
 *       - name: commId
 *         in: path
 *         required: true
 *         description: CaseCommunication ObjectId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Communication marked as responded
 *       404:
 *         description: Communication not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_REQUEST_INFO permission
 */
export const markCommunicationResponded = async (req: Request, res: Response) => {
  try {
    const { id, commId } = req.params;
    const communication = await DB.Models.CaseCommunication.findOne({
      _id: commId,
      caseId: id,
    });

    if (!communication) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Communication record not found",
      });
    }

    communication.responseStatus = "responded";
    communication.respondedAt = new Date();
    await communication.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Communication marked as responded",
      data: communication,
    });
  } catch (error: any) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to update communication",
    });
  }
};
