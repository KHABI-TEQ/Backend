import { Request, Response } from "express";
import { DB } from "../../index";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { nextCaseNumber } from "../../../services/caseCounter.service";
import { logCaseActivity } from "../../../services/caseActivity.service";
import sendEmail from "../../../common/send.email";
import { caseOpenedMail } from "../../../common/emailTemplates/caseMails";

/**
 * @swagger
 * /admin/petitions:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases > Petitions
 *     summary: List all buyer petitions
 *     description: Returns a paginated list of all dispute petitions submitted by buyers. Supports filtering by status and text search.
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
 *           enum: [submitted, case_opened, rejected, withdrawn]
 *       - name: search
 *         in: query
 *         description: Search by petition number, buyer name, email, or subject
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Petitions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     petitions: { type: array, items: { type: object } }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         totalPages: { type: integer }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires PETITION_VIEW permission
 */
export const listPetitions = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 20);
    const { status, search } = req.query;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }
    if (search && typeof search === "string") {
      filter.$or = [
        { petitionNumber: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { "buyer.fullName": { $regex: search, $options: "i" } },
        { "buyer.email": { $regex: search, $options: "i" } },
        { transactionReference: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [petitions, total] = await Promise.all([
      DB.Models.Petition.find(filter)
        .populate("caseId", "caseNumber status")
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DB.Models.Petition.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Petitions retrieved successfully",
      data: {
        petitions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("[AdminPetitions] Error in listPetitions:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to list petitions",
    });
  }
};

/**
 * @swagger
 * /admin/petitions/{id}:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases > Petitions
 *     summary: Get petition details
 *     description: Returns full petition details including buyer snapshot, respondent, attachments, and linked case (if opened).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Petition MongoDB ObjectId
 *         schema: { type: string, example: 6ac0f3a8f0bfb0514444ce38 }
 *     responses:
 *       200:
 *         description: Petition details retrieved successfully
 *       404:
 *         description: Petition not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires PETITION_VIEW permission
 */
export const getPetition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const petition = await DB.Models.Petition.findById(id)
      .populate("caseId")
      .populate("registrationId")
      .lean();

    if (!petition) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Petition not found",
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Petition details retrieved successfully",
      data: petition,
    });
  } catch (error: any) {
    console.error("[AdminPetitions] Error in getPetition:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to get petition",
    });
  }
};

/**
 * @swagger
 * /admin/petitions/{id}/open-case:
 *   post:
 *     tags:
 *       - Admin
 *       - Admin > Cases > Petitions
 *     summary: Open a formal LASRERA case from a petition
 *     description: |
 *       Converts an approved petition into a tracked LASRERA dispute case.
 *       - **Idempotent**: calling again returns the existing case.
 *       - Petition status changes to `case_opened`.
 *       - Buyer receives a "Case Opened" email notification automatically.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Petition MongoDB ObjectId
 *         schema: { type: string, example: 6ac0f3a8f0bfb0514444ce38 }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignedOfficer:
 *                 type: string
 *                 description: Admin ObjectId to assign as case officer (defaults to current admin)
 *                 example: 6a4392271b4edcb6018b7ee5
 *               reviewNotes:
 *                 type: string
 *                 description: Internal notes from petition review
 *                 example: Sufficient evidence provided.
 *     responses:
 *       201:
 *         description: Case opened successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Case #KHT-CASE-000001 successfully opened" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     case: { type: object }
 *                     petition: { type: object }
 *       200:
 *         description: Case already exists (idempotent response)
 *       400:
 *         description: Petition is rejected or withdrawn
 *       404:
 *         description: Petition not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires PETITION_MANAGE permission
 */
export const openCase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminUser = req.admin;

    const petition = await DB.Models.Petition.findById(id);
    if (!petition) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Petition not found",
      });
    }

    // Idempotency check: if case already created, return it
    if (petition.caseId) {
      const existingCase = await DB.Models.Case.findById(petition.caseId).lean();
      if (existingCase) {
        return res.status(HttpStatusCodes.OK).json({
          success: true,
          message: "Case has already been opened for this petition",
          data: { case: existingCase, petition },
        });
      }
    }

    if (petition.status === "rejected" || petition.status === "withdrawn") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Cannot open case for a petition with status '${petition.status}'`,
      });
    }

    const assignedOfficerId = req.body.assignedOfficer || adminUser?._id;
    const caseNumber = await nextCaseNumber();
    const now = new Date();

    const newCase = await DB.Models.Case.create({
      caseNumber,
      petitionId: petition._id,
      registrationId: petition.registrationId,
      transactionReference: petition.transactionReference,
      caseType: "transaction_dispute",
      status: "case_opened",
      assignedOfficer: assignedOfficerId,
      milestones: [
        {
          stage: "petition_submitted",
          occurredAt: petition.submittedAt || now,
        },
        {
          stage: "case_opened",
          occurredAt: now,
          by: adminUser?._id,
        },
      ],
      openedAt: now,
      lastActivityAt: now,
    });

    // Update petition
    petition.status = "case_opened";
    petition.caseId = newCase._id;
    await petition.save();

    // Log activity
    await logCaseActivity({
      caseId: newCase._id,
      registrationId: newCase.registrationId,
      actorType: "Admin",
      actorId: adminUser?._id,
      actorLabel: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "LASRERA Admin",
      action: "CASE_OPENED",
      visibility: "buyer",
      message: `Formal case #${caseNumber} opened from petition #${petition.petitionNumber}`,
      meta: { petitionNumber: petition.petitionNumber },
    });

    // Notify buyer via email
    if (petition.buyer?.email) {
      try {
        await sendEmail({
          to: petition.buyer.email,
          subject: `LASRERA Dispute Case Opened: #${caseNumber}`,
          text: `Your dispute petition #${petition.petitionNumber} has been opened under Case #${caseNumber}.`,
          html: caseOpenedMail(petition.buyer.fullName, caseNumber, petition.subject),
        });
      } catch (mailErr: any) {
        console.warn("[AdminPetitions] Failed to send case opened email to buyer:", mailErr.message);
      }
    }

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: `Case #${caseNumber} successfully opened`,
      data: {
        case: newCase,
        petition,
      },
    });
  } catch (error: any) {
    console.error("[AdminPetitions] Error in openCase:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to open case",
    });
  }
};
