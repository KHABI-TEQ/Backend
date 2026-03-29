import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import notificationService from "../../services/notification.service";
import {
  notifyPublisherOfRequestToMarket,
  notifyAgentRequestToMarketRejected,
  notifyAgentRequestToMarketAccepted,
  notifyPublisherRequestAccepted,
  notifyAgentSaleRegistered,
} from "../../services/requestToMarketEmail.service";
import { getPropertyTitleFromLocation } from "../../utils/helper";
import { getClientDashboardUrl } from "../../utils/clientAppUrl";
import { resolveLeanRefToObjectId } from "../../utils/mongooseId";

/**
 * POST /account/request-to-market
 * Agent requests to market a LASRERA Market Place property. Agent ID is required (authenticated Agent).
 */
export const createRequestToMarket = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const user = await DB.Models.User.findById(userId).lean();
    if (!user || (user as any).userType !== "Agent") {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "Only Agents can request to market a property.");
    }

    const { propertyId } = req.body as { propertyId: string };
    if (!propertyId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "propertyId is required.");
    }

    const property = await DB.Models.Property.findById(propertyId).lean();
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found.");
    }

    if ((property as any).listingScope !== "lasrera_marketplace") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Only KHABITEQ Market Place properties can be requested for marketing."
      );
    }

    const publisherId = (property as any).owner;
    const publisher = await DB.Models.User.findById(publisherId).lean();
    if (!publisher) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property publisher not found.");
    }

    const publisherType = (publisher as any).userType;
    if (publisherType !== "Landowners" && publisherType !== "Developer") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Property must be owned by a Landlord or Developer."
      );
    }

    const existing = await DB.Models.RequestToMarket.findOne({
      propertyId,
      requestedByAgentId: userId,
      status: "pending",
    });
    if (existing) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "You already have a pending request for this property.");
    }

    const agentCommissionAmount = Math.max(0, Number((property as any).agentCommissionAmount) || 0);

    const request = await DB.Models.RequestToMarket.create({
      propertyId,
      requestedByAgentId: userId,
      publisherId,
      publisherType,
      status: "pending",
      agentCommissionAmount,
    });

    await notificationService.createNotification({
      user: String(publisherId),
      title: "Request To Market",
      message: `An Agent has requested to market your KHABITEQ Market Place property. Accept or reject from your dashboard.`,
      meta: { requestToMarketId: String(request._id), propertyId },
    });

    const agentName =
      (user as any).fullName ||
      [((user as any).firstName || "").trim(), ((user as any).lastName || "").trim()].filter(Boolean).join(" ") ||
      "An agent";
    const propertySummary = getPropertyTitleFromLocation((property as any).location) || "your property";
    const respondUrl = getClientDashboardUrl();

    let agentPublicPageUrl: string | undefined;
    const dealSite = await DB.Models.DealSite.findOne({ createdBy: userId })
      .select("publicSlug")
      .lean();
    const publicSlug = (dealSite as { publicSlug?: string } | null)?.publicSlug;
    if (publicSlug) {
      agentPublicPageUrl = "https://" + publicSlug + ".khabiteq.com";
    }

    try {
      await notifyPublisherOfRequestToMarket({
        publisherEmail: (publisher as any).email,
        publisherName:
          (publisher as any).fullName ||
          [((publisher as any).firstName || "").trim(), ((publisher as any).lastName || "").trim()].filter(Boolean).join(" "),
        agentName,
        agentEmail: (user as any).email,
        agentPhone: (user as any).phoneNumber,
        agentPublicPageUrl,
        propertySummary,
        respondUrl,
        agentCommissionAmount,
      });
    } catch (e) {
      console.warn("[requestToMarket] notifyPublisherOfRequestToMarket email failed:", e);
    }

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Request to market submitted. The publisher will be notified to accept or reject.",
      data: {
        requestId: request._id,
        propertyId,
        status: "pending",
        agentCommissionAmount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /account/request-to-market (Agent: my requests; Publisher: requests for my properties)
 */
export const listRequestToMarket = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const { role, status, page = "1", limit = "20" } = req.query as {
      role?: "agent" | "publisher";
      status?: string;
      page?: string;
      limit?: string;
    };

    const filter: any = {};
    const user = await DB.Models.User.findById(userId).lean();
    const userType = (user as any)?.userType;

    if (role === "agent" || (role !== "publisher" && userType === "Agent")) {
      filter.requestedByAgentId = userId;
    } else if (role === "publisher" || userType === "Landowners" || userType === "Developer") {
      filter.publisherId = userId;
    } else {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Provide role=agent or role=publisher, or use an Agent/Landlord/Developer account.");
    }

    if (status && ["pending", "accepted", "rejected"].includes(status)) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [rawRequests, total] = await Promise.all([
      DB.Models.RequestToMarket.find(filter)
        .populate("propertyId", "location price briefType propertyType pictures status listingScope additionalFeatures description agentCommissionAmount")
        .populate("requestedByAgentId", "firstName lastName fullName email phoneNumber")
        .populate("publisherId", "firstName lastName fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.RequestToMarket.countDocuments(filter),
    ]);

    const requests = (rawRequests as any[]).map((r) => ({
      ...r,
      agentCommissionAmount: r.agentCommissionAmount ?? r.marketingFeeNaira ?? 0,
      ...(r.marketingFeeNaira !== undefined && { marketingFeeNaira: undefined }),
    }));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /account/request-to-market/:requestId/respond
 * Publisher (Landlord/Developer) accepts or rejects the request.
 * Body: { action: "accept" | "reject", rejectedReason?: string }
 */
export const respondToRequestToMarket = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const { requestId } = req.params;
    const { action, rejectedReason } = req.body as { action: "accept" | "reject"; rejectedReason?: string };

    if (!["accept", "reject"].includes(action)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "action must be 'accept' or 'reject'.");
    }

    const request = await DB.Models.RequestToMarket.findById(requestId)
      .populate("propertyId")
      .populate("requestedByAgentId")
      .lean();

    if (!request) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Request not found.");
    }

    if (String((request as any).publisherId) !== String(userId)) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "Only the property publisher can respond to this request.");
    }

    if ((request as any).status !== "pending") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "This request has already been responded to.");
    }

    if (action === "reject") {
      await DB.Models.RequestToMarket.updateOne(
        { _id: requestId },
        {
          $set: {
            status: "rejected",
            rejectedReason: rejectedReason || undefined,
            rejectedAt: new Date(),
          },
        }
      );

      await notificationService.createNotification({
        user: String((request as any).requestedByAgentId._id),
        title: "Request To Market Rejected",
        message: `Your request to market a property was rejected by the publisher.${rejectedReason ? ` Reason: ${rejectedReason}` : ""}`,
        meta: { requestToMarketId: requestId },
      });

      const agent = (request as any).requestedByAgentId;
      const agentName =
        agent?.fullName ||
        [agent?.firstName, agent?.lastName].filter(Boolean).join(" ") ||
        "there";
      const propertySummary =
        getPropertyTitleFromLocation((request as any).propertyId?.location) || "the property";
      try {
        await notifyAgentRequestToMarketRejected({
          agentEmail: agent?.email,
          agentName,
          propertySummary,
          rejectedReason,
        });
      } catch (e) {
        console.warn("[requestToMarket] notifyAgentRequestToMarketRejected email failed:", e);
      }

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Request rejected. The agent has been notified.",
        data: { status: "rejected" },
      });
    }

    // Accept: add this Agent to property's marketedByAgentIds so it appears on their DealSite (multiple agents can market the same property)
    const propertyOid = resolveLeanRefToObjectId((request as any).propertyId);
    const agentOid = resolveLeanRefToObjectId((request as any).requestedByAgentId);
    if (!propertyOid || !agentOid) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Could not resolve property or agent id for this request (invalid or missing references)."
      );
    }
    await DB.Models.Property.updateOne(
      { _id: propertyOid },
      { $addToSet: { marketedByAgentIds: agentOid } }
    );

    const publisher = await DB.Models.User.findById(userId).select("email firstName lastName fullName phoneNumber").lean();
    const agent = (request as any).requestedByAgentId;
    const agentName =
      agent?.fullName || [agent?.firstName, agent?.lastName].filter(Boolean).join(" ") || "there";
    const propertySummary =
      getPropertyTitleFromLocation((request as any).propertyId?.location) || "the property";

    // No payment link at accept; Publisher registers actual sale later via register-sale endpoint
    await DB.Models.RequestToMarket.updateOne(
      { _id: requestId },
      {
        $set: {
          status: "accepted",
          acceptedAt: new Date(),
        },
      }
    );

    await notificationService.createNotification({
      user: String(agentOid),
      title: "Request To Market Accepted",
      message: "Your request to market the property was accepted. The property is now visible on your public page.",
      meta: { requestToMarketId: requestId, propertyId: String(propertyOid) },
    });

    const publisherName =
      (publisher as any)?.fullName ||
      [((publisher as any)?.firstName || "").trim(), ((publisher as any)?.lastName || "").trim()]
        .filter(Boolean)
        .join(" ") ||
      "";
    try {
      await notifyAgentRequestToMarketAccepted({
        agentEmail: agent?.email,
        agentName,
        propertySummary,
        publisherName: publisherName || undefined,
        publisherEmail: (publisher as any)?.email,
        publisherPhone: (publisher as any)?.phoneNumber,
      });
    } catch (e) {
      console.warn("[requestToMarket] notifyAgentRequestToMarketAccepted email failed:", e);
    }

    // Email Publisher: request accepted; commission will be based on actual sale price, register on dashboard after transaction.
    if ((publisher as any)?.email) {
      try {
        await notifyPublisherRequestAccepted({
          publisherEmail: (publisher as any).email,
          publisherName:
            (publisher as any).fullName ||
            [((publisher as any).firstName || "").trim(), ((publisher as any).lastName || "").trim()]
              .filter(Boolean)
              .join(" ") || "there",
          agentName,
          propertySummary,
        });
      } catch (e) {
        console.warn("[requestToMarket] notifyPublisherRequestAccepted email failed:", e);
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        "Request accepted. The property is now visible on the agent's public page. After the transaction is complete, register the actual sale price on your dashboard to calculate and pay the agent commission.",
      data: {
        status: "accepted",
        propertyId: propertyOid,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /account/request-to-market/:requestId/register-sale
 * Publisher registers the actual sale price and commission %. Payment to the Agent happens outside the app;
 * optional receipt URL can be uploaded (via existing upload endpoint) and sent here for admin verification.
 * Body: { actualSalePriceNaira: number, commissionPercent?: number, commissionReceiptUrl?: string }
 * - Landlord: commissionPercent is automatically 5.
 * - Developer: commissionPercent 1–5 (required in body).
 * - commissionReceiptUrl: optional; use URL from upload-single-file (or similar) to confirm payment to Agent.
 */
export const registerSaleForRequestToMarket = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const { requestId } = req.params;
    const {
      actualSalePriceNaira,
      commissionPercent: bodyCommissionPercent,
      commissionReceiptUrl,
    } = req.body as {
      actualSalePriceNaira?: number;
      commissionPercent?: number;
      commissionReceiptUrl?: string;
    };

    const actualPrice = Number(actualSalePriceNaira);
    if (!Number.isFinite(actualPrice) || actualPrice <= 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "actualSalePriceNaira is required and must be a positive number.");
    }

    const request = await DB.Models.RequestToMarket.findById(requestId)
      .populate("propertyId", "location")
      .populate("requestedByAgentId", "firstName lastName fullName email phoneNumber")
      .lean();

    if (!request) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Request not found.");
    }

    if (String((request as any).publisherId) !== String(userId)) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "Only the property publisher can register the sale for this request.");
    }

    if ((request as any).status !== "accepted") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Only accepted requests can have a sale registered.");
    }

    if ((request as any).saleRegisteredAt != null) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Sale has already been registered for this request.");
    }

    const publisherType = (request as any).publisherType as "Landowners" | "Developer";
    let commissionPercent: number;
    if (publisherType === "Landowners") {
      commissionPercent = 5;
    } else {
      const percent = Number(bodyCommissionPercent);
      if (!Number.isFinite(percent) || percent < 1 || percent > 5) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "commissionPercent is required for Developer and must be between 1 and 5.");
      }
      commissionPercent = percent;
    }

    const agentCommissionAmount = Math.round((actualPrice * commissionPercent) / 100);
    if (agentCommissionAmount <= 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Computed agent commission is zero; ensure actualSalePriceNaira and commissionPercent are valid.");
    }

    const updatePayload: Record<string, unknown> = {
      actualSalePriceNaira: actualPrice,
      commissionPercent,
      saleRegisteredAt: new Date(),
    };
    if (commissionReceiptUrl && typeof commissionReceiptUrl === "string" && commissionReceiptUrl.trim()) {
      updatePayload.commissionReceiptUrl = commissionReceiptUrl.trim();
    }

    await DB.Models.RequestToMarket.updateOne(
      { _id: requestId },
      { $set: updatePayload }
    );

    const agent = (request as any).requestedByAgentId;
    const agentName =
      agent?.fullName ||
      [agent?.firstName, agent?.lastName].filter(Boolean).join(" ") ||
      "Agent";
    const propertySummary = getPropertyTitleFromLocation((request as any).propertyId?.location) || "the property";
    if (agent?.email) {
      try {
        await notifyAgentSaleRegistered({
          agentEmail: agent.email,
          agentName,
          propertySummary,
          actualSalePriceNaira: actualPrice,
          commissionPercent,
          agentCommissionAmount,
        });
      } catch (e) {
        console.warn("[requestToMarket] notifyAgentSaleRegistered email failed:", e);
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Sale registered. Pay the agent commission outside the app; receipt URL saved for admin verification when provided.",
      data: {
        agentCommissionAmount,
        commissionPercent,
        actualSalePriceNaira: actualPrice,
        commissionReceiptUrl: updatePayload.commissionReceiptUrl ?? null,
        agent: {
          name: agentName,
          email: agent?.email,
          phoneNumber: agent?.phoneNumber,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
