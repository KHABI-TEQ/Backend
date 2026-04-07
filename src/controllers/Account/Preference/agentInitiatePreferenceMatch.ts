import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { autoPairPreferenceById } from "../../../services/autoPreferencePairing.service";
import { dealSiteBaseUrlFromPublicSlug } from "../../../utils/matchedPropertiesDealSiteUrl";

/**
 * Running DealSite for this user → base URL for match emails (buyer lands on agent public page).
 */
async function getRunningDealSiteBaseUrlForUser(userId: unknown): Promise<string | null> {
  const site = await DB.Models.DealSite.findOne({
    createdBy: userId,
    status: "running",
  })
    .sort({ createdAt: -1 })
    .select("publicSlug")
    .lean();
  const slug = (site as any)?.publicSlug;
  if (!slug || !String(slug).trim()) return null;
  return dealSiteBaseUrlFromPublicSlug(String(slug));
}

/**
 * Agent (authenticated user with an active DealSite) runs auto-pairing for a general marketplace preference.
 * Match email links use this agent’s DealSite origin.
 */
export const agentInitiatePreferenceMatch = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return next(new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized"));
    }

    const { preferenceId } = req.params;
    if (!preferenceId || !mongoose.Types.ObjectId.isValid(preferenceId)) {
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference id"));
    }

    const matchBaseUrl = await getRunningDealSiteBaseUrlForUser(userId);
    if (!matchBaseUrl) {
      return next(
        new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "You need an active public access page (DealSite status: running) to match preferences for buyers.",
        ),
      );
    }

    const preference = await DB.Models.Preference.findById(preferenceId).lean();
    if (!preference) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found"));
    }

    if ((preference as any).receiverMode?.type === "dealSite") {
      return next(
        new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "This preference was submitted on an agent DealSite; matching is not available through the general marketplace action.",
        ),
      );
    }

    if (!["approved", "matched"].includes(String((preference as any).status))) {
      return next(
        new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Only approved or matched general preferences can be processed.",
        ),
      );
    }

    const result = await autoPairPreferenceById(preferenceId, {
      sendMatchEmail: true,
      sendNoMatchEmail: true,
      matchEmailBaseUrlOverride: matchBaseUrl,
      matchNotes:
        "Matched from the agent marketplace; view matches on the agent’s public access page.",
    });

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        result.matchedCount > 0
          ? `Found ${result.matchedCount} matching listing(s). The buyer was emailed with a link to your public page.`
          : "No matching listings were found. The buyer was emailed with a no-match notice.",
      data: {
        matchedCount: result.matchedCount,
        matchEmailBaseUrl: matchBaseUrl,
      },
    });
  } catch (err) {
    next(err);
  }
};
