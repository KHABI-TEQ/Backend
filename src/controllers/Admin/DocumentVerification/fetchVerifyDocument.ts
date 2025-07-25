import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";

// GET: /verification-docs
export const fetchAllVerifyDocs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const filter = (req.query.status as string) || "pending";

    if (
      ![
        "pending",
        "confirmed",
        "rejected",
        "in-progress",
        "successful",
      ].includes(filter)
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid filtering. Filter must be one of: "pending", "confirmed", "rejected", "in-progress" or "successful"`
      );
    }

    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      DB.Models.DocumentVerification.find({ status: filter })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      DB.Models.DocumentVerification.countDocuments({ status: filter }),
    ]);

    const [
      totalDocuments,
      totalVerifiedDocuments,
      confirmedDocs,
      totalAmountAcrossAll,
    ] = await Promise.all([
      DB.Models.DocumentVerification.countDocuments(),
      DB.Models.DocumentVerification.countDocuments({
        status: { $in: ["confirmed", "successful"] },
      }),
      DB.Models.DocumentVerification.aggregate([
        { $match: { status: "confirmed" } },
        { $group: { _id: null, totalAmount: { $sum: "$amountPaid" } } },
      ]),
      DB.Models.DocumentVerification.aggregate([
        { $group: { _id: null, totalAmount: { $sum: "$amountPaid" } } },
      ]),
    ]);

    const totalConfirmedAmount = confirmedDocs[0]?.totalAmount || 0;
    const grandTotalAmount = totalAmountAcrossAll[0]?.totalAmount || 0;

    const verifiedPercentage = totalDocuments
      ? ((totalVerifiedDocuments / totalDocuments) * 100).toFixed(2)
      : "0.00";

    const amountPercentage = grandTotalAmount
      ? ((totalConfirmedAmount / grandTotalAmount) * 100).toFixed(2)
      : "0.00";

    res.status(HttpStatusCodes.OK).json({
      success: true,
      data: records,
      total,
      page,
      stats: {
        totalVerifiedDocuments,
        verifiedPercentage: `${verifiedPercentage}%`,
        totalConfirmedAmount,
        amountPercentage: `${amountPercentage}%`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET: /verification-doc/:documentId
export const fetchSingleVerifyDoc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid document ID");
    }

    const doc = await DB.Models.DocumentVerification.findById(documentId);

    if (!doc) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Verification record not found"
      );
    }

    res.status(HttpStatusCodes.OK).json({
      success: true,
      data: doc,
    });
  } catch (err) {
    next(err);
  }
};
