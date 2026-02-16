import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { Types } from "mongoose";
import { InspectionLogService } from "../../../services/inspectionLog.service";
import { JoiValidator } from "../../../validators/JoiValidator";
import { submitInspectionSchema } from "../../../validators/inspectionRequest.validator";
import { INSPECTION_FEE_DEFAULT } from "../../../services/propertyValidation.service";
import { notifyAgentOfInspectionRequest } from "../../../services/inspectionWorkflow.service";

const INSPECTION_FEE_MIN = 1000;
const INSPECTION_FEE_MAX = 50000;

export const submitInspectionRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { publicSlug } = req.params;

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

    const { requestedBy, inspectionAmount: clientAmount, inspectionDetails, properties } = validation.data!;

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

    if (dealSite.status !== "running") {
      res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This DealSite is not currently active.",
        data: null,
      });
      return;
    }

    const propertyIds = properties.map((p: { propertyId: string }) => p.propertyId);
    const propertiesList = await DB.Models.Property.find({ _id: { $in: propertyIds } }).lean();
    if (propertiesList.length !== propertyIds.length) {
      const foundIds = new Set(propertiesList.map((p: any) => p._id.toString()));
      const missing = propertyIds.filter((id: string) => !foundIds.has(id));
      res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "PROPERTY_NOT_FOUND",
        message: `Property(ies) not found: ${missing.join(", ")}`,
        data: null,
      });
      return;
    }

    let totalInspectionAmount = 0;
    for (const property of propertiesList as any[]) {
      const fee = property.inspectionFee ?? INSPECTION_FEE_DEFAULT;
      totalInspectionAmount += Math.min(INSPECTION_FEE_MAX, Math.max(INSPECTION_FEE_MIN, fee));
    }

    if (clientAmount != null && Number(clientAmount) !== totalInspectionAmount) {
      res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        errorCode: "INSPECTION_AMOUNT_MISMATCH",
        message: `Inspection amount must equal the sum of selected properties' inspection fees (₦${totalInspectionAmount}).`,
        data: { expectedAmount: totalInspectionAmount },
      });
      return;
    }
    const inspectionAmount = totalInspectionAmount;

    const buyer = await DB.Models.Buyer.findOneAndUpdate(
      { email: requestedBy.email },
      { $setOnInsert: requestedBy },
      { upsert: true, new: true },
    );

    const savedInspections = [];
    const propertyMap = new Map((propertiesList as any[]).map((p: any) => [p._id.toString(), p]));
    const publicPageUrl = `https://${dealSite.publicSlug}.khabiteq.com`;
    const respondUrl = `${process.env.CLIENT_LINK}/account/inspections`;

    for (const prop of properties) {
      const property = propertyMap.get(prop.propertyId);

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

      const isNegotiating =
        typeof prop.negotiationPrice === "number" && prop.negotiationPrice > 0;
      const isLOI = !!prop.letterOfIntention;
      const inspectionMode = inspectionDetails.inspectionMode || "in_person";
      const inspectionType = prop.inspectionType;
      const stage = isNegotiating || isLOI ? "negotiation" : "inspection";

      const fee = (property as any).inspectionFee ?? INSPECTION_FEE_DEFAULT;
      const propertyAmount = Math.min(INSPECTION_FEE_MAX, Math.max(INSPECTION_FEE_MIN, fee));

      const inspection = await DB.Models.InspectionBooking.create({
        propertyId: prop.propertyId,
        bookedBy: buyer._id,
        bookedByModel: "Buyer",
        inspectionDate: new Date(inspectionDetails.inspectionDate),
        inspectionTime: inspectionDetails.inspectionTime,
        status: "pending_approval",
        requestedBy: buyer._id,
        transaction: undefined,
        isNegotiating,
        isLOI,
        inspectionType,
        inspectionMode,
        inspectionStatus: "new",
        negotiationPrice: prop.negotiationPrice || 0,
        letterOfIntention: prop.letterOfIntention || null,
        owner: property.owner,
        pendingResponseFrom: "seller",
        stage,
        receiverMode: {
          type: "dealSite",
          dealSiteID: dealSite._id,
        },
      });

      savedInspections.push(inspection);

      await InspectionLogService.logActivity({
        inspectionId: inspection._id.toString(),
        propertyId: prop.propertyId,
        senderId: buyer._id.toString(),
        senderModel: "Buyer",
        senderRole: "buyer",
        message: `Inspection request submitted${isNegotiating ? " with negotiation price" : ""}${isLOI ? " with LOI" : ""}.`,
        status: "pending_approval",
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

      try {
        await notifyAgentOfInspectionRequest({
          inspectionId: inspection._id.toString(),
          propertyId: property._id,
          ownerId: (property as any).owner?.toString?.() ?? (property as any).owner,
          buyerName: (buyer as any).fullName || requestedBy.fullName || buyer.email,
          buyerEmail: buyer.email,
          inspectionDate: inspection.inspectionDate,
          inspectionTime: inspection.inspectionTime,
          amount: propertyAmount,
          respondUrl: `${respondUrl}/${inspection._id}`,
        });
      } catch (e) {
        console.warn("[DealSite inspection] Notify agent failed:", e);
      }
    }

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection request submitted. The agent will respond and you will receive a payment link if accepted.",
      data: {
        inspections: savedInspections,
      },
    });
  } catch (error) {
    console.error("submitInspectionRequest error:", error);
    next(error);
  }
};
