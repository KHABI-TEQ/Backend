import { Request, Response } from "express";
import { DB } from "../../index";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { assertTransition, computeAllowedActions } from "../../../services/caseStateMachine.service";
import { logCaseActivity } from "../../../services/caseActivity.service";
import { toAuthorizedCertificateView } from "../../../services/transactionCertificateRecord.service";
import { buildCaseRecordPdf } from "../../../services/caseRecordPdf.service";
import sendEmail from "../../../common/send.email";
import { caseMilestoneChangedMail } from "../../../common/emailTemplates/caseMails";
import { CaseStatus } from "../../../models/case";

/**
 * @swagger
 * /admin/cases:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: List all LASRERA cases
 *     description: Returns a paginated, filterable list of all dispute cases in the LASRERA queue.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [petition_submitted, case_opened, mediation, transferred_to_efcc, closed]
 *       - name: assignedOfficer
 *         in: query
 *         description: Filter by assigned officer ObjectId
 *         schema: { type: string }
 *       - name: search
 *         in: query
 *         description: Search by case number or transaction reference
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cases retrieved successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const listCases = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 20);
    const { status, assignedOfficer, search } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (assignedOfficer) filter.assignedOfficer = assignedOfficer;
    if (search && typeof search === "string") {
      filter.$or = [
        { caseNumber: { $regex: search, $options: "i" } },
        { transactionReference: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [cases, total] = await Promise.all([
      DB.Models.Case.find(filter)
        .populate("assignedOfficer", "firstName lastName email")
        .populate("petitionId", "subject buyer respondent amountInvolved")
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DB.Models.Case.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Cases retrieved successfully",
      data: {
        cases,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("[AdminCases] Error in listCases:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to list cases",
    });
  }
};

/**
 * @swagger
 * /admin/cases/audit-log:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Get global case audit log
 *     description: |
 *       Returns a filterable, paginated log of all case activities across every case.
 *       **Must be mounted before `/cases/:id` in the router to avoid path conflict.**
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 50 }
 *       - name: visibility
 *         in: query
 *         schema:
 *           type: string
 *           enum: [internal, buyer]
 *       - name: action
 *         in: query
 *         description: Filter by CaseActivityAction value
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const getCaseAuditLog = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 30);
    const { caseId, registrationId, action, actorType } = req.query;

    const filter: any = {};
    if (caseId) filter.caseId = caseId;
    if (registrationId) filter.registrationId = registrationId;
    if (action) filter.action = action;
    if (actorType) filter.actorType = actorType;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      DB.Models.CaseActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DB.Models.CaseActivityLog.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Audit logs retrieved successfully",
      data: {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("[AdminCases] Error in getCaseAuditLog:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to fetch audit log",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Get full case details
 *     description: |
 *       Returns the complete case record including:
 *       - Case metadata, petition summary, transaction reference
 *       - Assigned officer, milestones with timestamps
 *       - `allowedActions` — **server-authoritative** computed flags indicating
 *         which actions are available in the current state
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Case MongoDB ObjectId
 *         schema: { type: string, example: 6ac0f600f0bfb0514444ce6e }
 *     responses:
 *       200:
 *         description: Case details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     case: { type: object }
 *                     allowedActions:
 *                       type: object
 *                       properties:
 *                         startMediation: { type: boolean }
 *                         requestInformation: { type: boolean }
 *                         transferToEfcc: { type: boolean }
 *                         updateStatus: { type: array, items: { type: string } }
 *                         close: { type: boolean }
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const getCaseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseDoc = await DB.Models.Case.findById(id)
      .populate("assignedOfficer", "firstName lastName email")
      .populate("petitionId")
      .populate("registrationId")
      .lean();

    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Case not found",
      });
    }

    const allowedActions = computeAllowedActions(caseDoc.status as CaseStatus);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Case retrieved successfully",
      data: {
        ...caseDoc,
        allowedActions,
      },
    });
  } catch (error: any) {
    console.error("[AdminCases] Error in getCaseById:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to fetch case",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/status:
 *   patch:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Update case status
 *     description: |
 *       Transitions the case to a new status via the state machine.
 *
 *       **Valid transitions via this endpoint:**
 *       - `case_opened` → `mediation`
 *       - `case_opened` → `closed`
 *       - `mediation` → `closed`
 *       - `transferred_to_efcc` → `closed`
 *
 *       **Blocked (returns 400):**
 *       - Any status → `transferred_to_efcc` (use the EFCC transfer endpoint)
 *       - `closed` → anything
 *
 *       Buyer receives a milestone update email automatically.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [mediation, closed]
 *                 example: mediation
 *               reason:
 *                 type: string
 *                 description: Optional reason for the status change
 *                 example: Moving to formal mediation phase.
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid transition — state machine rejection
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const updateCaseStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status: targetStatus, reason } = req.body;
    const adminUser = req.admin;

    const caseDoc = await DB.Models.Case.findById(id);
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Case not found",
      });
    }

    // Verify valid transition
    assertTransition(caseDoc.status as CaseStatus, targetStatus as CaseStatus);

    const prevStatus = caseDoc.status;
    caseDoc.status = targetStatus;
    const now = new Date();
    caseDoc.lastActivityAt = now;

    // Milestone recording
    caseDoc.milestones.push({
      stage: targetStatus,
      occurredAt: now,
      by: adminUser?._id,
    });

    if (targetStatus === "closed") {
      caseDoc.closedAt = now;
      caseDoc.closure = {
        outcome: "resolved",
        summary: reason || "Closed via status update",
        closedBy: adminUser?._id,
      };
    }

    await caseDoc.save();

    await logCaseActivity({
      caseId: caseDoc._id,
      registrationId: caseDoc.registrationId,
      actorType: "Admin",
      actorId: adminUser?._id,
      actorLabel: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "LASRERA Officer",
      action: "STATUS_CHANGED",
      visibility: "buyer",
      message: `Status updated from ${prevStatus} to ${targetStatus}${reason ? `: ${reason}` : ""}`,
      meta: { prevStatus, nextStatus: targetStatus, reason },
    });

    // Notify buyer via email
    const petition = await DB.Models.Petition.findById(caseDoc.petitionId).lean();
    if (petition?.buyer?.email) {
      try {
        await sendEmail({
          to: petition.buyer.email,
          subject: `Case #${caseDoc.caseNumber} Status Update: ${targetStatus.toUpperCase()}`,
          text: `The status of your case #${caseDoc.caseNumber} has been updated to ${targetStatus}.`,
          html: caseMilestoneChangedMail(petition.buyer.fullName, caseDoc.caseNumber, targetStatus),
        });
      } catch (err: any) {
        console.warn("[AdminCases] Failed to send milestone mail:", err.message);
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Case status changed to '${targetStatus}'`,
      data: caseDoc,
    });
  } catch (error: any) {
    console.error("[AdminCases] Error in updateCaseStatus:", error);
    return res.status(error.statusCode || HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message || "Failed to update case status",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/assign:
 *   post:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Assign a case to an officer
 *     description: Assigns the specified admin as the case officer. Logs the assignment in the case activity trail.
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
 *             required: [officerId]
 *             properties:
 *               officerId:
 *                 type: string
 *                 description: Admin MongoDB ObjectId
 *                 example: 6a4392271b4edcb6018b7ee5
 *     responses:
 *       200:
 *         description: Officer assigned successfully
 *       404:
 *         description: Case or officer not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_ASSIGN permission
 */
