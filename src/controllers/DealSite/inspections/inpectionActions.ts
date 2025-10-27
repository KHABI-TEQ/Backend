import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { PaystackService } from "../../../services/paystack.service";
import { Types } from "mongoose";
import { InspectionLogService } from "../../../services/inspectionLog.service";
import { JoiValidator } from "../../../validators/JoiValidator";
import { submitInspectionSchema } from "../../../validators/inspectionRequest.validator";

export const submitInspectionRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { publicSlug } = req.params;

    // Validate request body using pure validation
    const validation = JoiValidator.validate(submitInspectionSchema, req.body);

    if (!validation.success) {
      const errorMessage = validation.errors.map(e => `${e.field}: ${e.message}`).join(", ");
      res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        errorCode: "VALIDATION_FAILED",
        message: errorMessage,
        data: null,
      });
      return;
    }

    const { requestedBy, inspectionAmount, inspectionDetails, properties } = validation.data!;

    // ✅ Find DealSite
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug }).lean();
    if (!dealSite) {
      res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "DealSite not found",
        data: null,
      });
      return;
    }

    // ✅ Ensure it's running
    if (dealSite.status !== "running") {
      res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This DealSite is not currently active.",
        data: null,
      });
      return;
    }

    // ✅ Create or retrieve the buyer
    const buyer = await DB.Models.Buyer.findOneAndUpdate(
      { email: requestedBy.email },
      { $setOnInsert: requestedBy },
      { upsert: true, new: true },
    ); 

    const paymentDetails = dealSite.paymentDetails;
    const publicPageUrl = `https://${dealSite.publicSlug}.khabiteq.com`;

    // Calculate 15%
    const fifteenPercent = (inspectionAmount * 10) / 100;

    // ✅ Generate payment link
    const paymentResponse = await PaystackService.initializeSplitPayment({
      subAccount: paymentDetails.subAccountCode,
      publicPageUrl: publicPageUrl,
      amountCharge: fifteenPercent,
      email: buyer.email,
      amount: inspectionAmount,
      fromWho: {
        kind: "Buyer",
        item: new Types.ObjectId(buyer._id as Types.ObjectId),
      },
      transactionType: "inspection",
    });

    const savedInspections = [];

    for (const prop of properties) {
      const property = await DB.Models.Property.findById(prop.propertyId).lean();

      if (!property) {
        res.status(HttpStatusCodes.NOT_FOUND).json({
          success: false,
          errorCode: "PROPERTY_NOT_FOUND",
          message: `Property with ID ${prop.propertyId} not found`,
          data: null,
        });
        return;
      }

      if (!property.isAvailable) {
        res.status(HttpStatusCodes.BAD_REQUEST).json({
          success: false,
          errorCode: "PROPERTY_NOT_AVAILABLE",
          message: `Property with ID ${prop.propertyId} is not available for inspection`,
          data: null,
        });
        return;
      }

      // ✅ Determine negotiation / LOI
      const isNegotiating =
        typeof prop.negotiationPrice === "number" && prop.negotiationPrice > 0;
      const isLOI = !!prop.letterOfIntention;

      // ✅ Inspection mode/type
      const inspectionMode = inspectionDetails.inspectionMode || "in_person";
      const inspectionType = prop.inspectionType;
      const stage = isNegotiating || isLOI ? "negotiation" : "inspection";

      // ✅ Save inspection
      const inspection = await DB.Models.InspectionBooking.create({
        propertyId: prop.propertyId,
        bookedBy: buyer._id,
        bookedByModel: "Buyer",
        inspectionDate: new Date(inspectionDetails.inspectionDate),
        inspectionTime: inspectionDetails.inspectionTime,
        status: "pending_transaction",
        requestedBy: buyer._id,
        transaction: paymentResponse.transactionId,
        isNegotiating,
        isLOI,
        inspectionType,
        inspectionMode,
        inspectionStatus: "new",
        negotiationPrice: prop.negotiationPrice || 0,
        letterOfIntention: prop.letterOfIntention || null,
        owner: property.owner,
        pendingResponseFrom: "admin",
        stage,
        receiverMode: {
            type: "dealSite",
            dealSiteID: dealSite._id
        }
      });

      savedInspections.push(inspection);

      // ✅ Log activity
      await InspectionLogService.logActivity({
        inspectionId: inspection._id.toString(),
        propertyId: prop.propertyId,
        senderId: buyer._id.toString(),
        senderModel: "Buyer",
        senderRole: "buyer",
        message: `Inspection request submitted${
          isNegotiating ? " with negotiation price" : ""
        }${isLOI ? " with LOI" : ""}.`,
        status: "pending_transaction",
        stage,
        meta: {
          inspectionType,
          negotiationPrice: prop.negotiationPrice || 0,
          letterOfIntention: prop.letterOfIntention || null,
          inspectionDate: inspectionDetails.inspectionDate,
          inspectionTime: inspectionDetails.inspectionTime,
          inspectionMode,
        },
      });
    }

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection request submitted",
      data: {
        inspections: savedInspections,
        transaction: paymentResponse,
      },
    });
  } catch (error) {
    console.error("submitInspectionRequest error:", error);
    next(error);
  }
};
