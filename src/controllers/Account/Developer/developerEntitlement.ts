import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { getDeveloperPlanSnapshot } from "../../../services/developerPlanEntitlement.service";

/**
 * GET /account/developer/plan-entitlement
 * Developer plan caps, Advanced KYC, and remaining professional slots.
 */
/**
 * @swagger
 * /account/developer/plan-entitlement:
 *   get:
 *     tags:
 *       - Account > Developer
 *     summary: Get developer plan entitlement snapshot
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Developer plan entitlement fetched successfully
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
 *                     planCode:
 *                       type: string
 *                     planName:
 *                       type: string
 *                     entitlements:
 *                       type: object
 *                     limits:
 *                       type: object
 *                     remaining:
 *                       type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This snapshot is for Developer accounts only
 */
export const getDeveloperPlanEntitlementController = async (
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
    if (userType !== "Developer") {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "This snapshot is for Developer accounts only.");
    }

    const data = await getDeveloperPlanSnapshot(String(userId));
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Developer plan entitlement fetched successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
};
