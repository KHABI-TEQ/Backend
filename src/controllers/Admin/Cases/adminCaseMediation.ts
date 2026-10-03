import { Request, Response } from "express";
import { DB } from "../../index";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { toAuthorizedCertificateView } from "../../../services/transactionCertificateRecord.service";
import { logCaseActivity } from "../../../services/caseActivity.service";

/**
 * @swagger
 * /admin/cases/{id}/mediation:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases > Mediation
 *     summary: Get mediation workspace panel
 *     description: Returns all mediation notes for this case along with case details and the linked petition for officer reference.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Case MongoDB ObjectId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Mediation panel retrieved successfully
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_MEDIATE permission
 */
export const getMediationPanel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseDoc = await DB.Models.Case.findById(id)
      .populate("assignedOfficer", "firstName lastName email")
      .lean();

    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Case not found",
      });
    }

    const [petition, registration, notes] = await Promise.all([
      DB.Models.Petition.findById(caseDoc.petitionId).lean(),
      DB.Models.TransactionRegistration.findById(caseDoc.registrationId).lean(),
      DB.Models.CaseMediationNote.find({ caseId: caseDoc._id })
        .populate("officer", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const certView = registration ? toAuthorizedCertificateView(registration as any) : null;

    // Build Transaction Summary
    const transactionSummary = {
      property: {
        code: certView?.propertyCode || null,
        type: certView?.propertyType || null,
        location: certView?.propertyLocation || null,
      },
      buyer: petition?.buyer || null,
      respondent: petition?.respondent || null,
      practitioners: certView?.participatingProfessionals || [],
      transactionValue: (certView as any)?.transactionValue || (registration as any)?.transactionValue || petition?.amountInvolved || 0,
      paymentRecord: certView?.paymentRecord || [],
      finalPaymentStatus: (registration as any)?.paymentStatus || (certView?.paymentRecord?.length ? "Recorded" : "Unknown"),
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Mediation panel data retrieved successfully",
      data: {
        case: caseDoc,
        transactionSummary,
        digitalTransactionTrail: certView?.journey || [],
        petitionNote: {
          subject: petition?.subject,
          description: petition?.description,
          amountInvolved: petition?.amountInvolved,
          attachments: petition?.attachments || [],
          submittedAt: petition?.submittedAt,
        },
        mediationNotes: notes,
      },
    });
  } catch (error: any) {
    console.error("[AdminMediation] Error in getMediationPanel:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to load mediation panel",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/mediation:
 *   post:
 *     tags:
 *       - Admin
 *       - Admin > Cases > Mediation
 *     summary: Save a mediation note
 *     description: |
 *       Appends a mediation note to the case record. Notes are **append-only** — no edit or delete.
 *
 *       If the case is currently in `case_opened` status, it is automatically
 *       advanced to `mediation` upon saving the first note.
 *
 *       At least one of `meetingNotes`, `partyResponses`, `proposedResolution`, or `outcome` is required.
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
 *             properties:
 *               meetingNotes:
 *                 type: string
 *                 maxLength: 5000
 *                 example: Session held on 2026-10-03. Both parties present.
 *               partyResponses:
 *                 type: string
 *                 maxLength: 5000
 *               proposedResolution:
 *                 type: string
 *                 maxLength: 5000
 *               outcome:
 *                 type: string
 *                 maxLength: 2000
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fileName: { type: string }
 *                     url: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Mediation note saved successfully
 *       400:
 *         description: Validation error — at least one text field required
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_MEDIATE permission
 */
export const saveMediationNote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { meetingNotes, partyResponses, proposedResolution, outcome, attachments } = req.body;
    const adminUser = req.admin;

    const caseDoc = await DB.Models.Case.findById(id);
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Case not found",
      });
    }

    if (caseDoc.status === "closed") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Cannot add mediation notes to a closed case",
      });
    }

    const note = await DB.Models.CaseMediationNote.create({
      caseId: caseDoc._id,
      officer: adminUser?._id,
      meetingNotes,
      partyResponses,
      proposedResolution,
      outcome,
      attachments: attachments || [],
    });

    const now = new Date();
    caseDoc.lastActivityAt = now;

    // If case was just opened, automatically advance stage to mediation
    if (caseDoc.status === "case_opened") {
      caseDoc.status = "mediation";
      caseDoc.milestones.push({
        stage: "mediation",
        occurredAt: now,
        by: adminUser?._id,
      });
    }

    await caseDoc.save();

    await logCaseActivity({
      caseId: caseDoc._id,
      registrationId: caseDoc.registrationId,
      actorType: "Admin",
      actorId: adminUser?._id,
      actorLabel: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "LASRERA Officer",
      action: "MEDIATION_NOTE_ADDED",
      visibility: "internal",
      message: `Mediation note saved by ${adminUser?.firstName || "Officer"}`,
      meta: { noteId: note._id, outcome: outcome || null },
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Mediation note recorded successfully",
      data: {
        note,
        case: caseDoc,
      },
    });
  } catch (error: any) {
    console.error("[AdminMediation] Error in saveMediationNote:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to save mediation note",
    });
  }
};
