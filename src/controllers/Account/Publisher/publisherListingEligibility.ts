import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  isPublisherUserType,
  SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
} from "../../../common/constants/publisherListingLimits";
import {
  getPublisherListingSnapshot,
  publisherHasUnlimitedListings,
} from "../../../services/publisherListingEligibility.service";
import { SubscriptionPlanService } from "../../../services/subscriptionPlan.service";
import {
  resolveAgentSubscriptionBonusDays,
} from "../../../services/agentSubscriptionIncentive.service";

/**
 * GET /account/publisher/listing-eligibility
 * Listing cap snapshot for Landlord, Agent, and Developer accounts.
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

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Publisher listing eligibility fetched successfully",
      data: snapshot,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /account/publisher/unlimited-listing-plan
 * Returns Portfolio Unlimited only when the user has hit the standard cap and lacks unlimited access.
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
    if (!snapshot?.requiresSpecialPlan) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: null,
        message: "Portfolio Unlimited is not required for this account yet.",
      });
    }

    if (await publisherHasUnlimitedListings(String(userId))) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: null,
        message: "You already have unlimited listings.",
      });
    }

    const plan = await SubscriptionPlanService.getPlan(SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE);
    if (!plan || !plan.isActive) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Portfolio Unlimited plan is not available. Please contact support."
      );
    }

    const bonusDays = resolveAgentSubscriptionBonusDays({
      planName: plan.name,
      planCode: plan.code,
      durationInDays: plan.durationInDays,
    });
    const discountedPlans = (plan.discountedPlans || []).map((dp: any) => ({
      ...dp,
      bonusDays: resolveAgentSubscriptionBonusDays({
        planName: dp.name ?? plan.name,
        planCode: dp.code,
        durationInDays: dp.durationInDays,
      }),
    }));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Portfolio Unlimited plan fetched successfully",
      data: {
        ...plan,
        bonusDays,
        discountedPlans,
        listingSnapshot: snapshot,
      },
    });
  } catch (err) {
    next(err);
  }
};
