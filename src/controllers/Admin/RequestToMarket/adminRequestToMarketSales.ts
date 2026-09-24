import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { DB } from "../..";
import { getPropertyTitleFromLocation } from "../../../utils/helper";

const RECEIPT_STATUSES = ["pending", "verified", "rejected"] as const;
const PUBLISHER_TYPES = ["Landowners", "Developer"] as const;
const REGISTERED_SALE_FILTER = {
  saleRegisteredAt: { $exists: true, $ne: null as Date | null },
};

type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

function personName(user: any): string {
  if (!user) return "";
  return (
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    ""
  );
}

function effectiveReceiptStatus(doc: any): ReceiptStatus | null {
  if (!doc?.saleRegisteredAt) return null;
  if (RECEIPT_STATUSES.includes(doc.receiptVerificationStatus)) {
    return doc.receiptVerificationStatus;
  }
  return "pending";
}

function serializeSale(doc: any) {
  const property = doc.propertyId && typeof doc.propertyId === "object" ? doc.propertyId : null;
  const publisher = doc.publisherId && typeof doc.publisherId === "object" ? doc.publisherId : null;
  const agent =
    doc.requestedByAgentId && typeof doc.requestedByAgentId === "object"
      ? doc.requestedByAgentId
      : null;
  const reviewer =
    doc.receiptVerifiedBy && typeof doc.receiptVerifiedBy === "object"
      ? doc.receiptVerifiedBy
      : null;
  const salePrice = Number(doc.actualSalePriceNaira) || 0;
  const commissionPercent = Number(doc.commissionPercent) || 0;
  const agentCommissionAmount =
    Number(doc.agentCommissionAmount) > 0
      ? Math.round(doc.agentCommissionAmount)
      : Math.round((salePrice * commissionPercent) / 100);

  return {
    _id: doc._id,
    status: doc.status,
    publisherType: doc.publisherType,
    actualSalePriceNaira: salePrice,
    commissionPercent,
    agentCommissionAmount,
    saleRegisteredAt: doc.saleRegisteredAt || null,
    commissionReceiptUrl: doc.commissionReceiptUrl || null,
    receiptVerificationStatus: effectiveReceiptStatus(doc),
    receiptVerifiedAt: doc.receiptVerifiedAt || null,
    receiptVerificationNote: doc.receiptVerificationNote || "",
    receiptVerifiedBy: reviewer
      ? {
          _id: reviewer._id,
          name: personName(reviewer) || reviewer.email || "Admin",
          email: reviewer.email || "",
        }
      : null,
    property: property
      ? {
          _id: property._id,
          summary: getPropertyTitleFromLocation(property.location),
          location: property.location || null,
          price: property.price,
          propertyType: property.propertyType,
          briefType: property.briefType,
          propertyCode: property.propertyCode,
          status: property.status,
          pictures: Array.isArray(property.pictures) ? property.pictures.slice(0, 1) : [],
        }
      : null,
    publisher: publisher
      ? {
          _id: publisher._id,
          name: personName(publisher) || publisher.email || "Publisher",
          email: publisher.email || "",
          phoneNumber: publisher.phoneNumber || "",
          userType: publisher.userType || doc.publisherType,
        }
      : null,
    agent: agent
      ? {
          _id: agent._id,
          name: personName(agent) || agent.email || "Agent",
          email: agent.email || "",
          phoneNumber: agent.phoneNumber || "",
        }
      : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const SALE_POPULATE = [
  {
    path: "propertyId",
    select:
      "location price briefType propertyType status pictures propertyCode additionalFeatures",
  },
  { path: "publisherId", select: "firstName lastName fullName email phoneNumber userType" },
  { path: "requestedByAgentId", select: "firstName lastName fullName email phoneNumber" },
  { path: "receiptVerifiedBy", select: "firstName lastName email" },
];

async function searchUserIds(term: string) {
  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const users = await DB.Models.User.find({
    $or: [{ fullName: regex }, { firstName: regex }, { lastName: regex }, { email: regex }],
  })
    .select("_id")
    .lean();
  return users.map((u) => u._id);
}

/**
 * GET /admin/request-to-market-sales
 * Registered sales from Developers/Landowners after accepting an Agent request.
 */
export const listRequestToMarketSales = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = "1",
      limit = "20",
      receiptStatus,
      publisherType,
      search,
    } = req.query as {
      page?: string;
      limit?: string;
      receiptStatus?: string;
      publisherType?: string;
      search?: string;
    };

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { ...REGISTERED_SALE_FILTER };

    if (publisherType && PUBLISHER_TYPES.includes(publisherType as (typeof PUBLISHER_TYPES)[number])) {
      filter.publisherType = publisherType;
    }

    if (receiptStatus === "verified" || receiptStatus === "rejected") {
      filter.receiptVerificationStatus = receiptStatus;
    } else if (receiptStatus === "pending") {
      filter.$or = [
        { receiptVerificationStatus: "pending" },
        { receiptVerificationStatus: { $exists: false } },
        { receiptVerificationStatus: null },
      ];
    } else if (receiptStatus === "no_receipt") {
      filter.$or = [
        { commissionReceiptUrl: { $exists: false } },
        { commissionReceiptUrl: null },
        { commissionReceiptUrl: "" },
      ];
    }

    const term = String(search || "").trim();
    if (term) {
      const userIds = await searchUserIds(term);
      const searchClause = {
        $or: [
          { publisherId: { $in: userIds } },
          { requestedByAgentId: { $in: userIds } },
          { commissionReceiptUrl: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        ],
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchClause];
        delete filter.$or;
      } else {
        Object.assign(filter, searchClause);
      }
    }

    const [rows, total] = await Promise.all([
      DB.Models.RequestToMarket.find(filter)
        .populate(SALE_POPULATE)
        .sort({ saleRegisteredAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.RequestToMarket.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Registered agent sales fetched successfully",
      data: rows.map(serializeSale),
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

/**
 * GET /admin/request-to-market-sales/stats
 */
export const getRequestToMarketSaleStats = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const registeredFilter = REGISTERED_SALE_FILTER;
    const [total, pending, verified, rejected, withReceipt] = await Promise.all([
      DB.Models.RequestToMarket.countDocuments(registeredFilter),
      DB.Models.RequestToMarket.countDocuments({
        ...registeredFilter,
        $or: [
          { receiptVerificationStatus: "pending" },
          { receiptVerificationStatus: { $exists: false } },
          { receiptVerificationStatus: null },
        ],
      }),
      DB.Models.RequestToMarket.countDocuments({
        ...registeredFilter,
        receiptVerificationStatus: "verified",
      }),
      DB.Models.RequestToMarket.countDocuments({
        ...registeredFilter,
        receiptVerificationStatus: "rejected",
      }),
      DB.Models.RequestToMarket.countDocuments({
        ...registeredFilter,
        commissionReceiptUrl: { $exists: true, $nin: [null, ""] },
      }),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Request-to-market sale stats",
      data: {
        total,
        pending,
        verified,
        rejected,
        withReceipt,
        withoutReceipt: Math.max(0, total - withReceipt),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/request-to-market-sales/:requestId
 */
export const getRequestToMarketSaleById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { requestId } = req.params;
    const row = await DB.Models.RequestToMarket.findById(requestId)
      .populate(SALE_POPULATE)
      .lean();

    if (!row || !(row as any).saleRegisteredAt) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Registered sale not found",
        data: null,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Registered sale details",
      data: serializeSale(row),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /admin/request-to-market-sales/:requestId/verify
 * Body: { action: "verify" | "reject", note?: string }
 */
export const verifyRequestToMarketSaleReceipt = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { requestId } = req.params;
    const { action, note } = req.body as { action?: string; note?: string };

    if (action !== "verify" && action !== "reject") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "action must be verify or reject."
      );
    }

    const row = await DB.Models.RequestToMarket.findById(requestId);
    if (!row || !(row as any).saleRegisteredAt) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Registered sale not found.");
    }

    if (action === "verify" && !(row as any).commissionReceiptUrl) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This sale has no commission receipt to verify."
      );
    }

    (row as any).receiptVerificationStatus = action === "verify" ? "verified" : "rejected";
    (row as any).receiptVerifiedAt = new Date();
    (row as any).receiptVerifiedBy = req.admin?._id;
    if (typeof note === "string") {
      (row as any).receiptVerificationNote = note.trim();
    }
    await row.save();

    const populated = await DB.Models.RequestToMarket.findById(requestId)
      .populate(SALE_POPULATE)
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: action === "verify" ? "Receipt verified." : "Receipt rejected.",
      data: serializeSale(populated),
    });
  } catch (err) {
    next(err);
  }
};
