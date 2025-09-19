import { Response, NextFunction } from "express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import { InspectionLogService } from "../../../services/inspectionLog.service";
import notificationService from "../../../services/notification.service";
import { hasDateTimeChanged } from "../../../utils/detectDateTimeChange";
import {
  InspectionActionData,
  InspectionLinks,
} from "../../../types/inspection.types";
import { InspectionValidator } from "../../../validators/inspection.validator";
import { InspectionActionHandler } from "../../../handlers/inspection-action.handler";
import { InspectionEmailService } from "../../../services/inspection-email.service";
import { AppRequest } from "../../../types/express";
import { PaystackService } from "../../../services/paystack.service";
import { Types } from "mongoose";

class InspectionActionsController {

  public async processInspectionAction(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ) {
    try { 
      const { inspectionId, userId } = req.params;

      if (!userId) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "User ID is required in URL",
        );
      }

      // Validate request body using pure validation
      const validation = InspectionValidator.validateInspectionActionData(
        req.body,
      );
      
      if (!validation.success) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, validation.error!);
      }

      const actionData = validation.data!;
      const result = await this.processAction(inspectionId, userId, actionData);

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: `Inspection ${actionData.action} processed successfully`,
        data: result,
      });
    } catch (error) {
      console.error("Error processing inspection action:", error);
      next(error);
    }
  }

  private async processAction(
    inspectionId: string,
    userId: string,
    actionData: InspectionActionData,
  ) {
    // Find and populate inspection
    const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
      .populate(
        "propertyId",
        "title location price propertyType briefType pictures",
      )
      .populate("owner", "fullName email firstName lastName")
      .populate("requestedBy", "fullName email firstName lastName");

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    const ownerId = (inspection.owner as any)?._id.toString();
    const buyerId = (inspection.requestedBy as any)?._id.toString();

    // Determine user type from userId
    const isSeller = userId === ownerId;
    const isBuyer = userId === buyerId;
    const userType = isSeller ? "seller" : "buyer";

    // Authorization check
    if (!isSeller && !isBuyer) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Unauthorized access to this inspection",
      );
    }

    // Check if inspection is already in "inspection" stage and prevent cancellation
    if (inspection.stage === "inspection" && actionData.action === "reject") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Cannot cancel inspection that has already reached inspection stage",
      );
    }

    if (
      inspection.stage === "negotiation" &&
      actionData.action === "counter" &&
      (typeof actionData.counterPrice !== "number" || isNaN(actionData.counterPrice))
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Counter price is required and must be a valid number for price negotiations"
      );
    }


    // Validate action-specific requirements
    InspectionValidator.validateActionRequirements(actionData);

    // Check if date/time changed
    const dateTimeChanged = hasDateTimeChanged(
      inspection.inspectionDate,
      inspection.inspectionTime,
      actionData.inspectionDate,
      actionData.inspectionTime,
    );

    const senderName = isSeller
      ? (inspection.owner as any).fullName
      : (inspection.requestedBy as any).fullName;

    const buyerData = inspection.requestedBy as any;
    const sellerData = inspection.owner as any;

    // Process actions using handler
    const actionHandler = new InspectionActionHandler();
 
    const { update, logMessage, emailSubject, emailData } =
      actionHandler.handleAction(
        actionData,
        inspection,
        senderName,
        isSeller,
        dateTimeChanged,
        inspectionId,
        buyerId,
        ownerId,
      );

    // Update inspection date/time if provided
    if (actionData.inspectionDate) {
      update.inspectionDate = actionData.inspectionDate;
    }

    if (actionData.inspectionTime) {
      update.inspectionTime = actionData.inspectionTime;
    }

    // Update the inspection in database
    const updatedInspection =
      await DB.Models.InspectionBooking.findByIdAndUpdate(
        inspectionId,
        { $set: update },
        { new: true },
      );

    if (!updatedInspection) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to update inspection",
      );
    }

    // Log activity
    await InspectionLogService.logActivity({
      inspectionId,
      propertyId: (inspection.propertyId as any)._id,
      senderId: userId,
      senderRole: userType,
      senderModel: userType == "buyer" ? "Buyer" : "User",
      message: logMessage,
      status: update.status,
      stage: update.stage || "inspection",
      meta: {
        action: actionData.action,
        inspectionType: actionData.inspectionType,
        counterPrice: actionData.counterPrice,
        dateTimeChanged,
      },
    });

    // Create notifications for both buyer and seller
    const recipientId = isSeller ? buyerId : ownerId;
    await notificationService.createNotification({
      user: recipientId,
      title: emailSubject,
      message: logMessage,
      meta: {
        inspectionId,
        propertyTitle: (inspection.propertyId as any).title,
        action: actionData.action,
        inspectionType: actionData.inspectionType,
      },
    });

    // Send emails using email service
    const emailService = new InspectionEmailService();

    const emailResults = await emailService.sendActionEmails({
      actionData,
      buyerData,
      sellerData,
      emailData,
      isBuyer,
      isSeller,
    });

    return {
      inspection: updatedInspection,
      emailsSent: emailResults,
      logCreated: true,
      notificationSent: true,
    };
  }

  public async getInspectionDetails(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { userID, inspectionID, userType } = req.params;

      const inspection = await DB.Models.InspectionBooking.findById(
        inspectionID,
      )
        .populate(
          "propertyId",
          "title location price propertyType briefType pictures _id owner",
        )
        .populate("owner", "firstName lastName _id userType")
        .populate("requestedBy", "fullName _id");

      if (!inspection) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
      }

      // Authorization check based on user type
      if (
        userType === "seller" &&
        (inspection.propertyId as any).owner.toString() !== userID
      ) {
        throw new RouteError(
          HttpStatusCodes.FORBIDDEN,
          "Seller not authorized for this inspection",
        );
      }

      if (
        userType === "buyer" &&
        (inspection.requestedBy as any)._id.toString() !== userID
      ) {
        throw new RouteError(
          HttpStatusCodes.FORBIDDEN,
          "Buyer not authorized for this inspection",
        );
      }

      // Add thumbnail from property pictures
      const property = inspection.propertyId as any;
      const thumbnail = property?.pictures?.length
        ? property.pictures[0]
        : null;

      const responseData = {
        ...inspection.toObject(),
        propertyId: {
          ...property.toObject(),
          thumbnail,
        },
      };

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  }

  public async validateInspectionAccess(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { userId, inspectionId } = req.params;

      const inspection = await DB.Models.InspectionBooking.findById(
        inspectionId,
      )
        .select("requestedBy owner")
        .lean();

      if (!inspection) {
        return res.status(HttpStatusCodes.NOT_FOUND).json({
          status: "error",
          success: false,
          message: "Inspection not found",
        });
      }

      const isBuyer = inspection.requestedBy?.toString() === userId;
      const isSeller = inspection.owner?.toString() === userId;

      if (isBuyer || isSeller) {
        return res.status(HttpStatusCodes.OK).json({
          status: "success",
          success: true,
          role: isBuyer ? "buyer" : "seller",
          message: "Access granted",
        });
      } else {
        return res.status(HttpStatusCodes.FORBIDDEN).json({
          status: "error",
          success: false,
          message:
            "Access denied. You are not associated with this inspection.",
        });
      }
    } catch (error) {
      console.error("Validation error:", error);
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
        status: "error",
        success: false,
        message: "Server error during access validation",
      });
    }
  }

  public async getUserInspections(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { userId } = req.params;
      const { role } = req.query; // 'buyer' or 'seller'

      let query: any = {};
      if (role === "buyer") {
        query.requestedBy = userId;
      } else if (role === "seller") {
        query.owner = userId;
      } else {
        query = {
          $or: [{ requestedBy: userId }, { owner: userId }],
        };
      }

      const inspections = await DB.Models.InspectionBooking.find(query)
        .populate(
          "propertyId",
          "title location price propertyType briefType pictures",
        )
        .populate("owner", "fullName email firstName lastName")
        .populate("requestedBy", "fullName email firstName lastName")
        .sort({ createdAt: -1 });

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: inspections,
      });
    } catch (error) {
      console.error("Error fetching user inspections:", error);
      next(error);
    }
  }
 
  public async getInspectionHistory(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { inspectionId } = req.params;

      // Get inspection logs
      const logs = await InspectionLogService.getLogsByInspection(inspectionId);

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      console.error("Error fetching inspection history:", error);
      next(error);
    }
  }

  public async submitInspectionRequest(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Validate request body using pure validation
      const validation = InspectionValidator.validateSubmitInspectionPayload(
        req.body,
      );

      if (!validation.success) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, validation.error!);
      } 

      const {
        requestedBy,
        inspectionDetails,
        inspectionAmount,
        properties,
      } = validation.data!;

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
          inspectionDate: new Date(inspectionDetails.inspectionDate),
          inspectionTime: inspectionDetails.inspectionTime,
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

  public async reopenInspection(
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { inspectionId } = req.params;

      const inspection = await DB.Models.InspectionBooking.findById(inspectionId);
      if (!inspection) {
        throw new RouteError(
          HttpStatusCodes.NOT_FOUND,
          `Inspection with ID ${inspectionId} not found.`,
        );
      }

      // Simply touch the row to update the `updatedAt` timestamp
      inspection.markModified("updatedAt");
      await inspection.save();

      await InspectionLogService.logActivity({
        inspectionId: inspection._id.toString(),
        propertyId: inspection.propertyId.toString(),
        senderId: req.user?._id?.toString() || "system",
        senderModel: req.user?.model || "Admin",
        senderRole: req.user?.role || "admin",
        message: `Inspection reopened. No changes made to date or time.`,
        status: inspection.status,
        stage: inspection.stage,
        meta: {
          action: "reopen",
        },
      });

      res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Inspection reopened successfully.",
        data: inspection,
      });
    } catch (error) {
      console.error("reopenInspection error:", error);
      next(error);
    }
  }

}

export default new InspectionActionsController();
