import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { suggestFormFields } from "../../services/aiFormFill.service";

/**
 * POST /account/ai/suggest-property
 * Authenticated Agent, Landlord, or Developer: get AI-suggested property form fields from natural language.
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
      const status =
        err.error === "AI service is not configured"
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
      const status =
        err.error === "AI service is not configured"
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
