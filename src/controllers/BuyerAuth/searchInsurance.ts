import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  fileSearchInsuranceClaim,
  getBuyerClaim,
  listBuyerSearchInsurance,
} from "../../services/searchInsurance.service";

function requireBuyerId(req: AppRequest) {
  const id = req.buyer?._id;
  if (!id) {
    throw new RouteError(
      HttpStatusCodes.UNAUTHORIZED,
      "Buyer not authenticated."
    );
  }
  return String(id);
}

/**
 * @swagger
 * /buyer-auth/me/search-insurance:
 *   get:
 *     tags:
 *       - Buyer Auth
 *     summary: Get buyer search insurance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Search insurance fetched successfully
 *       401:
 *         description: Not authenticated
 */
export const getMySearchInsurance = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listBuyerSearchInsurance(requireBuyerId(req));
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /buyer-auth/me/search-insurance/{policyId}/claims:
 *   post:
 *     tags:
 *       - Buyer Auth
 *     summary: Create search insurance claim
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: policyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - claimType
 *               - description
 *             properties:
 *               claimType:
 *                 type: string
 *                 description: Type of claim
 *               description:
 *                 type: string
 *                 description: Claim description
 *               documents:
 *                 type: array
 *                 items: {'type': 'string'}
 *                 description: Supporting documents
 *     responses:
 *       201:
 *         description: Claim created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 */
export const createMySearchInsuranceClaim = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const claim = await fileSearchInsuranceClaim({
      buyerId: requireBuyerId(req),
      policyId: String(req.params.policyId),
      description: req.body?.description,
      practitionerName: req.body?.practitionerName,
      practitionerUser: req.body?.practitionerUser,
      evidence: Array.isArray(req.body?.evidence) ? req.body.evidence : [],
    });
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Claim submitted for review.",
      data: claim,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /buyer-auth/me/search-insurance/claims/{claimId}:
 *   get:
 *     tags:
 *       - Buyer Auth
 *     summary: Get search insurance claim details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: claimId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Claim fetched successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Claim not found
 */
export const getMySearchInsuranceClaim = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const claim = await getBuyerClaim(
      requireBuyerId(req),
      String(req.params.claimId)
    );
    return res.status(HttpStatusCodes.OK).json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
};
