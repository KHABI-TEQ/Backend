import { Response } from "express";
import { DB } from "../index";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { ICaseDoc, CaseStatus } from "../../models/case";
import { IPetitionDoc } from "../../models/petition";
import { ICaseCommunicationDoc } from "../../models/caseCommunication";
import { logCaseActivity } from "../../services/caseActivity.service";
import { notifyAllActiveAdmins } from "../../services/adminNotification.service";

export interface BuyerMilestone {
  stage: string;
  label: string;
  state: "done" | "current" | "upcoming";
  occurredAt?: string;
}

export interface BuyerCaseView {
  caseId: string;
  caseNumber: string;
  subject: string;
  transactionReference: string;
  currentStatus: string;
  milestones: BuyerMilestone[];
  pendingInfoRequests?: Array<{ id: string; message: string; sentAt: string }>;
}

/**
 * Server-authoritative serializer for buyer case view.
 * Ensures zero internal officer notes or EFCC private fields are leaked to buyer clients.
 */
export function toBuyerCaseView(
  caseDoc: ICaseDoc,
  petition: IPetitionDoc,
  communications?: ICaseCommunicationDoc[]
): BuyerCaseView {
  const STAGES: Array<{ stage: CaseStatus; label: string }> = [
    { stage: "petition_submitted", label: "Petition Submitted" },
    { stage: "case_opened", label: "Case Opened" },
    { stage: "mediation", label: "Mediation" },
    { stage: "transferred_to_efcc", label: "Transferred to EFCC" },
    { stage: "closed", label: "Case Closed" },
  ];

  const milestoneMap = new Map<string, Date>();
  (caseDoc.milestones || []).forEach((m) => {
    milestoneMap.set(m.stage, m.occurredAt);
  });

  const currentIndex = STAGES.findIndex((s) => s.stage === caseDoc.status);

  const milestones: BuyerMilestone[] = STAGES.map((s, i) => ({
    stage: s.stage,
    label: s.label,
    state: i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
    occurredAt: milestoneMap.get(s.stage)?.toISOString(),
  }));

  return {
    caseId: String(caseDoc._id),
    caseNumber: caseDoc.caseNumber,
    subject: petition ? petition.subject : "Transaction Dispute",
    transactionReference: caseDoc.transactionReference,
    currentStatus: caseDoc.status,
    milestones,
    pendingInfoRequests: (communications || [])
      .filter((c) => c.type === "information_request" && c.responseStatus === "awaiting")
      .map((c) => ({
        id: String(c._id),
        message: c.message,
        sentAt: c.sentAt ? c.sentAt.toISOString() : new Date().toISOString(),
      })),
  };
}

/**
 * @swagger
 * /buyer/cases:
 *   get:
 *     tags:
 *       - Buyer
 *       - Buyer > Cases
 *     summary: List all cases belonging to the authenticated buyer
 *     description: Returns a sanitized, buyer-safe list of active and historical dispute cases linked to the buyer's petitions. Omits internal officer notes and confidential referral details.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of buyer cases retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Buyer cases retrieved successfully" }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       caseId: { type: string }
 *                       caseNumber: { type: string }
 *                       subject: { type: string }
 *                       transactionReference: { type: string }
 *                       currentStatus: { type: string }
 *                       milestones:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             stage: { type: string }
 *                             label: { type: string }
 *                             state: { type: string, enum: [done, current, upcoming] }
 *                             occurredAt: { type: string }
 *       401:
 *         description: Buyer authentication required
 *       500:
 *         description: Internal server error
 */
export const listMyCases = async (req: AppRequest, res: Response) => {
  try {
    const buyer = req.buyer;
    if (!buyer) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({ success: false, message: "Buyer authentication required" });
    }

    const petitions = await DB.Models.Petition.find({
      buyerId: buyer._id,
      caseId: { $exists: true, $ne: null },
    }).lean();

    if (!petitions.length) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "No active or past cases found",
        data: [],
      });
    }

    const petitionMap = new Map(petitions.map((p) => [String(p.caseId), p]));
    const caseIds = petitions.map((p) => p.caseId);

    const cases = await DB.Models.Case.find({ _id: { $in: caseIds } })
      .sort({ lastActivityAt: -1 })
      .lean();

    const caseViews = cases.map((c) => {
      const petition = petitionMap.get(String(c._id));
      return toBuyerCaseView(c as any, petition as any);
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Buyer cases retrieved successfully",
      data: caseViews,
    });
  } catch (error: any) {
    console.error("[BuyerCases] Error in listMyCases:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to list buyer cases",
    });
  }
};

/**
 * @swagger
 * /buyer/cases/{id}:
 *   get:
 *     tags:
 *       - Buyer
 *       - Buyer > Cases
 *     summary: Get buyer-safe case details
 *     description: Returns detailed timeline, current stage milestones, and any pending officer information requests awaiting buyer reply. Strictly excludes internal LASRERA mediation notes and EFCC transmission details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: MongoDB ID of the case
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Case details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Case details retrieved successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     caseId: { type: string }
 *                     caseNumber: { type: string }
 *                     subject: { type: string }
 *                     transactionReference: { type: string }
 *                     currentStatus: { type: string }
 *                     milestones:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           stage: { type: string }
 *                           label: { type: string }
 *                           state: { type: string, enum: [done, current, upcoming] }
 *                           occurredAt: { type: string }
 *                     pendingInfoRequests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           message: { type: string }
 *                           sentAt: { type: string }
 *       401:
 *         description: Buyer authentication required
 *       403:
 *         description: Case does not belong to the authenticated buyer
 *       404:
 *         description: Case not found
 *       500:
 *         description: Internal server error
 */
