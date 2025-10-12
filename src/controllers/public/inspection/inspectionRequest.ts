import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import { InspectionLogService } from "../../../services/inspectionLog.service";
import { PaystackService } from "../../../services/paystack.service";
import { JoiValidator } from "../../../validators/JoiValidator";
import { submitInspectionSchema } from "../../../validators/inspectionRequest.validator";
import { Types } from "mongoose";


export const submitInspectionRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
    try {
      // Validate request body using pure validation
      const validation = JoiValidator.validate(submitInspectionSchema, req.body);

      if (!validation.success) {
        const errorMessage = validation.errors.map(e => `${e.field}: ${e.message}`).join(", ");
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
      }

      const { requestedBy, inspectionAmount, inspectionDetails, properties } = validation.data!;

      // Create or retrieve the buyer by email
      const buyer = await DB.Models.Buyer.findOneAndUpdate(
        { email: requestedBy.email },
        { $setOnInsert: requestedBy },
        { upsert: true, new: true },
      ); 
 
      // Generate payment link
      const paymentResponse = await PaystackService.initializePayment({
        email: buyer.email,
        amount: inspectionAmount,
        fromWho: {
          kind: "Buyer",
          item: new Types.ObjectId(buyer._id as Types.ObjectId),
        },
        transactionType: "inspection",
      })
     
      const savedInspections = [];

      for (const prop of properties) {
        const property = await DB.Models.Property.findById(
          prop.propertyId,
        ).lean();
        if (!property) {
          throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            `Property with ID ${prop.propertyId} not found`,
          );
        }

        // Determine isNegotiating and isLOI based on presence of negotiationPrice and letterOfIntention
        const isNegotiating =
          typeof prop.negotiationPrice === "number" &&
          prop.negotiationPrice > 0;
        const isLOI = !!prop.letterOfIntention;

        // Determine inspectionMode based on inspectionDetails or property-specific override
        const inspectionMode = inspectionDetails.inspectionMode || "in_person";
        const inspectionType = prop.inspectionType; // Now comes from individual property

        const stage = isNegotiating || isLOI ? "negotiation" : "inspection";
 
        const inspection = await DB.Models.InspectionBooking.create({
          propertyId: prop.propertyId,
          bookedBy: buyer._id,
          bookedByModel: "Buyer",
          inspectionDate: new Date(prop.inspectionDate),
          inspectionTime: prop.inspectionTime,
          status: "pending_transaction",
          requestedBy: buyer._id,
          transaction: paymentResponse.transactionId,
          isNegotiating,
          isLOI,
          inspectionType, // Use the inspectionType from the property object
          inspectionMode,
          inspectionStatus: "new",
          negotiationPrice: prop.negotiationPrice || 0,
          letterOfIntention: prop.letterOfIntention || null,
          owner: property.owner,
          pendingResponseFrom: "admin",
          stage,

          meta: {
            requestSource: prop.requestSource || null,
          },
        });

        savedInspections.push(inspection);

        // Log activity
        await InspectionLogService.logActivity({
          inspectionId: inspection._id.toString(),
          propertyId: prop.propertyId,
          senderId: buyer._id.toString(),
          senderModel: "Buyer",
          senderRole: "buyer",
          message: `Inspection request submitted${isNegotiating ? " with negotiation price" : ""}${isLOI ? " with LOI" : ""}.`,
          status: "pending_transaction",
          stage: stage,
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
          transaction: paymentResponse
        },
      });
      
    } catch (error) {
      console.error("submitInspectionRequest error:", error);
      next(error);
    }
}