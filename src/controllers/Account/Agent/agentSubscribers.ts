import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { broadcastToSubscribers } from "../../../services/agentSubscriber.service";

/**
 * Agent broadcasts an email to all their subscribers.
 * Subscribers are unauthenticated DealSite guests who subscribed with email
 * (POST /deal-site/:publicSlug/newsletter/subscribe).
 * Body: { subject, body } — body can be HTML.
 */
export const broadcastToMySubscribers = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    const { subject, body } = req.body;
    if (!subject || !body) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "subject and body are required"
      );
    }

    const result = await broadcastToSubscribers(userId, subject, body);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Broadcast sent to subscribers",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
