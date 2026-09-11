import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { resolvePublicSiteByHost } from "../../services/customDomain.service";

export const resolvePublicSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const host = String(req.query.host || "").trim();
    if (!host) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "host is required.");
    }
    try {
      const data = await resolvePublicSiteByHost(host);
      return res.status(HttpStatusCodes.OK).json({ success: true, data });
    } catch (err: any) {
      if (err instanceof RouteError && err.status === HttpStatusCodes.NOT_FOUND) {
        return res.status(HttpStatusCodes.NOT_FOUND).json({
          success: false,
          errorCode: "SITE_NOT_FOUND",
          message: err.message,
          data: null,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};
