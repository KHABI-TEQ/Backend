import { Request, Response } from "express";
import { DB } from "../../index";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { logCaseActivity } from "../../../services/caseActivity.service";
import sendEmail from "../../../common/send.email";
import { caseClosedMail } from "../../../common/emailTemplates/caseMails";

/**
 * @swagger
 * /admin/cases/{id}/close:
 *   post:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Formally conclude and close a case
 *     description: Formally concludes an active dispute case with a registered outcome and administrative summary. Sets case status to closed, appends closing milestone, logs audit trail, and notifies the buyer via email.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: MongoDB ID of the case to close
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - outcome
 *               - summary
 *             properties:
 *               outcome:
 *                 type: string
 *                 enum: [resolved, withdrawn, dismissed, referred_closed]
 *                 example: resolved
 *                 description: Final disposition outcome of the case
 *               summary:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *                 example: "Dispute amicably settled. The developer completed documentation delivery and refunded excess charges."
 *                 description: Administrative summary detailing how the case was concluded
 *     responses:
 *       200:
 *         description: Case closed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Case #CAS-2026-00001 closed successfully" }
 *                 data: { type: object }
 *       400:
 *         description: Invalid input or case is already closed
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions (requires CASE_CLOSE)
 *       404:
 *         description: Case not found
 *       500:
 *         description: Server error
 */
export const closeCase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { outcome, summary } = req.body;
    const adminUser = req.admin;

    const caseDoc = await DB.Models.Case.findById(id);
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    if (caseDoc.status === "closed") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Case is already closed",
      });
    }

    const now = new Date();
    caseDoc.status = "closed";
    caseDoc.closedAt = now;
    caseDoc.lastActivityAt = now;
    caseDoc.closure = {
      outcome,
      summary,
      closedBy: adminUser?._id,
    };

    caseDoc.milestones.push({
      stage: "closed",
      occurredAt: now,
      by: adminUser?._id,
    });

    await caseDoc.save();

    await logCaseActivity({
      caseId: caseDoc._id,
      registrationId: caseDoc.registrationId,
      actorType: "Admin",
      actorId: adminUser?._id,
      actorLabel: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "LASRERA Officer",
      action: "CASE_CLOSED",
      visibility: "buyer",
      message: `Case closed with outcome '${outcome}': ${summary}`,
      meta: { outcome, summary },
    });

    // Notify buyer
    const petition = await DB.Models.Petition.findById(caseDoc.petitionId).lean();
    if (petition?.buyer?.email) {
      try {
        await sendEmail({
          to: petition.buyer.email,
          subject: `Case Concluded: #${caseDoc.caseNumber}`,
          text: `Your dispute case #${caseDoc.caseNumber} has been closed by LASRERA.`,
          html: caseClosedMail(petition.buyer.fullName, caseDoc.caseNumber),
        });
      } catch (mailErr: any) {
        console.warn("[AdminCaseClose] Failed to send closure email:", mailErr.message);
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Case #${caseDoc.caseNumber} closed successfully`,
      data: caseDoc,
    });
  } catch (error: any) {
    console.error("[AdminCaseClose] Error in closeCase:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to close case",
    });
  }
};
