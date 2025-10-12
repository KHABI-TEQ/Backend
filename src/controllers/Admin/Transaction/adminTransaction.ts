import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";

// Get all transactions
export const getAllTransactions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = "1",
      limit = "20",
      status,
      transactionType,
      transactionFlow,
    } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      transactionType?: string;
      transactionFlow?: string;
    };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};

    // Allowed values
    const allowedStatuses = ["pending", "success", "failed", "cancelled"];
    const allowedTransactionTypes = [
      "payment",
      "withdrawal",
      "deposit",
      "transfer",
      "refund",
      "subscription",
      "shortlet-booking",
      "inspection",
      "document-verification",
    ];
    const allowedTransactionFlows = ["internal", "external"];

    // Apply status filter
    if (status && allowedStatuses.includes(status)) {
      filter.status = status;
    } else {
      // exclude pending by default
      filter.status = { $ne: "pending" };
    }

    // Apply transactionType filter
    if (transactionType && allowedTransactionTypes.includes(transactionType)) {
      filter.transactionType = transactionType;
    }

    // Apply transactionFlow filter
    if (transactionFlow && allowedTransactionFlows.includes(transactionFlow)) {
      filter.transactionFlow = transactionFlow;
    }


    const [transactions, total] = await Promise.all([
      DB.Models.NewTransaction.find(filter)
        .select("-paymentDetails -__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("fromWho.item")
        .lean(),

      DB.Models.NewTransaction.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transactions fetched successfully",
      data: transactions,
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


// Get transaction stats
export const getTransactionStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const [stats, totalSuccessAmount] = await Promise.all([
      DB.Models.NewTransaction.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      DB.Models.NewTransaction.aggregate([
        { $match: { status: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    // Format stats into an object
    const statsMap: Record<string, number> = {};
    stats.forEach((s) => {
      statsMap[s._id] = s.count;
    });

    const response = {
      totalTransactions:
        Object.values(statsMap).reduce((acc, curr) => acc + curr, 0) || 0,
      pending: statsMap["pending"] || 0,
      success: statsMap["success"] || 0,
      failed: statsMap["failed"] || 0,
      cancelled: statsMap["cancelled"] || 0,
      totalSuccessAmount: totalSuccessAmount[0]?.total || 0,
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction stats fetched successfully",
      data: response,
    });
  } catch (err) {
    next(err);
  }
};


// Get single transaction by ID
export const getTransactionById = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid transaction ID");
    }

    const transaction = await DB.Models.NewTransaction.findById(transactionId)
      .populate("fromWho.item")
      .lean();

    if (!transaction) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Transaction not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction fetched successfully",
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};

// Validate transaction (mark as success)
export const validateTransaction = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid transaction ID");
    }

    const transaction = await DB.Models.NewTransaction.findById(transactionId);

    if (!transaction) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Transaction not found");
    }

    if (transaction.status === 'success') {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Transaction already validated",
      });
    }

    transaction.status = "success";
    await transaction.save();

    // You can trigger side effects here e.g., sending email, enabling access, etc.
    // await handleTransactionTypeEffect(transaction);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction validated successfully",
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete transaction details
 */
export const deleteTransactionDetails = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;

    if (!mongoose.isValidObjectId(transactionId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid transaction ID");
    }

    const deleted = await DB.Models.NewTransaction.findByIdAndDelete(transactionId);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Transaction not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};