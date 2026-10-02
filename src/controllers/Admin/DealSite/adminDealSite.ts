import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { dealSiteActivityService } from "../../../services/dealSiteActivity.service";
import { PaystackService } from "../../../services/paystack.service";
import { reconcileRunningDealSitesWithoutActiveSubscription } from "../../../services/dealSiteReconciliation.service";
import { dealSiteOriginFromPublicSlug } from "../../../config/dealSitePublicHost";


/**
 * Admin - Get all DealSites (with pagination and optional status filter)
 */
/**
 * @swagger
 * /admin/deal-sites/getAll:
 *   get:
 *     tags:
 *       - Admin > DealSite
 *     summary: Get all deal sites
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deal sites fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const adminGetAllDealSites = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = "1",
      limit = "20",
      status,
    } = req.query as { page?: string; limit?: string; status?: string };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const projection = {
      _id: 1,
      publicSlug: 1,
      title: 1,
      keywords: 1,
      description: 1,
      logoUrl: 1,
      status: 1,
      createdBy: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [dealSites, total] = await Promise.all([
      DB.Models.DealSite.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select(projection)
        .lean(),

      DB.Models.DealSite.countDocuments(filter),
    ]);

    // 🔹 Add publicPageUrl to each dealSite (hostname from DEALSITE_ROOT_HOST, default khabiteq.com)
    const formattedDealSites = dealSites.map((site) => ({
      ...site,
      publicPageUrl: `${dealSiteOriginFromPublicSlug(site.publicSlug)}/`,
    }));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access pages fetched successfully",
      data: formattedDealSites,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Admin - Get DealSite stats (group by status)
 */
/**
 * @swagger
 * /admin/deal-sites/stats:
 *   get:
 *     tags:
 *       - Admin > DealSite
 *     summary: Get deal site statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deal site stats fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const adminGetDealSiteStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const stats = await DB.Models.DealSite.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page stats fetched successfully",
      stats: stats.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        {} as Record<string, number>
      ),
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Admin - Get single DealSite by publicSlug
 */
/**
 * @swagger
 * /admin/deal-sites/{publicSlug}:
 *   get:
 *     tags:
 *       - Admin > DealSite
 *     summary: Get deal site by slug
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deal site fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Deal site not found
 */
export const adminGetDealSiteBySlug = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    const dealSite = await DB.Models.DealSite.findOne({ publicSlug })
      .populate("createdBy", "email phoneNumber firstName lastName userType") // only pick these fields
      .lean();

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // 🔹 Add publicPageUrl
    const publicPageUrl = `${dealSiteOriginFromPublicSlug((dealSite as any).publicSlug)}/`;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page fetched successfully",
      data: {
        ...dealSite,
        publicPageUrl,
      },
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Admin - Pause DealSite
 */
export const adminPauseDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    const dealSite = await DB.Models.DealSite.findOneAndUpdate(
      { publicSlug },
      { status: "paused", pausedByPolicy: "manual" },
      { new: true }
    );

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    await dealSiteActivityService.logActivity({
      dealSiteId: dealSite._id.toString(),
      actorId: req.admin._id,
      actorModel: "Admin",
      category: "deal-paused",
      action: "Paused Public access page",
      description: "Admin temporarily paused the Public access page due to verification review",
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page paused successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Admin - Pause DealSite
 */
/**
 * @swagger
 * /admin/deal-sites/{publicSlug}/putOnHold:
 *   put:
 *     tags:
 *       - Admin > DealSite
 *     summary: Put deal site on hold
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deal site put on hold successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Deal site not found
 */
export const adminPutOnHoldDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    const dealSite = await DB.Models.DealSite.findOneAndUpdate(
      { publicSlug },
      { status: "on-hold" },
      { new: true }
    );

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    await dealSiteActivityService.logActivity({
      dealSiteId: dealSite._id.toString(),
      actorId: req.admin._id,
      actorModel: "Admin",
      category: "deal-onHold",
      action: "Public access page placed on hold",
      description: "An admin placed this public access page on hold pending further review.",
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page Put on Hold successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Resume/Activate DealSite
 */
/**
 * @swagger
 * /admin/deal-sites/{publicSlug}/resume:
 *   put:
 *     tags:
 *       - Admin > DealSite
 *     summary: Resume deal site
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deal site resumed successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Deal site not found
 */
export const adminActivateDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    const dealSite = await DB.Models.DealSite.findOneAndUpdate(
      { publicSlug },
      { status: "running" },
      { new: true }
    );

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    await dealSiteActivityService.logActivity({
      dealSiteId: dealSite._id.toString(),
      actorId: req.admin._id,
      actorModel: "Admin",
      category: "deal-resumed",
      action: "Public access page resumed",
      description: "An admin resumed this Public access page after completing the necessary review.",
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page activated successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Admin - Get all reports for a DealSite (by publicSlug)
 */
/**
 * @swagger
 * /admin/deal-sites/{publicSlug}/reports:
 *   get:
 *     tags:
 *       - Admin > DealSite
 *     summary: Get deal site reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reports fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Deal site not found
 */
export const adminGetDealSiteReports = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const { page = "1", limit = "20", status } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
    };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    // 🔹 Ensure the DealSite exists
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug })
      .select("_id title publicSlug")
      .lean();

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // 🔹 Build report filter
    const filter: Record<string, any> = { dealSite: dealSite._id };
    if (status) filter.status = status;

    // 🔹 Fetch reports with pagination
    const [reports, total] = await Promise.all([
      DB.Models.DealSiteReport.find(filter)
        .populate("reportedBy", "firstName lastName email phoneNumber userType")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.DealSiteReport.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page reports fetched successfully",
      data: reports,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Admin - Get all activities for a DealSite (by publicSlug)
 */
/**
 * @swagger
 * /admin/deal-sites/{publicSlug}/logs:
 *   get:
 *     tags:
 *       - Admin > DealSite
 *     summary: Get deal site activity logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: publicSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity logs fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Deal site not found
 */
export const adminGetDealSiteActivities = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const { page = "1", limit = "20", category } = req.query as {
      page?: string;
      limit?: string;
      category?: string;
    };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    // 🔹 Ensure the DealSite exists
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug })
      .select("_id title publicSlug")
      .lean();

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // 🔹 Build filter
    const filter: Record<string, any> = { dealSite: dealSite._id };
    if (category) filter.category = category;

    // 🔹 Fetch activities with pagination
    const [activities, total] = await Promise.all([
      DB.Models.DealSiteActivity.find(filter)
        .populate("actor", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      DB.Models.DealSiteActivity.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page activities fetched successfully",
      data: activities,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/deal-sites/bank-list
 * Paystack settlement bank list for DealSite subaccount setup (admin JWT; same payload as GET /account/dealSite/bankList).
 */
/**
 * @swagger
 * /admin/deal-sites/bank-list:
 *   get:
 *     tags:
 *       - Admin > DealSite
 *     summary: Get deal site bank list
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank list fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const adminGetDealSiteBankList = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PaystackService.getBankList();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Run DealSite subscription reconciliation immediately
 */
export const adminRunDealSiteSubscriptionReconciliation = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await reconcileRunningDealSitesWithoutActiveSubscription();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Practitioner Page subscription reconciliation completed successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
