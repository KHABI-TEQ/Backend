import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { SubscriptionPlanService } from "../../../services/subscriptionPlan.service";
import { PlanFeatureService } from "../../../services/planFeatures.service";

/* ===========================
   Subscription Plan Endpoints
   =========================== */

/**
 * Create a new subscription plan
 */
export const createSubscriptionPlan = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const plan = await SubscriptionPlanService.createPlan(req.body);

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Subscription plan created successfully",
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a subscription plan (except code)
 */
/**
 * @swagger
 * /admin/subsription-plans/{planId}/update:
 *   put:
 *     tags:
 *       - Admin > Subscription Plans
 *     summary: Update subscription plan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: planId
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
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               interval:
 *                 type: string
 *               category:
 *                 type: string
 *               audience:
 *                 type: string
 *               features:
 *                 type: array
 *                 items: {'type': 'string'}
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Subscription plan updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Plan not found
 */
export const updateSubscriptionPlan = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId } = req.params;
 
    const plan = await SubscriptionPlanService.updatePlan(planId, req.body);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription plan updated successfully",
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a subscription plan
 */
/**
 * @swagger
 * /admin/subsription-plans/{planId}/deleteOne:
 *   delete:
 *     tags:
 *       - Admin > Subscription Plans
 *     summary: Delete subscription plan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: planId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription plan deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Plan not found
 */
export const deleteSubscriptionPlan = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId } = req.params;

    const deleted = await SubscriptionPlanService.deletePlan(planId);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Plan not found or could not be deleted");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription plan deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch all subscription plans
 */
/**
 * @swagger
 * /admin/subsription-plans:
 *   get:
 *     tags:
 *       - Admin > Subscription Plans
 *     summary: Get all subscription plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription plans fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const getAllSubscriptionPlans = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try { 
    const plans = await SubscriptionPlanService.getAllPlans();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: plans.map((plan) => SubscriptionPlanService.enrichPlanForCatalog(plan)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get one subscription plan
 */
/**
 * @swagger
 * /admin/subsription-plans/{planId}/getOne:
 *   get:
 *     tags:
 *       - Admin > Subscription Plans
 *     summary: Get subscription plan by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: planId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription plan fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Plan not found
 */
export const getSubscriptionPlan = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId } = req.params;

    const plan = await SubscriptionPlanService.getPlan(planId);
    if (!plan) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Plan not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: SubscriptionPlanService.enrichPlanForCatalog(plan),
    });
  } catch (err) {
    next(err);
  }
};

/* ======================
   Plan Feature Endpoints
   ====================== */

/**
 * Create a new feature
 */
export const createPlanFeature = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const feature = await PlanFeatureService.createFeature(req.body);

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Plan feature created successfully",
      data: feature,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a feature
 */
export const updatePlanFeature = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { featureId } = req.params;

    const feature = await PlanFeatureService.updateFeature(featureId, req.body);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Plan feature updated successfully",
      data: feature,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a feature
 */
export const deletePlanFeature = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { featureId } = req.params;

    const deleted = await PlanFeatureService.deleteFeature(featureId);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Feature not found or could not be deleted");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Plan feature deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch all features
 */
export const getAllPlanFeatures = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const features = await PlanFeatureService.getAllFeatures();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: features,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get one feature
 */
export const getPlanFeature = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { featureId } = req.params;

    const feature = await PlanFeatureService.getFeature(featureId);
    if (!feature) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Feature not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: feature,
    });
  } catch (err) {
    next(err);
  }
};
