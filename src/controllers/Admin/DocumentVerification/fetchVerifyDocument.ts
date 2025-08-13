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
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit as string) || 10, 1);
    const filter = (req.query.status as string) || "pending";

    const allowedStatuses = [
      "pending",
      "confirmed",
      "rejected",
      "in-progress",
      "successful",
    ];

    if (!allowedStatuses.includes(filter)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid filter. Must be one of: ${allowedStatuses.join(", ")}`
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

    const totalPages = Math.ceil(total / limit);

    res.status(HttpStatusCodes.OK).json({
      success: true,
      data: records,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET: /verification-docs/stats
export const fetchVerifyDocStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const allowedStatuses = [
      "pending",
      "confirmed",
      "rejected",
      "in-progress",
      "successful",
    ];

    // Count each status individually
    const statusCountsPromise = allowedStatuses.map((status) =>
      DB.Models.DocumentVerification.countDocuments({ status })
    );

    // Run all promises in parallel
    const [
      totalDocuments,
      totalVerifiedDocuments,
      confirmedDocsAgg,
      totalDocsAgg,
      ...statusCounts
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
      ...statusCountsPromise,
    ]);

    const totalConfirmedAmount = confirmedDocsAgg[0]?.totalAmount || 0;
    const grandTotalAmount = totalDocsAgg[0]?.totalAmount || 0;

    const verifiedPercentage = totalDocuments
      ? ((totalVerifiedDocuments / totalDocuments) * 100).toFixed(2)
      : "0.00";

    const amountPercentage = grandTotalAmount
      ? ((totalConfirmedAmount / grandTotalAmount) * 100).toFixed(2)
      : "0.00";

    const statusBreakdown = allowedStatuses.reduce((acc, status, index) => {
      acc[status] = statusCounts[index];
      return acc;
    }, {} as Record<string, number>);

    res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        totalDocuments,
        totalVerifiedDocuments,
        verifiedPercentage: `${verifiedPercentage}%`,
        totalConfirmedAmount,
        grandTotalAmount,
        amountPercentage: `${amountPercentage}%`,
        statusBreakdown,
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

    const doc = await DB.Models.DocumentVerification
      .findById(documentId)
      .populate({
        path: "transaction",
        model: "newTransaction",
        select: "-__v",
      });

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


// DELETE: /verification-doc/:documentId
export const deleteVerifyDoc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid document ID");
    }

    // Find the document
    const doc = await DB.Models.DocumentVerification.findById(documentId);

    if (!doc) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Verification record not found"
      );
    }

    // If linked to a transaction, delete it
    if (doc.transaction) {
      await DB.Models.NewTransaction.findByIdAndDelete(doc.transaction);
    }

    // Delete the document verification record
    await DB.Models.DocumentVerification.findByIdAndDelete(documentId);

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Document verification and related transaction deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};


