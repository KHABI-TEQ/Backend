import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { isPublisherUserType } from "../../../common/constants/publisherListingLimits";
import { getPublisherListingSnapshot } from "../../../services/publisherListingEligibility.service";
import { getPropertyScoutSnapshot, isScoutEligibleUserType } from "../../../services/propertyScout.service";

/**
 * GET /account/publisher/listing-eligibility
 * Listing cap snapshot for Landlord, Agent, and Developer accounts.
 */
/**
 * @swagger
 * /account/publisher/listing-eligibility:
 *   get:
 *     tags:
 *       - Account > Publisher
 *     summary: Get publisher listing eligibility snapshot
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Publisher listing eligibility fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     eligible:
 *                       type: boolean
 *                     reason:
 *                       type: string
 *                     kycStatus:
 *                       type: string
 *                     accountStatus:
 *                       type: string
 *                     isLicensed:
 *                       type: boolean
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Listing eligibility applies to landlord, agent, and developer accounts only
 */
export const getPublisherListingEligibility = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const userType = (req.user as { userType?: string })?.userType;

    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    if (!isPublisherUserType(userType)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Listing eligibility applies to landlord, agent, and developer accounts only."
      );
    }

    const snapshot = await getPublisherListingSnapshot(String(userId), userType!);
    const propertyScout = isScoutEligibleUserType(userType)
      ? await getPropertyScoutSnapshot(String(userId))
      : null;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Publisher listing eligibility fetched successfully",
      data: {
        ...snapshot,
        ...(propertyScout
          ? {
              isPropertyScout: propertyScout.isPropertyScout,
              isLicensedPublisher: propertyScout.isLicensedPublisher,
              displayRoleLabel: propertyScout.displayRoleLabel,
              hasLicense: propertyScout.hasLicense,
              canAcceptInspectionRequests: !propertyScout.isPropertyScout,
            }
          : {}),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /account/publisher/unlimited-listing-plan
 * Portfolio Unlimited is retired. Kept so older clients fail closed instead of offering a dead plan.
 */
/**
 * @swagger
 * /account/publisher/unlimited-listing-plan:
 *   get:
 *     tags:
 *       - Account > Publisher
 *     summary: Get unlimited listing plan offer (retired)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unlimited listing plan offer fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     retired:
 *                       type: boolean
 *                     message:
 *                       type: string
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This offer applies to landlord, agent, and developer accounts only
 */
export const getUnlimitedListingPlanOffer = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const userType = (req.user as { userType?: string })?.userType;

    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    if (!isPublisherUserType(userType)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "This offer applies to landlord, agent, and developer accounts only."
      );
    }

    const snapshot = await getPublisherListingSnapshot(String(userId), userType!);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: null,
      retired: true,
      alreadyUnlimited: false,
      listingSnapshot: snapshot,
      message:
        "Portfolio Unlimited is no longer available. Choose a Licensed Agent plan on the subscriptions page.",
    });
  } catch (err) {
    next(err);
  }
};
