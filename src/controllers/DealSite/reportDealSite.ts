import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
 
// ✅ Controller: Report a DealSite
export const reportDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { publicSlug } = req.params;

    const { reportedBy, reason, description } = req.body;

    // ✅ Validate required fields
    if (!reportedBy?.email || !reason) {
      res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        errorCode: "VALIDATION_FAILED",
        message: "Reporter email and reason are required",
        data: null,
      });
      return;
    }

    // ✅ Find DealSite
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug }).lean();
    if (!dealSite) {
      res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "DealSite not found",
        data: null,
      });
      return;
    }

    // ✅ Save or update reporter (can use Buyer model for consistency)
    const reporter = await DB.Models.Buyer.findOneAndUpdate(
      { email: reportedBy.email },
      { $setOnInsert: reportedBy },
      { upsert: true, new: true },
    );

    // ✅ Create report
    const report = await DB.Models.DealSiteReport.create({
      dealSite: dealSite._id,
      reportedBy: reporter._id,
      reportedByModel: "Buyer",
      reason,
      description: description || null,
      status: "pending", // could be: pending, reviewed, resolved, dismissed
    });

    res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "DealSite reported successfully",
      data: {
        report,
      },
    });
  } catch (error) {
    console.error("reportDealSite error:", error);
    next(error);
  }
};