export const getMyCaseById = async (req: AppRequest, res: Response) => {
  try {
    const buyer = req.buyer;
    const { id } = req.params;

    const caseDoc = await DB.Models.Case.findById(id).lean();
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    const petition = await DB.Models.Petition.findOne({
      _id: caseDoc.petitionId,
      buyerId: buyer?._id,
    }).lean();

    if (!petition) {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        message: "You are not authorized to view this case",
      });
    }

    const communications = await DB.Models.CaseCommunication.find({
      caseId: caseDoc._id,
    }).lean();

    const view = toBuyerCaseView(caseDoc as any, petition as any, communications as any);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Case details retrieved successfully",
      data: view,
    });
  } catch (error: any) {
    console.error("[BuyerCases] Error in getMyCaseById:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to fetch case",
    });
  }
};

/**
 * @swagger
 * /buyer/cases/{id}/communications/{commId}/respond:
 *   post:
 *     tags:
 *       - Buyer
 *       - Buyer > Cases
 *     summary: Respond to an officer information request
 *     description: Submits a formal buyer reply and optional supporting documents in response to an outstanding LASRERA officer information request. Updates the request status to responded, records inbound communication, updates case activity, and sends an in-app alert to all active admins.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: MongoDB ID of the case
 *         schema:
 *           type: string
 *       - name: commId
 *         in: path
 *         required: true
 *         description: MongoDB ID of the communication (information request) being answered
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 3000
 *                 example: "Here is the signed bank statement and proof of wire transfer confirming the payment on August 15."
 *                 description: Detailed response message from the buyer
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - fileName
 *                     - url
 *                   properties:
 *                     fileName:
 *                       type: string
 *                       example: "wire_transfer_confirmation.pdf"
 *                     url:
 *                       type: string
 *                       example: "https://res.cloudinary.com/example/wire_transfer_confirmation.pdf"
 *     responses:
 *       201:
 *         description: Buyer response recorded and dispatched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Response submitted successfully to LASRERA officers" }
 *                 data: { type: object }
 *       400:
 *         description: Invalid input or request body
 *       401:
 *         description: Buyer authentication required
 *       403:
 *         description: Case does not belong to the authenticated buyer
 *       404:
 *         description: Case or communication request not found
 *       500:
 *         description: Internal server error
 */
export const respondToInfoRequest = async (req: AppRequest, res: Response) => {
  try {
    const buyer = req.buyer;
    const { id, commId } = req.params;
    const { message, attachments } = req.body;

    const caseDoc = await DB.Models.Case.findById(id);
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    const petition = await DB.Models.Petition.findOne({
      _id: caseDoc.petitionId,
      buyerId: buyer?._id,
    }).lean();

    if (!petition) {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        message: "You are not authorized to respond to this case",
      });
    }

    const originalRequest = await DB.Models.CaseCommunication.findOne({
      _id: commId,
      caseId: caseDoc._id,
      direction: "outbound",
      type: "information_request",
    });

    if (!originalRequest) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Information request communication record not found",
      });
    }

    const now = new Date();
    // Update original request
    originalRequest.responseStatus = "responded";
    originalRequest.respondedAt = now;
    await originalRequest.save();

    // Create inbound response
    const inboundComm = await DB.Models.CaseCommunication.create({
      caseId: caseDoc._id,
      direction: "inbound",
      type: "buyer_response",
      parentId: originalRequest._id,
      recipientEmail: process.env.LASRERA_CASE_REPLY_EMAIL || "disputes@lasrera.lagosstate.gov.ng",
      recipientName: "LASRERA Dispute Directorate",
      subject: `RE: ${originalRequest.subject}`,
      message,
      sentAt: now,
      deliveryStatus: "sent",
      responseStatus: "not_required",
    });

    // Update case activity timestamp
    caseDoc.lastActivityAt = now;
    await caseDoc.save();

    // Log activity
    await logCaseActivity({
      caseId: caseDoc._id,
      registrationId: caseDoc.registrationId,
      actorType: "Buyer",
      actorId: buyer?._id,
      actorLabel: petition.buyer?.fullName || "Buyer",
      action: "BUYER_RESPONDED",
      visibility: "buyer",
      message: `Buyer responded to information request for Case #${caseDoc.caseNumber}`,
      meta: { communicationId: inboundComm._id, parentId: originalRequest._id, attachmentsCount: attachments?.length || 0 },
    });

    // In-app alert to all active admins
    await notifyAllActiveAdmins({
      title: `Buyer Responded: Case #${caseDoc.caseNumber}`,
      message: `${petition.buyer?.fullName || "Buyer"} provided information in response to LASRERA inquiry.`,
      type: "general",
      meta: { caseId: String(caseDoc._id), caseNumber: caseDoc.caseNumber },
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Response submitted successfully to LASRERA officers",
      data: inboundComm,
    });
  } catch (error: any) {
    console.error("[BuyerCases] Error in respondToInfoRequest:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to submit response",
    });
  }
};
