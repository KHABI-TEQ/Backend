import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import {
  getPractitionerJourney,
  listBrmBook,
} from "../../../services/brmPractitionerJourney.service";

export const listBrmBookAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listBrmBook({
      brmId: req.params.id,
      userType: String(req.query.userType || ""),
      search: String(req.query.search || ""),
      page: parseInt(String(req.query.page || "1"), 10),
      limit: parseInt(String(req.query.limit || "20"), 10),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getBrmPractitionerJourneyAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getPractitionerJourney({
      userId: req.params.userId,
      expectedBrmId: req.params.id,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getPractitionerJourneyAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getPractitionerJourney({
      userId: req.params.userId,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};
