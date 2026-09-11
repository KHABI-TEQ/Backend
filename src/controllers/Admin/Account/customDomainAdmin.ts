import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import {
  forwardCustomDomainRequest,
  markCustomDomainLive,
  rejectCustomDomainRequest,
} from "../../../services/customDomain.service";

export const listCustomDomainRequests = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const status = String(req.query.status || "").trim();
    const filter: Record<string, unknown> = {};
    if (status === "expiring") {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      const now = new Date();
      const sites = await Promise.all([
        DB.Models.DealSite.find({
          customDomainStatus: "live",
          customDomainExpiresAt: { $gte: now, $lte: in30 },
        })
          .select("_id")
          .lean(),
        DB.Models.ProfessionalSite.find({
          customDomainStatus: "live",
          customDomainExpiresAt: { $gte: now, $lte: in30 },
        })
          .select("_id")
          .lean(),
      ]);
      const ids = [...sites[0], ...sites[1]].map((s) => s._id);
      filter.siteId = { $in: ids };
      filter.status = "live";
    } else if (status === "disabled") {
      const sites = await Promise.all([
        DB.Models.DealSite.find({ customDomainStatus: "disabled" })
          .select("_id")
          .lean(),
        DB.Models.ProfessionalSite.find({ customDomainStatus: "disabled" })
          .select("_id")
          .lean(),
      ]);
      const ids = [...sites[0], ...sites[1]].map((s) => s._id);
      filter.siteId = { $in: ids };
    } else if (status) {
      filter.status = status;
    }

    const requests = await DB.Models.CustomDomainRequest.find(filter)
      .populate("ownerId", "firstName lastName email phoneNumber userType")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    return res.status(HttpStatusCodes.OK).json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

export const forwardCustomDomainRequestAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await forwardCustomDomainRequest(
      req.params.id,
      req.body?.adminNote
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Forwarded to tech team.",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const markCustomDomainLiveAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { customDomain, expiresAt, techNote } = req.body || {};
    if (!customDomain) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "customDomain is required."
      );
    }
    const data = await markCustomDomainLive({
      requestId: req.params.id,
      customDomain,
      expiresAt,
      techNote,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Custom domain is live.",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const rejectCustomDomainRequestAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await rejectCustomDomainRequest(
      req.params.id,
      req.body?.adminNote
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Request rejected.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
