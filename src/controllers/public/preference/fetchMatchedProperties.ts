import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import mongoose from "mongoose";
import { formatPropertyDataForTable } from "../../../utils/propertyFormatters";
import {
  attachPublicSlugToFormattedProperties,
  effectiveRevealedCount,
  matchBatchSummary,
  pullNextMatchBatch,
} from "../../../services/matchBatch.service";

export const getPaginatedMatchedProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { matchedId, preferenceId } = req.params;

    if (!matchedId || !mongoose.Types.ObjectId.isValid(matchedId.toString())) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid or missing matchedId");
    }

    const match = await DB.Models.MatchedPreferenceProperty.findById(matchedId)
      .populate({
        path: "matchedProperties",
        populate: { path: "owner" },
      })
      .populate("preference")
      .lean();

    if (!match) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Matched record not found");
    }

    if (
      preferenceId &&
      String((match as any).preference?._id || match.preference) !== String(preferenceId)
    ) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Preference does not match this record");
    }

    const allProperties = (match.matchedProperties || []) as any[];
    const revealed = effectiveRevealedCount({
      revealedCount: (match as any).revealedCount,
      matchedProperties: allProperties,
    });
    const visible = allProperties.slice(0, revealed);

    const page = parseInt(req.query.page as string) || 1;
    const defaultLimit = visible.length || 5;
    const limit = parseInt(req.query.limit as string) || defaultLimit;
    const skip = (page - 1) * limit;
    const paginatedProperties = visible.slice(skip, skip + limit);

    const formattedProperties = paginatedProperties.map((property: any) => {
      const formatted = formatPropertyDataForTable(property);
      return { ...formatted, matchedId: match._id };
    });
    const withSlugs = await attachPublicSlugToFormattedProperties(
      formattedProperties,
      paginatedProperties
    );

    const batch = matchBatchSummary({
      revealedCount: (match as any).revealedCount,
      matchedProperties: allProperties,
      batchAccessToken: (match as any).batchAccessToken,
    });

    const result = {
      matchDetails: {
        _id: match._id,
        status: match.status,
        notes: match.notes,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      },
      preference: match.preference,
      matchedProperties: withSlugs,
      batch: {
        revealedCount: batch.revealedCount,
        total: batch.total,
        remaining: batch.remaining,
        hasMore: batch.hasMore,
        nextBatchSize: batch.nextBatchSize,
      },
    };

    res.status(HttpStatusCodes.OK).json({
      success: true,
      data: result,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(visible.length / limit) || 1,
        total: visible.length,
        totalMatched: batch.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const pullNextMatchedPropertiesBatch = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { matchedId, preferenceId } = req.params;
    const token = String(
      (req.query.token as string) || (req.body as any)?.token || ""
    ).trim();

    if (!matchedId || !preferenceId) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "matchedId and preferenceId are required"
      );
    }

    const wantsRedirect =
      req.method === "GET" || String(req.query.redirect || "") === "1";

    const result = await pullNextMatchBatch({
      matchedId,
      preferenceId,
      token: token || undefined,
      notify: false,
    });

    if (wantsRedirect && result.matchLink) {
      const sep = result.matchLink.includes("?") ? "&" : "?";
      const extra = result.newlyRevealedIds.length
        ? `${sep}batch=next`
        : `${sep}batch=done`;
      return res.redirect(result.matchLink + extra);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: result.newlyRevealedIds.length
        ? "Next batch of matches is ready."
        : "All matches have already been shown.",
      data: {
        batch: {
          revealedCount: result.batch.revealedCount,
          total: result.batch.total,
          remaining: result.batch.remaining,
          hasMore: result.batch.hasMore,
          nextBatchSize: result.batch.nextBatchSize,
        },
        newlyRevealedCount: result.newlyRevealedIds.length,
        matchLink: result.matchLink,
      },
    });
  } catch (err: any) {
    if (err?.status) {
      return next(new RouteError(err.status, err.message));
    }
    next(err);
  }
};
