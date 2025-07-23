import { Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";

interface Request extends Express.Request {
  user?: any;
  body?: any;
  query?: any;
  params?:any;
}

export const getUserInspections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized access.");
    }

    const {
      page = "1",
      limit = "10",
      search = "",
      status,
      inspectionType,
      inspectionStatus,
      stage,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string>;

    const query: any = {
      owner: user._id,
      status: { $nin: ["pending_transaction", "transaction_failed"] },
    };

    if (status) query.status = status;
    if (inspectionType) query.inspectionType = inspectionType;
    if (inspectionStatus) query.inspectionStatus = inspectionStatus;
    if (stage) query.stage = stage;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    if (search.trim() !== "") {
      query.$or = [
        { negotiationPrice: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [inspections, total] = await Promise.all([
      DB.Models.InspectionBooking.find(query)
        .populate("propertyId", "title location price propertyType briefType pictures")
        .populate("transaction", "transactionRef amount status")
        .select("-requestedBy")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DB.Models.InspectionBooking.countDocuments(query),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspections fetched successfully",
      data: {
        inspections,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err: any) {
    console.error("Get User Inspections Error:", err.message);
    next(err);
  }
};
