import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";

export const fetchUserInspections = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      inspectionType,
      inspectionMode,
      inspectionStatus,
      stage,
      propertyId,
    } = req.query;

    const filter: any = {
      owner: req.user._id,
    };

    if (status) filter.status = status;
    if (inspectionType) filter.inspectionType = inspectionType;
    if (inspectionMode) filter.inspectionMode = inspectionMode;
    if (inspectionStatus) filter.inspectionStatus = inspectionStatus;
    if (stage) filter.stage = stage;
    if (propertyId) filter.propertyId = propertyId;

    const inspections = await DB.Models.InspectionBooking.find(filter)
      .populate("propertyId")
      .populate("requestedBy")
      .populate("transaction")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await DB.Models.InspectionBooking.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: inspections,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};