export const assignOfficer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { officerId } = req.body;
    const adminUser = req.admin;

    const caseDoc = await DB.Models.Case.findById(id);
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Case not found",
      });
    }

    const officer = await DB.Models.Admin.findById(officerId).lean();
    if (!officer) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Officer not found",
      });
    }

    caseDoc.assignedOfficer = officer._id;
    caseDoc.lastActivityAt = new Date();
    await caseDoc.save();

    await logCaseActivity({
      caseId: caseDoc._id,
      registrationId: caseDoc.registrationId,
      actorType: "Admin",
      actorId: adminUser?._id,
      actorLabel: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "LASRERA Admin",
      action: "OFFICER_ASSIGNED",
      visibility: "internal",
      message: `Assigned officer ${officer.firstName} ${officer.lastName}`,
      meta: { officerId: officer._id, officerName: `${officer.firstName} ${officer.lastName}` },
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Officer ${officer.firstName} ${officer.lastName} assigned to case`,
      data: caseDoc,
    });
  } catch (error: any) {
    console.error("[AdminCases] Error in assignOfficer:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to assign officer",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/petition:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Get the linked petition for a case
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Petition retrieved successfully
 *       404:
 *         description: Case or petition not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const getCasePetition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseDoc = await DB.Models.Case.findById(id).lean();
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    const petition = await DB.Models.Petition.findById(caseDoc.petitionId).lean();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Petition retrieved successfully",
      data: petition,
    });
  } catch (error: any) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/digital-trail:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Get digital transaction trail
 *     description: Returns all journey events from the linked transaction registration (inspection, payment, agreement, handover, etc.).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Digital trail retrieved successfully
 *       404:
 *         description: Case or registration not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const getCaseDigitalTrail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseDoc = await DB.Models.Case.findById(id).lean();
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    const registration = await DB.Models.TransactionRegistration.findById(caseDoc.registrationId).lean();
    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Transaction registration not found" });
    }

    const certView = toAuthorizedCertificateView(registration as any);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Digital trail retrieved successfully",
      data: {
        transactionReference: caseDoc.transactionReference,
        journey: certView.journey,
        parties: certView.parties,
        professionals: certView.participatingProfessionals,
      },
    });
  } catch (error: any) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/evidence:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Get all case evidence
 *     description: Returns all petition attachments and documents linked to this case, intended for review before generating the PDF dossier.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Evidence retrieved successfully
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const getCaseEvidence = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseDoc = await DB.Models.Case.findById(id).lean();
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    const [petition, registration] = await Promise.all([
      DB.Models.Petition.findById(caseDoc.petitionId).lean(),
      DB.Models.TransactionRegistration.findById(caseDoc.registrationId).lean(),
    ]);

    const petitionAttachments = petition?.attachments || [];
    const certView = registration ? toAuthorizedCertificateView(registration as any) : null;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Case evidence retrieved successfully",
      data: {
        petitionAttachments,
        registeredDocuments: certView?.documentTrail || [],
        paymentReceiptUrl: (registration as any)?.paymentReceiptUrl || null,
        deedsOfAssignmentUrl: (registration as any)?.deedsOfAssignmentUrl || null,
        conveyanceUrl: (registration as any)?.conveyanceUrl || null,
      },
    });
  } catch (error: any) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/communications:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Get all case communications
 *     description: Returns all outbound information requests and inbound buyer responses for this case.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Communications retrieved successfully
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const getCaseCommunications = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const communications = await DB.Models.CaseCommunication.find({ caseId: id })
      .populate("officer", "firstName lastName email")
      .sort({ sentAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Communications retrieved successfully",
      data: communications,
    });
  } catch (error: any) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/activity:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Get case activity timeline
 *     description: Returns the full chronological activity log for this case, including admin and buyer actions with visibility flags.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Activity log retrieved successfully
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const getCaseActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const logs = await DB.Models.CaseActivityLog.find({ caseId: id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Case activity log retrieved successfully",
      data: logs,
    });
  } catch (error: any) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/case-record.pdf:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases
 *     summary: Generate and retrieve case record PDF
 *     description: |
 *       Builds a multi-page A4 case dossier PDF and uploads it to Cloudinary.
 *       Returns the Cloudinary URL for download or email attachment.
 *
 *       **PDF sections include:**
 *       case identification, parties, transaction details, petition,
 *       digital trail, payment records, evidence, mediation notes
 *       (if `CASE_PDF_INCLUDE_MEDIATION_NOTES=true`), communications, activity log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: PDF generated and URL returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     pdfUrl: { type: string, format: uri }
 *                     fileName: { type: string }
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_VIEW permission
 */
export const getCaseRecordPdf = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { buffer, fileName } = await buildCaseRecordPdf(id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);

    return res.send(buffer);
  } catch (error: any) {
    console.error("[AdminCases] Error in getCaseRecordPdf:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to generate case record PDF",
    });
  }
};
