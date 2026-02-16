import { Request, Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { JoiValidator } from "../../validators/JoiValidator";
import {
  submitRatingSchemaPublic,
  submitReportSchemaPublic,
} from "../../validators/agentRatingReport.validator";
import mongoose from "mongoose";

const COMPLETED_STAGE = "completed";
const COMPLETED_STATUS = "completed";

/**
 * Verify that the given email belongs to the buyer (requestedBy) for this inspection.
 * Inspection must be fully completed. No auth required.
 * Applies to both general and DealSite inspections (same InspectionBooking model).
 */
async function ensureBuyerEmailForInspection(
  inspectionId: string,
  email: string
): Promise<{ inspection: any; buyerId: mongoose.Types.ObjectId }> {
  if (!mongoose.isValidObjectId(inspectionId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid inspection ID");
  }
  const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
    .populate("requestedBy")
    .populate("propertyId")
    .lean();
  if (!inspection) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
  }
  if ((inspection as any).stage !== COMPLETED_STAGE || (inspection as any).status !== COMPLETED_STATUS) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "You can only rate or report after the inspection flow is fully completed"
    );
  }
  const buyer = (inspection as any).requestedBy;
  if (!buyer || (buyer.email || "").toLowerCase() !== (email || "").toLowerCase()) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "This email does not match the buyer for this inspection");
  }
  return { inspection: inspection as any, buyerId: buyer._id };
}

/**
 * POST (public, no auth) /inspections/:inspectionId/rate
 * Buyer submits a rating (1-5) and optional comment. Identified by email (must match inspection requestedBy).
 * One rating per inspection. Works for both general and DealSite inspections.
 */
export const submitInspectionRatingPublic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;
    const validation = JoiValidator.validate(submitRatingSchemaPublic, req.body);
    if (!validation.success) {
      const msg = validation.errors?.map((e) => `${e.field}: ${e.message}`).join(", ") || "Validation failed";
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, msg);
    }

    const { email, rating, comment } = validation.data!;
    const { inspection, buyerId } = await ensureBuyerEmailForInspection(inspectionId, email);
    const agentId = inspection.owner;

    const existing = await DB.Models.AgentRating.findOne({ inspectionId }).lean();
    if (existing) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "This inspection has already been rated");
    }

    const doc = await DB.Models.AgentRating.create({
      inspectionId,
      buyerId,
      agentId,
      rating: Number(rating),
      comment: comment || undefined,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Rating submitted successfully",
      data: { rating: doc.rating, comment: doc.comment, createdAt: doc.createdAt },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST (public, no auth) /inspections/:inspectionId/report
 * Buyer submits a complaint/report. Identified by email (must match inspection requestedBy).
 * Works for both general and DealSite inspections.
 */
export const submitInspectionReportPublic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;
    const validation = JoiValidator.validate(submitReportSchemaPublic, req.body);
    if (!validation.success) {
      const msg = validation.errors?.map((e) => `${e.field}: ${e.message}`).join(", ") || "Validation failed";
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, msg);
    }

    const { email, category, subject, description } = validation.data!;
    const { inspection, buyerId } = await ensureBuyerEmailForInspection(inspectionId, email);
    const reportedAgentId = inspection.owner;

    const doc = await DB.Models.AgentReport.create({
      inspectionId,
      reportedBy: buyerId,
      reportedByModel: "Buyer",
      reportedAgentId,
      category,
      subject: subject || undefined,
      description: description.trim(),
      status: "pending",
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Report submitted successfully. Our team will review it.",
      data: { id: doc._id, category: doc.category, status: doc.status, createdAt: doc.createdAt },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET (public, no auth) /agent/:agentId/rating-summary
 * Aggregate rating for an agent for landing page / prospective buyers.
 */
export const getAgentRatingSummaryPublic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { agentId } = req.params;
    if (!mongoose.isValidObjectId(agentId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid agent ID");
    }

    const [summary] = await DB.Models.AgentRating.aggregate([
      { $match: { agentId: new mongoose.Types.ObjectId(agentId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          fiveStar: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStar: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStar: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStar: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        },
      },
    ]);

    const data = summary
      ? {
          agentId,
          averageRating: Math.round((summary.averageRating as number) * 100) / 100,
          totalRatings: summary.totalRatings,
          distribution: {
            5: summary.fiveStar,
            4: summary.fourStar,
            3: summary.threeStar,
            2: summary.twoStar,
            1: summary.oneStar,
          },
        }
      : {
          agentId,
          averageRating: 0,
          totalRatings: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET (public, no auth) /agent/:agentId/ratings
 * Recent ratings for an agent (for landing page). Returns only rating, comment, createdAt (no buyer PII).
 */
export const getAgentRatingsPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    if (!mongoose.isValidObjectId(agentId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid agent ID");
    }

    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const skip = (page - 1) * limit;

    const [ratings, total] = await Promise.all([
      DB.Models.AgentRating.find({ agentId })
        .select("rating comment createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DB.Models.AgentRating.countDocuments({ agentId }),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: ratings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
