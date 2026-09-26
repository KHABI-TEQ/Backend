import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  getSeekerJourneyByPreferenceId,
  listSeekerJourneys,
} from "../../../services/seekerJourneyTrail.service";

export const listAdminSeekerJourneys = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = "1", limit = "20", insured, search } = req.query as {
      page?: string;
      limit?: string;
      insured?: string;
      search?: string;
    };
    const data = await listSeekerJourneys({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      insured: insured === "yes" || insured === "no" ? insured : undefined,
      search,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: data.journeys,
      pagination: data.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminSeekerJourney = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const journey = await getSeekerJourneyByPreferenceId(req.params.preferenceId);
    if (!journey) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Seeker journey not found");
    }
    return res.status(HttpStatusCodes.OK).json({ success: true, data: journey });
  } catch (err) {
    next(err);
  }
};
