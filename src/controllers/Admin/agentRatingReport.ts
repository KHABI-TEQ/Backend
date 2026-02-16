import { Request, Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import mongoose from "mongoose";

/**
 * GET /admin/ratings
 * List all agent ratings for investigation. Query: agentId, inspectionId, page, limit.
 */
export const adminListRatings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, inspectionId, page = 1, limit = 20 } = req.query;
    const filter: Record<string, unknown> = {};
    if (agentId && mongoose.isValidObjectId(agentId)) filter.agentId = agentId;
    if (inspectionId && mongoose.isValidObjectId(inspectionId)) filter.inspectionId = inspectionId;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [ratings, total] = await Promise.all([
      DB.Models.AgentRating.find(filter)
        .populate("agentId", "firstName lastName fullName email")
        .populate("buyerId", "fullName email phoneNumber")
        .populate("inspectionId", "inspectionDate inspectionTime status stage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.AgentRating.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Ratings fetched successfully",
      data: ratings,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/reports
 * List all complaints/reports for investigation. Query: status, reportedAgentId, page, limit.
 */
export const adminListReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reportedAgentId, page = 1, limit = 20 } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (reportedAgentId && mongoose.isValidObjectId(reportedAgentId))
      filter.reportedAgentId = reportedAgentId;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [reports, total] = await Promise.all([
      DB.Models.AgentReport.find(filter)
        .populate("reportedAgentId", "firstName lastName fullName email")
        .populate("reportedBy", "fullName email phoneNumber")
        .populate("inspectionId", "inspectionDate inspectionTime status stage propertyId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.AgentReport.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Reports fetched successfully",
      data: reports,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/reports/:id
 * Single report for investigation.
 */
export const adminGetReportById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid report ID");
    }

    const report = await DB.Models.AgentReport.findById(id)
      .populate("reportedAgentId", "firstName lastName fullName email phoneNumber")
      .populate("reportedBy", "fullName email phoneNumber")
      .populate({
        path: "inspectionId",
        populate: { path: "propertyId", select: "title location propertyType price" },
      })
      .lean();

    if (!report) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Report not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /admin/reports/:id
 * Update report status and/or admin notes for investigation workflow.
 * Body: { status?: "pending" | "reviewed" | "resolved" | "dismissed", adminNotes?: string }
 */
export const adminUpdateReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid report ID");
    }

    const update: Record<string, unknown> = {};
    const validStatuses = ["pending", "reviewed", "resolved", "dismissed"];
    if (status !== undefined) {
      if (!validStatuses.includes(status)) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `status must be one of: ${validStatuses.join(", ")}`
        );
      }
      update.status = status;
    }
    if (adminNotes !== undefined) update.adminNotes = adminNotes;

    if (Object.keys(update).length === 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Provide status and/or adminNotes to update");
    }

    const report = await DB.Models.AgentReport.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    )
      .populate("reportedAgentId", "firstName lastName fullName email")
      .populate("reportedBy", "fullName email")
      .lean();

    if (!report) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Report not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Report updated successfully",
      data: report,
    });
  } catch (err) {
    next(err);
  }
};
