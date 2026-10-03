import { Response } from "express";
import { DB } from "../index";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { nextPetitionNumber } from "../../services/caseCounter.service";
import { logCaseActivity } from "../../services/caseActivity.service";

/**
 * @swagger
 * /buyer/petitions:
 *   post:
 *     tags:
 *       - Buyer
 *       - Buyer > Petitions
 *     summary: Submit a formal dispute petition
 *     description: Submits a formal dispute petition against a respondent (developer, agent, property owner) for a registered transaction. Prevents duplicate active petitions on the same registration.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - registrationId
 *               - subject
 *               - description
 *               - amountInvolved
 *               - respondent
 *             properties:
 *               registrationId:
 *                 type: string
 *                 example: 6ac0f2cdf0bfb0514444ce09
 *                 description: MongoDB ID of the verified transaction registration
 *               subject:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *                 example: "Failure to Deliver Deed of Assignment and Delay in Handover"
 *                 description: Brief summary of the dispute subject
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 example: "Full payment of 45,000,000 NGN was made on August 15, 2026 for Unit 4B at Greenview Estate. Developer has ceased communication and delayed handover by over 4 months."
 *                 description: Detailed narrative describing the facts of the dispute
 *               amountInvolved:
 *                 type: number
 *                 example: 45000000
 *                 description: Total monetary value involved in the dispute (NGN)
 *               respondent:
 *                 type: object
 *                 required:
 *                   - name
 *                   - type
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Greenview Homes Ltd"
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: "developer@greenviewhomes.test"
 *                   phoneNumber:
 *                     type: string
 *                     example: "+2348098765432"
 *                   type:
 *                     type: string
 *                     enum: [developer, agent, property_owner, other]
 *                     example: developer
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
 *                       example: "payment_receipt.pdf"
 *                     url:
 *                       type: string
 *                       example: "https://res.cloudinary.com/example/payment_receipt.pdf"
 *     responses:
 *       201:
 *         description: Dispute petition submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Dispute petition #PET-2026-00001 submitted successfully" }
 *                 data: { type: object }
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Buyer authentication required
 *       403:
 *         description: Buyer does not own this transaction registration
 *       404:
 *         description: Transaction registration not found
 *       409:
 *         description: An active petition already exists for this registration
 *       500:
 *         description: Internal server error
 */
export const createPetition = async (req: AppRequest, res: Response) => {
  try {
    const buyer = req.buyer;
    if (!buyer) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Buyer authentication required",
      });
    }

    const {
      registrationId,
      subject,
      description,
      amountInvolved,
      respondent,
      attachments,
    } = req.body;

    const registration = await DB.Models.TransactionRegistration.findById(registrationId).lean();
    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Transaction registration not found",
      });
    }

    // Verify buyer belongs to this transaction
    const buyerEmailMatches =
      registration.buyer?.email &&
      registration.buyer.email.toLowerCase() === buyer.email.toLowerCase();
    const buyerIdMatches =
      (registration as any).buyerId &&
      String((registration as any).buyerId) === String(buyer._id);

    if (!buyerEmailMatches && !buyerIdMatches) {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        message: "You are not authorized to submit a petition for this transaction registration",
      });
    }

    // Block duplicate active petitions for same registration
    const existingPetition = await DB.Models.Petition.findOne({
      registrationId: registration._id,
      status: { $in: ["submitted", "case_opened"] },
    }).lean();

    if (existingPetition) {
      return res.status(HttpStatusCodes.CONFLICT).json({
        success: false,
        message: `An active petition (#${existingPetition.petitionNumber}) is already in progress for this registration`,
        data: existingPetition,
      });
    }

    const petitionNumber = await nextPetitionNumber();
    const now = new Date();

    const petition = await DB.Models.Petition.create({
      petitionNumber,
      registrationId: registration._id,
      transactionReference: registration.transactionReference,
      buyerId: buyer._id,
      buyer: {
        fullName: buyer.fullName || `${(buyer as any).firstName || ""} ${(buyer as any).lastName || ""}`.trim() || "Buyer",
        email: buyer.email.toLowerCase(),
        phoneNumber: buyer.phoneNumber || "",
      },
      respondent,
      subject,
      description,
      amountInvolved,
      attachments: (attachments || []).map((att: any) => ({
        fileName: att.fileName,
        url: att.url,
        uploadedAt: now,
      })),
      status: "submitted",
      submittedAt: now,
    });

    await logCaseActivity({
      caseId: petition._id, // placeholder before caseId assigned
      registrationId: registration._id,
      actorType: "Buyer",
      actorId: buyer._id,
      actorLabel: petition.buyer.fullName,
      action: "PETITION_SUBMITTED",
      visibility: "buyer",
      message: `Buyer submitted dispute petition #${petitionNumber}`,
      meta: { petitionNumber, amountInvolved },
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: `Dispute petition #${petitionNumber} submitted successfully`,
      data: petition,
    });
  } catch (error: any) {
    console.error("[BuyerPetitions] Error in createPetition:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to submit petition",
    });
  }
};

/**
 * @swagger
 * /buyer/petitions:
 *   get:
 *     tags:
 *       - Buyer
 *       - Buyer > Petitions
 *     summary: List my dispute petitions
 *     description: Returns a paginated list of all dispute petitions submitted by the authenticated buyer, including linked case status and numbers.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 1 }
 *         description: Page number for pagination
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 20 }
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Petitions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Petitions retrieved successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     petitions:
 *                       type: array
 *                       items: { type: object }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         totalPages: { type: integer }
 *       401:
 *         description: Buyer authentication required
 *       500:
 *         description: Internal server error
 */
export const listMyPetitions = async (req: AppRequest, res: Response) => {
  try {
    const buyer = req.buyer;
    if (!buyer) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({ success: false, message: "Buyer authentication required" });
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 20);
    const skip = (page - 1) * limit;

    const filter = { buyerId: buyer._id };
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
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to list petitions",
    });
  }
};

/**
 * @swagger
 * /buyer/petitions/{id}:
 *   get:
 *     tags:
 *       - Buyer
 *       - Buyer > Petitions
 *     summary: Get single petition details
 *     description: Returns detailed information for a single dispute petition owned by the authenticated buyer, including current status and linked case details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: MongoDB ID of the petition
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Petition retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Petition retrieved successfully" }
 *                 data: { type: object }
 *       401:
 *         description: Buyer authentication required
 *       404:
 *         description: Petition not found or does not belong to buyer
 *       500:
 *         description: Internal server error
 */
export const getMyPetition = async (req: AppRequest, res: Response) => {
  try {
    const buyer = req.buyer;
    const { id } = req.params;

    const petition = await DB.Models.Petition.findOne({
      _id: id,
      buyerId: buyer?._id,
    })
      .populate("caseId", "caseNumber status milestones")
      .lean();

    if (!petition) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Petition not found",
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Petition retrieved successfully",
      data: petition,
    });
  } catch (error: any) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to get petition",
    });
  }
};
