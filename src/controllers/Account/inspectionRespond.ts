import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { PaystackService } from "../../services/paystack.service";
import { Types } from "mongoose";
import { notifyBuyerPaymentLink, notifyBuyerAcceptedNoPayment, notifyBuyerRejected } from "../../services/inspectionWorkflow.service";
import { InspectionLogService } from "../../services/inspectionLog.service";
import { getPropertyTitleFromLocation } from "../../utils/helper";
import { INSPECTION_FEE_DEFAULT } from "../../services/propertyValidation.service";

const INSPECTION_FEE_MIN = 1000;
const INSPECTION_FEE_MAX = 50000;

/**
 * Agent (property owner) accepts or rejects an inspection request.
 * Accept: optional inspectionFee (₦1,000–₦50,000) can be set; then create payment link, save transaction, email buyer.
 * Reject: set agent_rejected, email buyer.
 */
export const respondToInspectionRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;
    const { action, note, inspectionFee: bodyFee } = req.body as {
      action: "accept" | "reject";
      note?: string;
      inspectionFee?: number;
    };
    const userId = req.user?._id;

    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    if (!["accept", "reject"].includes(action)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "action must be 'accept' or 'reject'");
    }

    const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
      .populate("propertyId")
      .populate("requestedBy")
      .lean();

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }
    if ((inspection as any).owner.toString() !== userId.toString()) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "You can only respond to inspections for your properties");
    }
    if ((inspection as any).status !== "pending_approval") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `This inspection is not awaiting your response (status: ${(inspection as any).status})`,
      );
    }

    const property = inspection.propertyId as any;
    const buyer = inspection.requestedBy as any;
    const propertyLocation = getPropertyTitleFromLocation(property?.location) || "Property";

    // Base amount from property fee; when accepting, agent may override with inspectionFee (validated range)
    let amount = Math.min(
      INSPECTION_FEE_MAX,
      Math.max(INSPECTION_FEE_MIN, property?.inspectionFee ?? INSPECTION_FEE_DEFAULT),
    );
    if (action === "accept" && bodyFee !== undefined && bodyFee !== null) {
      const numFee = Number(bodyFee);
      if (!Number.isFinite(numFee)) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `inspectionFee must be a number between ₦${INSPECTION_FEE_MIN.toLocaleString()} and ₦${INSPECTION_FEE_MAX.toLocaleString()}`,
        );
      }
      if (numFee < INSPECTION_FEE_MIN || numFee > INSPECTION_FEE_MAX) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `inspectionFee must be between ₦${INSPECTION_FEE_MIN.toLocaleString()} and ₦${INSPECTION_FEE_MAX.toLocaleString()}`,
        );
      }
      amount = Math.round(numFee);
    }

    const propertyIdStr = (property?._id ?? (inspection as any).propertyId)?.toString();

    if (action === "reject") {
      await DB.Models.InspectionBooking.updateOne(
        { _id: inspectionId },
        { $set: { status: "agent_rejected" } },
      );
      if (propertyIdStr) {
        await InspectionLogService.logActivity({
          inspectionId: inspectionId as string,
          propertyId: propertyIdStr,
          senderId: userId.toString(),
          senderRole: "seller",
          senderModel: "User",
          message: note ? `Agent rejected the inspection request. Note: ${note}` : "Agent rejected the inspection request.",
          status: "agent_rejected",
          stage: "inspection",
        });
      }
      await notifyBuyerRejected({
        buyerEmail: buyer?.email,
        buyerName: buyer?.fullName || buyer?.email,
        propertyLocation,
        note,
      });
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Inspection request rejected. The buyer has been notified.",
        data: { status: "agent_rejected" },
      });
    }

    const receiverMode = (inspection as any).receiverMode;
    const isDealSite = receiverMode?.type === "dealSite" && receiverMode?.dealSiteID;

    // DealSite: no inspection fee, no payment link. Buyer is only notified that request was accepted.
    if (isDealSite) {
      await DB.Models.InspectionBooking.updateOne(
        { _id: inspectionId },
        { $set: { status: "inspection_approved" } },
      );

      if (propertyIdStr) {
        await InspectionLogService.logActivity({
          inspectionId: inspectionId as string,
          propertyId: propertyIdStr,
          senderId: userId.toString(),
          senderRole: "seller",
          senderModel: "User",
          message: "Agent accepted the inspection request. Buyer has been notified.",
          status: "inspection_approved",
          stage: "inspection",
        });
      }

      const dealSite = await DB.Models.DealSite.findById(receiverMode.dealSiteID)
        .select("publicSlug")
        .lean();
      const publicSlug = (dealSite as any)?.publicSlug;
      const viewPropertyUrl =
        publicSlug && propertyIdStr
          ? `https://${publicSlug}.khabiteq.com/properties/${propertyIdStr}`
          : undefined;

      const inspectionDateStr = (inspection as any).inspectionDate
        ? new Date((inspection as any).inspectionDate).toLocaleDateString("en-NG", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : undefined;
      const inspectionTimeStr = (inspection as any).inspectionTime ?? undefined;

      await notifyBuyerAcceptedNoPayment({
        buyerEmail: buyer?.email,
        buyerName: buyer?.fullName || buyer?.email,
        propertyLocation,
        propertyDetails: {
          title: propertyLocation,
          address: property?.location ? getPropertyTitleFromLocation(property.location) : undefined,
          price: property?.price,
          briefType: property?.briefType,
          propertyType: property?.propertyType,
          bedrooms: property?.additionalFeatures?.noOfBedroom,
          bathrooms: property?.additionalFeatures?.noOfBathroom,
          toilets: property?.additionalFeatures?.noOfToilet,
          carPark: property?.additionalFeatures?.noOfCarPark,
          viewPropertyUrl,
          imageUrl: Array.isArray(property?.pictures) && property.pictures.length > 0 ? property.pictures[0] : undefined,
        },
        inspectionDate: inspectionDateStr,
        inspectionTime: inspectionTimeStr,
      });

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Inspection accepted. The buyer has been notified.",
        data: { status: "inspection_approved" },
      });
    }

    let paymentResponse: { authorization_url: string; transactionId: Types.ObjectId };
    const result = await PaystackService.initializePayment({
      email: buyer?.email,
      amount,
      fromWho: { kind: "Buyer", item: buyer._id },
      transactionType: "inspection",
      metadata: { inspectionId },
    });
    paymentResponse = { authorization_url: result.authorization_url, transactionId: result.transactionId as Types.ObjectId };

    await DB.Models.InspectionBooking.updateOne(
      { _id: inspectionId },
      {
        $set: {
          status: "pending_transaction",
          transaction: paymentResponse.transactionId,
        },
      },
    );

    if (propertyIdStr) {
      const feeMessage =
        bodyFee !== undefined && bodyFee !== null
          ? ` Agent set inspection fee to ₦${amount.toLocaleString()}.`
          : "";
      await InspectionLogService.logActivity({
        inspectionId: inspectionId as string,
        propertyId: propertyIdStr,
        senderId: userId.toString(),
        senderRole: "seller",
        senderModel: "User",
        message: `Agent accepted the inspection request. Payment link sent to buyer.${feeMessage}`,
        status: "pending_transaction",
        stage: "inspection",
        meta: { amountCharged: amount },
      });
    }

    await notifyBuyerPaymentLink({
      buyerEmail: buyer?.email,
      buyerName: buyer?.fullName || buyer?.email,
      propertyLocation,
      amount,
      paymentUrl: paymentResponse.authorization_url,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection accepted. The buyer has been sent a payment link.",
      data: {
        status: "pending_transaction",
        paymentUrl: paymentResponse.authorization_url,
      },
    });
  } catch (err) {
    next(err);
  }
};
