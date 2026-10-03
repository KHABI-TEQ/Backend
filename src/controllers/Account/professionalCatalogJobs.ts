import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  acceptCatalogServiceRequest,
  categoryForAccountUser,
  deliverCatalogServiceRequest,
  getCatalogJobForProfessional,
  listCatalogJobsForProfessional,
  submitServiceOffer,
} from "../../services/professionalCatalog.service";

function requireProfessional(req: AppRequest) {
  if (!req.user?._id) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Account required.");
  }
  const pending = (req.user as { pendingProfessionalType?: string })
    ?.pendingProfessionalType;
  const userType = req.user.userType;
  const effective =
    userType === "PropertyScout" && pending ? pending : userType;
  const category = categoryForAccountUser(effective);
  if (!category) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "A lawyer, surveyor, or valuer account is required."
    );
  }
  return { user: req.user, category };
}

/**
 * @swagger
 * /account/professional-services/jobs:
 *   get:
 *     tags:
 *       - Account > Professional
 *     summary: List professional service jobs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Professional service jobs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                   description: List of professional service jobs
 *       401:
 *         description: Account required
 *       403:
 *         description: A lawyer, surveyor, or valuer account is required
 */
export const listProfessionalServiceJobs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user, category } = requireProfessional(req);
    const jobs = await listCatalogJobsForProfessional(
      String(user._id),
      category
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/professional-services/jobs/{id}:
 *   get:
 *     tags:
 *       - Account > Professional
 *     summary: Get single professional service job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Professional service job fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Professional service job details
 *       401:
 *         description: Account required
 *       403:
 *         description: A lawyer, surveyor, or valuer account is required
 */
export const getProfessionalServiceJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user, category } = requireProfessional(req);
    const job = await getCatalogJobForProfessional({
      requestId: req.params.id,
      userId: String(user._id),
      category,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/professional-services/{id}/respond:
 *   post:
 *     tags:
 *       - Account > Professional
 *     summary: Respond to professional service job (accept/decline or submit offer)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accept:
 *                 type: boolean
 *                 description: Accept or decline
 *               reason:
 *                 type: string
 *                 description: Reason for declining
 *               coverageNote:
 *                 type: string
 *               fee:
 *                 type: number
 *                 description: Proposed fee
 *               serviceItems:
 *                 type: array
 *                 items:
 *                   type: object
 *               commissionAccepted:
 *                 type: boolean
 *               letterheadReportAccepted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Request accepted, declined, or offer sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       401:
 *         description: Account required
 *       403:
 *         description: A lawyer, surveyor, or valuer account is required
 */
export const respondProfessionalServiceJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user } = requireProfessional(req);
    if (req.body?.coverageNote || req.body?.fee) {
      const job = await submitServiceOffer({
        requestId: req.params.id,
        userId: String(user._id),
        coverageNote: String(req.body.coverageNote || ""),
        fee: Number(req.body.fee),
        serviceItems: req.body.serviceItems,
        commissionAccepted: req.body.commissionAccepted === true,
        letterheadReportAccepted: req.body.letterheadReportAccepted === true,
      });
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Offer sent. The client can compare it with other professionals.",
        data: job,
      });
    }
    const accept = req.body?.accept === true;
    const reason = req.body?.reason as string | undefined;
    const job = await acceptCatalogServiceRequest({
      requestId: req.params.id,
      userId: String(user._id),
      accept,
      reason,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: accept
        ? "Request accepted. The client has been asked to pay."
        : "You declined this request. It remains open for other professionals.",
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

export const deliverProfessionalServiceJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user } = requireProfessional(req);
    const job = await deliverCatalogServiceRequest({
      requestId: req.params.id,
      userId: String(user._id),
      notes: String(req.body?.notes || ""),
      url: String(req.body?.url || ""),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Delivery sent to the client on the website.",
      data: job,
    });
  } catch (err) {
    next(err);
  }
};
