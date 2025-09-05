import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { RouteError } from "../../common/classes";

export const fetchUserTransactions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;

    const { page = 1, limit = 10, transactionType } = req.query;

    // Filter to only fetch the user's transactions with allowed statuses
    const filter: any = {
      "fromWho.kind": "User",
      "fromWho.item": userId,
      status: { $in: ["failed", "success", "cancelled"] },
    };

    if (transactionType) {
      filter.transactionType = transactionType;
    }

    const transactions = await DB.Models.NewTransaction.find(filter)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.NewTransaction.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: transactions,
      pagination: {
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



/**
 * Fetch details of a single transaction for the authenticated user
 */
export const getUserTransactionDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactionId } = req.params;

    // Allowed statuses
    const allowedStatuses = ["success", "failed", "cancelled"];

    const transaction = await DB.Models.NewTransaction.findOne({
      _id: transactionId,
      "fromWho.item": req.user._id,
      "fromWho.kind": "User",
      status: { $in: allowedStatuses },
    })
      .populate("fromWho.item", "firstName lastName email")
      .lean();

    if (!transaction) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Transaction not found or not accessible")
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};


