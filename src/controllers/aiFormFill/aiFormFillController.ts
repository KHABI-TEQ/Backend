import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { suggestFormFields } from "../../services/aiFormFill.service";

/**
 * POST /account/ai/suggest-property
 * Authenticated Agent, Landlord, or Developer: get AI-suggested property form fields from natural language.
 */
/**
 * @swagger
 * /account/ai/suggest-property:
 *   post:
 *     tags:
 *       - Account
 *       - Account > AI
 *     summary: Get AI-suggested property form fields from natural language
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userInput
 *             properties:
 *               userInput:
 *                 type: string
 *                 description: Natural language description of the property
 *     responses:
 *       200:
 *         description: Suggested property form fields
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
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     price:
 *                       type: number
 *                     propertyType:
 *                       type: string
 *                     location:
 *                       type: object
 *       400:
 *         description: userInput is required
 *       403:
 *         description: Only Agents, Landlords, and Developers can use AI
 *       503:
 *         description: AI service unavailable
 */
export const suggestPropertyForm = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userType = (req.user as any)?.userType;
    const allowed = ["Agent", "Landowners", "Developer"].includes(userType);
    if (!allowed) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Agents, Landlords, and Developers can use AI to suggest property form fields."
      );
    }

    const { userInput } = req.body as { userInput?: string };
    if (!userInput || typeof userInput !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "userInput (string) is required.");
    }

    const result = await suggestFormFields("property", userInput);
    if (!result.success) {
      const err = result as { success: false; error: string };
      const authFail = /authentication failed|OPENAI_API_KEY|not configured/i.test(
        err.error
      );
      const status = authFail
        ? HttpStatusCodes.SERVICE_UNAVAILABLE
        : HttpStatusCodes.BAD_REQUEST;
      throw new RouteError(status, err.error);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Suggested property form fields from your description.",
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /ai/suggest-preference
 * Public: get AI-suggested preference form fields from natural language (for buyers submitting a preference).
 */
/**
 * @swagger
 * /ai/suggest-preference:
 *   post:
 *     tags:
 *       - Account
 *       - Account > AI
 *     summary: Get AI-suggested preference form fields from natural language (public)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userInput
 *             properties:
 *               userInput:
 *                 type: string
 *                 description: Natural language description of buyer preferences
 *     responses:
 *       200:
 *         description: Suggested preference form fields
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
 *                     budget:
 *                       type: number
 *                     propertyType:
 *                       type: string
 *                     location:
 *                       type: object
 *                     bedrooms:
 *                       type: number
 *                     bathrooms:
 *                       type: number
 *       400:
 *         description: userInput is required
 *       503:
 *         description: AI service unavailable
 */
export const suggestPreferenceForm = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userInput } = req.body as { userInput?: string };
    if (!userInput || typeof userInput !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "userInput (string) is required.");
    }

    const result = await suggestFormFields("preference", userInput);
    if (!result.success) {
      const err = result as { success: false; error: string };
      const authFail = /authentication failed|OPENAI_API_KEY|not configured/i.test(
        err.error
      );
      const status = authFail
        ? HttpStatusCodes.SERVICE_UNAVAILABLE
        : HttpStatusCodes.BAD_REQUEST;
      throw new RouteError(status, err.error);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Suggested preference form fields from your description.",
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
};
