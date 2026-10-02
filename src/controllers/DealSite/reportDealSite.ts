import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { notifyAllActiveAdmins } from "../../services/adminNotification.service";
 
// ✅ Controller: Report a DealSite
/**
 * @swagger
 * /account/dealSite/:publicSlug/reportDealPage:
 *   post:
 *     tags:
 *       - Account > DealSite
 *     summary: Report deal site
 *     security: []
 *     parameters:
 *       - name: publicSlug
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for reporting
 *     responses:
 *       201:
 *         description: Deal site reported successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Deal site not found
 */
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

    void notifyAllActiveAdmins({
      type: "dealsite_reported",
      title: "DealSite reported",
      message: `DealSite "${publicSlug}" was reported (${reason}).`,
      meta: {
        reportId: String(report._id),
        dealSiteId: String(dealSite._id),
        publicSlug,
        reason,
      },
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
