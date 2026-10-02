import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { DB } from "../..";
import { EmailSubscriptionService } from "../../../services/emailSubscription.service";

/**
 * Admin - Fetch all email subscriptions
 */
/**
 * @swagger
 * /admin/emailSubscriptions/getAll:
 *   get:
 *     tags:
 *       - Admin > Email Subscriptions
 *     summary: Get all email subscriptions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Subscriptions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               {'$ref': '#/components/schemas/Pagination'}
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const adminGetAllSubscriptions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const subscriptions = await EmailSubscriptionService.getSubscriptions(
      Number(page),
      Number(limit),
      status as string
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      ...subscriptions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Add a new subscription manually
 */
/**
 * @swagger
 * /admin/emailSubscriptions/addNew:
 *   post:
 *     tags:
 *       - Admin > Email Subscriptions
 *     summary: Add new email subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               categories:
 *                 type: array
 *                 items: {'type': 'string'}
 *     responses:
 *       201:
 *         description: Subscription added successfully
 *       400:
 *         description: Invalid request or email already subscribed
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const adminAddSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required");
    }

    const subscription = await EmailSubscriptionService.subscribe({
      email,
      firstName,
      lastName,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Subscription added successfully",
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Delete subscription by ID
 */
/**
 * @swagger
 * /admin/emailSubscriptions/{subscriptionId}/delete:
 *   delete:
 *     tags:
 *       - Admin > Email Subscriptions
 *     summary: Delete email subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: subscriptionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subscription not found
 */
export const adminDeleteSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;

    const deleted = await DB.Models.EmailSubscription.findByIdAndDelete(subscriptionId);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Change subscription status
 */
/**
 * @swagger
 * /admin/emailSubscriptions/{subscriptionId}/changeStatus:
 *   put:
 *     tags:
 *       - Admin > Email Subscriptions
 *     summary: Change subscription status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: subscriptionId
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
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Subscription status changed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subscription not found
 */
export const adminChangeSubscriptionStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const { status } = req.body; // expected: "subscribed" | "unsubscribed"

    if (!["subscribed", "unsubscribed"].includes(status)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid status value");
    }

    const updated = await DB.Models.EmailSubscription.findByIdAndUpdate(
      subscriptionId,
      { status },
      { new: true }
    ).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription status updated",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
