import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { getDeveloperPlanSnapshot } from "../../../services/developerPlanEntitlement.service";

/**
 * GET /account/developer/plan-entitlement
 * Developer plan caps, Advanced KYC, and remaining professional slots.
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
