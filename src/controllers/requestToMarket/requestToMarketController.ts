import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { REQUEST_TO_MARKET_FEE_NAIRA } from "../../config/requestToMarket.config";
import notificationService from "../../services/notification.service";
import {
  notifyPublisherOfRequestToMarket,
  notifyAgentRequestToMarketRejected,
  notifyAgentRequestToMarketAccepted,
  notifyPublisherToPayMarketingFee,
} from "../../services/requestToMarketEmail.service";
import { getPropertyTitleFromLocation } from "../../utils/helper";
import { PaystackService } from "../../services/paystack.service";
import { Types } from "mongoose";

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

    const request = await DB.Models.RequestToMarket.create({
      propertyId,
      requestedByAgentId: userId,
      publisherId,
      publisherType,
      status: "pending",
      marketingFeeNaira: REQUEST_TO_MARKET_FEE_NAIRA,
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
    const respondUrl = (process.env.CLIENT_LINK || "") + "/account/request-to-market";

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
        marketingFeeNaira: REQUEST_TO_MARKET_FEE_NAIRA,
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
        marketingFeeNaira: REQUEST_TO_MARKET_FEE_NAIRA,
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

    const [requests, total] = await Promise.all([
      DB.Models.RequestToMarket.find(filter)
        .populate("propertyId", "location price briefType propertyType pictures status listingScope additionalFeatures description")
        .populate("requestedByAgentId", "firstName lastName fullName email")
        .populate("publisherId", "firstName lastName fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.RequestToMarket.countDocuments(filter),
    ]);

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

    // Accept: set property.marketedByAgentId so it appears on Agent's DealSite
    const propertyId = (request as any).propertyId._id;
    const agentId = (request as any).requestedByAgentId._id;
    await DB.Models.Property.updateOne(
      { _id: propertyId },
      { $set: { marketedByAgentId: agentId } }
    );

    const marketingFeeNaira = (request as any).marketingFeeNaira;
    const publisher = await DB.Models.User.findById(userId).select("email firstName lastName fullName").lean();
    const agent = (request as any).requestedByAgentId;
    const agentName =
      agent?.fullName || [agent?.firstName, agent?.lastName].filter(Boolean).join(" ") || "there";
    const propertySummary =
      getPropertyTitleFromLocation((request as any).propertyId?.location) || "the property";

    let paymentUrl: string | undefined;
    let paymentTransactionId: Types.ObjectId | undefined;

    const dealSite = await DB.Models.DealSite.findOne({ createdBy: agentId })
      .select("paymentDetails")
      .lean();
    const subAccountCode = (dealSite as any)?.paymentDetails?.subAccountCode;

    if (subAccountCode && publisher?.email) {
      try {
        const result = await PaystackService.initializeSplitPayment({
          subAccount: subAccountCode,
          publicPageUrl: process.env.CLIENT_LINK || "https://khabiteq.com",
          amountCharge: 0,
          email: (publisher as any).email,
          amount: marketingFeeNaira,
          fromWho: { kind: "User", item: userId as Types.ObjectId },
          transactionType: "request-to-market",
          metadata: { requestToMarketId: requestId },
        });
        paymentUrl = result.authorization_url;
        paymentTransactionId = result.transactionId as Types.ObjectId;
      } catch (payErr) {
        console.warn("[requestToMarket] Paystack initializeSplitPayment failed:", payErr);
      }
    }

    await DB.Models.RequestToMarket.updateOne(
      { _id: requestId },
      {
        $set: {
          status: "accepted",
          acceptedAt: new Date(),
          ...(paymentTransactionId && { paymentTransactionId }),
        },
      }
    );

    await notificationService.createNotification({
      user: String(agentId),
      title: "Request To Market Accepted",
      message: "Your request to market the property was accepted. The property is now visible on your public page.",
      meta: { requestToMarketId: requestId, propertyId },
    });

    try {
      await notifyAgentRequestToMarketAccepted({
        agentEmail: agent?.email,
        agentName,
        propertySummary,
      });
    } catch (e) {
      console.warn("[requestToMarket] notifyAgentRequestToMarketAccepted email failed:", e);
    }

    if (paymentUrl && publisher?.email) {
      try {
        await notifyPublisherToPayMarketingFee({
          publisherEmail: (publisher as any).email,
          publisherName:
            (publisher as any).fullName ||
            [((publisher as any).firstName || "").trim(), ((publisher as any).lastName || "").trim()]
              .filter(Boolean)
              .join(" ") || "there",
          agentName,
          propertySummary,
          paymentUrl,
          marketingFeeNaira,
        });
      } catch (e) {
        console.warn("[requestToMarket] notifyPublisherToPayMarketingFee email failed:", e);
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: paymentUrl
        ? "Request accepted. The property is now visible on the agent's public page. A payment link has been sent to your email to pay the marketing fee to the agent."
        : "Request accepted. The property is now visible on the agent's public page. Please arrange payment of the marketing fee directly with the agent (payment link could not be generated).",
      data: {
        status: "accepted",
        propertyId,
        marketingFeeNaira,
        paymentUrl: paymentUrl || undefined,
      },
    });
  } catch (err) {
    next(err);
  }
};
