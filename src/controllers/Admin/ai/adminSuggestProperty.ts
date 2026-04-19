import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { suggestFormFields } from "../../../services/aiFormFill.service";

/**
 * POST /admin/users/:userId/ai/suggest-property
 * Body: { userInput: string } — same AI output shape as POST /account/ai/suggest-property.
 */
export const adminSuggestPropertyForUser = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid user id");
    }

    const user = await DB.Models.User.findById(userId).select("userType").lean();
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    const allowed = ["Agent", "Landowners", "Developer"].includes(user.userType);
    if (!allowed) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "AI property suggestions are only for Agent, Landowner, or Developer target users."
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
      message: "Suggested property form fields from description (admin on behalf of user).",
      data: result.data,
      meta: { targetUserId: userId, targetUserType: user.userType },
    });
  } catch (err) {
    next(err);
  }
};
