import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { broadcastToSubscribers } from "../../../services/agentSubscriber.service";

/**
 * Agent or Developer broadcasts an email to all their DealSite subscribers.
 * Subscribers are unauthenticated DealSite guests who subscribed with email
 * (POST /deal-site/:publicSlug/newsletter/subscribe).
 * Body: { subject, body } — body can be HTML.
 */
/**
 * @swagger
 * /account/agent/broadcast:
 *   post:
 *     tags:
 *       - Account > Agent
 *     summary: Broadcast email to DealSite subscribers
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - body
 *             properties:
 *               subject:
 *                 type: string
 *                 description: Email subject
 *               body:
 *                 type: string
 *                 description: Email body content
 *     responses:
 *       200:
 *         description: Broadcast sent to subscribers
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
 *                   properties:
 *                     sentCount:
 *                       type: number
 *       400:
 *         description: subject and body are required
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only Agents and Developers with a DealSite can send a broadcast
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
    const userType = (req.user as any)?.userType;
    const allowed = userType === "Agent" || userType === "Developer";
    if (!allowed) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Agents and Developers with a DealSite can send a broadcast to subscribers."
      );
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
      data: {
        emailsSent: result.emailsSent,
        ...(result.provider && { provider: result.provider }),
      },
    });
  } catch (err) {
    next(err);
  }
};
