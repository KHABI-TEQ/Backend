import { Request, Response, NextFunction } from "express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { z } from "zod";
import { DB } from "..";
import { RouteError } from "../../common/classes";
import { generateNegotiationEmailTemplate } from "../../utils/emailTemplates/generateNegotiationEmailTemplate";
import sendEmail from "../../common/send.email";
import { generalTemplate } from "../../common/email.template";
import { InspectionLogService } from "../../services/inspectionLog.service";
import notificationService from "../../services/notification.service";
import { hasDateTimeChanged } from "../../utils/detectDateTimeChange";

// Validation schema matching exact payload requirements
export const InspectionActionSchema = z.object({
  action: z.string().refine((val) => 
    ["accept", "reject", "counter", "request_changes"].includes(val), 
    { message: "Action must be one of: accept, reject, counter, request_changes" }
  ),
  inspectionType: z.string().refine((val) => 
    ["price", "LOI"].includes(val), 
    { message: "Inspection type must be either price or LOI" }
  ),
  userType: z.string().refine((val) => 
    ["buyer", "seller"].includes(val), 
    { message: "User type must be either buyer or seller" }
  ),
  counterPrice: z.number().optional(),
  inspectionDate: z.string().optional(),
  inspectionTime: z.string().optional(),
  reason: z.string().optional(),
  rejectionReason: z.string().optional(),
  documentUrl: z.url().optional(),
});

const SubmitInspectionSchema = z.object({
  inspectionType: z.string().refine((val) => 
    ["price", "LOI"].includes(val), 
    { message: "Inspection type must be either price or LOI" }
  ),
  inspectionDate: z.string(),
  inspectionTime: z.string(),
  requestedBy: z.object({
    fullName: z.string(),
    email: z.email(),
    phoneNumber: z.string(),
  }),
  transaction: z.object({
    fullName: z.string(),
    transactionReceipt: z.string().url(),
  }),
  properties: z.array(
    z.object({
      propertyId: z.string(),
      negotiationPrice: z.number().optional(),
      letterOfIntention: z.url().optional(),
    })
  ),
});

export type SubmitInspectionPayload = z.infer<typeof SubmitInspectionSchema>;

export type InspectionActionData = z.infer<typeof InspectionActionSchema>;

class InspectionActionsController {
  private generateInspectionLinks(
    inspectionId: string,
    buyerId: string,
    sellerId: string
  ): {
    sellerResponseLink: string;
    buyerResponseLink: string;
    negotiationResponseLink: string;
    checkLink: string;
    browseLink: string;
    rejectLink: string;
  } {
    const clientLink = process.env.CLIENT_LINK || "http://localhost:3000";
    const inspectionIdStr = inspectionId.toString();

    return {
      sellerResponseLink: `${clientLink}/secure-seller-response/${sellerId}/${inspectionIdStr}`,
      buyerResponseLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}`,
      negotiationResponseLink: `${clientLink}/secure-seller-response/${sellerId}/${inspectionIdStr}`,
      checkLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}/check`,
      browseLink: `${clientLink}/market-place`,
      rejectLink: `${clientLink}/secure-buyer-response/${buyerId}/${inspectionIdStr}/reject`,
    };
  }

  public async processInspectionAction(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { inspectionId, userId } = req.params;

      if (!userId) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "User ID is required in URL");
      }

      // Validate request body
      const validation = InspectionActionSchema.safeParse(req.body);
      if (!validation.success) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid request data");
      }

      const actionData = validation.data;
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
    actionData: InspectionActionData
  ) {
    // Find and populate inspection
    const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
      .populate(
        "propertyId",
        "title location price propertyType briefType pictures"
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
        "Unauthorized access to this inspection"
      );
    }

    // Validate action-specific requirements
    this.validateActionRequirements(actionData);

    // Check if date/time changed
    const dateTimeChanged = hasDateTimeChanged(
      inspection.inspectionDate,
      inspection.inspectionTime,
      actionData.inspectionDate,
      actionData.inspectionTime
    );

    // Prepare update object
    let update: any = {
      inspectionType: actionData.inspectionType,
      isLOI: actionData.inspectionType === "LOI",
    };

    let logMessage = "";
    let emailSubject = "";
    let emailData: any = {};

    const senderName = isSeller
      ? (inspection.owner as any).fullName
      : (inspection.requestedBy as any).fullName;

    const buyerData = inspection.requestedBy as any;
    const sellerData = inspection.owner as any;

    // Process actions
    switch (actionData.action) {
      case "accept":
        ({
          update,
          logMessage,
          emailSubject,
          emailData,
        } = this.handleAccept(
          actionData,
          inspection,
          senderName,
          dateTimeChanged,
          inspection.stage // Pass current stage to handleAccept
        ));
        break;

      case "reject":
        ({ update, logMessage, emailSubject, emailData } = this.handleReject(
          actionData,
          inspection,
          senderName,
          inspectionId,
          buyerId,
          ownerId
        ));
        break;

      case "counter":
        ({ update, logMessage, emailSubject, emailData } = this.handleCounter(
          actionData,
          inspection,
          senderName,
          isSeller,
          dateTimeChanged,
          inspectionId,
          buyerId,
          ownerId
        ));
        break;

      case "request_changes":
        ({ update, logMessage, emailSubject, emailData } =
          this.handleRequestChanges(
            actionData,
            inspection,
            senderName,
            dateTimeChanged
          ));
        break;

      default:
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid action");
    }

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
        { new: true }
      );

    if (!updatedInspection) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to update inspection"
      );
    }

    // Log activity
    await InspectionLogService.logActivity({
      inspectionId,
      propertyId: (inspection.propertyId as any)._id,
      senderId: userId,
      senderRole: userType,
      message: logMessage,
      status: update.status,
      stage: update.stage, // Use the determined stage
      meta: {
        action: actionData.action,
        inspectionType: actionData.inspectionType,
        counterPrice: actionData.counterPrice,
        documentUrl: actionData.documentUrl,
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

    // Send emails to both buyer and seller with different content
    try {
      // Email to buyer
      const buyerEmailTemplate = generateNegotiationEmailTemplate({
        userType,
        action: actionData.action,
        buyerName: buyerData.fullName,
        sellerName: sellerData.fullName,
        recipientType: "buyer",
        payload: emailData,
        isLOI: actionData.inspectionType === "LOI",
      });

      // Email to seller
      const sellerEmailTemplate = generateNegotiationEmailTemplate({
        userType,
        action: actionData.action,
        buyerName: buyerData.fullName,
        sellerName: sellerData.fullName,
        recipientType: "seller",
        payload: emailData,
        isLOI: actionData.inspectionType === "LOI",
      });

      // Send both emails
      const emailResults = await Promise.allSettled([
        sendEmail({
          to: buyerData.email,
          subject: emailSubject,
          html: generalTemplate(buyerEmailTemplate.html),
          text: buyerEmailTemplate.text,
        }),
        sendEmail({
          to: sellerData.email,
          subject: emailSubject,
          html: generalTemplate(sellerEmailTemplate.html),
          text: sellerEmailTemplate.text,
        }),
      ]);

      console.log(
        `📧 Emails sent - Buyer: ${buyerData.email}, Seller: ${sellerData.email}: ${emailSubject}`
      );

      const emailsSent = {
        buyer: emailResults[0].status === "fulfilled",
        seller: emailResults[1].status === "fulfilled",
      };

      if (emailResults[0].status === "rejected") {
        console.error("Failed to send email to buyer:", emailResults[0].reason);
      }
      if (emailResults[1].status === "rejected") {
        console.error(
          "Failed to send email to seller:",
          emailResults[1].reason
        );
      }

      return {
        inspection: updatedInspection,
        emailsSent,
        logCreated: true,
        notificationSent: true,
      };
    } catch (emailError) {
      console.error("Failed to send emails:", emailError);
      return {
        inspection: updatedInspection,
        emailsSent: { buyer: false, seller: false },
        logCreated: true,
        notificationSent: true,
      };
    }
  }

  public async getInspectionDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { userID, inspectionID, userType } = req.params;

      const inspection = await DB.Models.InspectionBooking.findById(
        inspectionID
      )
        .populate(
          "propertyId",
          "title location price propertyType briefType pictures _id owner"
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
          "Seller not authorized for this inspection"
        );
      }

      if (
        userType === "buyer" &&
        (inspection.requestedBy as any)._id.toString() !== userID
      ) {
        throw new RouteError(
          HttpStatusCodes.FORBIDDEN,
          "Buyer not authorized for this inspection"
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
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { userId, inspectionId } = req.params;

      const inspection = await DB.Models.InspectionBooking.findById(
        inspectionId
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
          message: "Access denied. You are not associated with this inspection.",
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
    req: Request,
    res: Response,
    next: NextFunction
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
          "title location price propertyType briefType pictures"
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
    req: Request,
    res: Response,
    next: NextFunction
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

  private validateActionRequirements(actionData: InspectionActionData) {
    if (
      actionData.action === "counter" &&
      actionData.inspectionType === "price" &&
      !actionData.counterPrice
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Counter price is required for price negotiations"
      );
    }

    if (
      actionData.action === "counter" &&
      actionData.inspectionType === "LOI" &&
      !actionData.documentUrl
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Document URL is required for LOI counter offers"
      );
    }

    if (
      actionData.action === "request_changes" &&
      actionData.inspectionType !== "LOI"
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Request changes action is only available for LOI inspections"
      );
    }

    if (actionData.action === "request_changes" && !actionData.reason) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Reason is required when requesting changes"
      );
    }
  }

  private determineStage(
    action: InspectionActionData["action"],
    inspectionType: InspectionActionData["inspectionType"],
    hasDateTimePayload: boolean,
    currentStage: string
  ): string {
    if (action === "accept") {
      if (currentStage === "inspection") {
        return "completed";
      }
      if (!hasDateTimePayload) {
        return "completed";
      }
      return "inspection";
    } else if (action === "reject") {
      return "cancelled";
    } else if (action === "counter") {
      return "negotiation";
    } else if (action === "request_changes") {
      return "negotiation";
    }
    return currentStage; // Fallback to current stage if no specific rule applies
  }

  private handleAccept(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    dateTimeChanged: boolean,
    currentStage: string
  ) {
    const hasDateTimePayload = !!(
      actionData.inspectionDate || actionData.inspectionTime
    );
    const stage = this.determineStage(
      actionData.action,
      actionData.inspectionType,
      hasDateTimePayload,
      currentStage
    );

    const update = {
      status: "negotiation_accepted",
      inspectionStatus: "accepted",
      isNegotiating: false,
      stage: stage,
      pendingResponseFrom: undefined as string | undefined,
    };

    const emailSubject = `${
      actionData.inspectionType === "price" ? "Price Offer" : "Letter of Intent"
    } Accepted`;
    const logMessage = `${senderName} accepted the ${
      actionData.inspectionType
    } offer${dateTimeChanged ? " with updated inspection date/time" : ""}. Stage: ${stage}.`;

    const emailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      negotiationPrice: inspection.negotiationPrice,
      inspectionDateStatus: "available",
      inspectionDateTime: {
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
      },
    };

    return { update, logMessage, emailSubject, emailData };
  }

  private handleReject(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    inspectionId: string,
    buyerId: string,
    ownerId: string
  ) {
    const stage = this.determineStage(
      actionData.action,
      actionData.inspectionType,
      false, // Not relevant for reject
      inspection.stage
    );

    const update = {
      status: "negotiation_rejected",
      inspectionStatus: "rejected",
      isNegotiating: false,
      stage: stage,
      reason: actionData.reason || actionData.rejectionReason,
      pendingResponseFrom: undefined as string | undefined,
    };

    const emailSubject = `${
      actionData.inspectionType === "price" ? "Price Offer" : "Letter of Intent"
    } Rejected`;
    const logMessage = `${senderName} rejected the ${
      actionData.inspectionType
    } offer${update.reason ? `: ${update.reason}` : ""}. Stage: ${stage}.`;

    const emailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      reason: update.reason,
      checkLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .checkLink,
      rejectLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .rejectLink,
      browseLink: this.generateInspectionLinks(inspectionId, buyerId, ownerId)
        .browseLink,
    };

    return { update, logMessage, emailSubject, emailData };
  }

  private handleCounter(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    isSeller: boolean,
    dateTimeChanged: boolean,
    inspectionId: string,
    buyerId: string,
    ownerId: string
  ) {
    const stage = this.determineStage(
      actionData.action,
      actionData.inspectionType,
      false, // Not relevant for counter stage determination based on date/time payload
      inspection.stage
    );

    const update: any = {
      status: "negotiation_countered",
      inspectionStatus: "countered",
      isNegotiating: true,
      pendingResponseFrom: isSeller ? "buyer" : "seller",
      stage: stage,
    };

    let logMessage = "";
    if (actionData.inspectionType === "price") {
      update.negotiationPrice = actionData.counterPrice;
      logMessage = `${senderName} made a counter offer of ₦${actionData.counterPrice?.toLocaleString()}${
        dateTimeChanged ? " and updated inspection date/time" : ""
      }. Stage: ${stage}.`;
    } else {
      update.letterOfIntention = actionData.documentUrl;
      logMessage = `${senderName} uploaded a new LOI document${
        dateTimeChanged ? " and updated inspection date/time" : ""
      }. Stage: ${stage}.`;
    }

    const emailSubject = "Counter Offer Received";
    const emailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      price: (inspection.propertyId as any).price,
      negotiationPrice: inspection.negotiationPrice,
      sellerCounterOffer: actionData.counterPrice,
      documentUrl: actionData.documentUrl,
      inspectionDateStatus: "available",
      buyerResponseLink: this.generateInspectionLinks(
        inspectionId,
        buyerId,
        ownerId
      ).buyerResponseLink,
      inspectionDateTime: {
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
      },
    };

    return { update, logMessage, emailSubject, emailData };
  }

  private handleRequestChanges(
    actionData: InspectionActionData,
    inspection: any,
    senderName: string,
    dateTimeChanged: boolean
  ) {
    const stage = this.determineStage(
      actionData.action,
      actionData.inspectionType,
      false, // Not relevant for request_changes stage determination based on date/time payload
      inspection.stage
    );

    const update = {
      status: "negotiation_countered", // Keeping this status as per original, but it's more like 'changes_requested'
      inspectionStatus: "requested_changes",
      reason: actionData.reason,
      isNegotiating: true, // Requesting changes typically means negotiation is ongoing
      stage: stage,
      pendingResponseFrom: "buyer" as const, // Assuming buyer makes changes to LOI
    };

    const emailSubject = "Changes Requested for Letter of Intent";
    const logMessage = `${senderName} requested changes to the LOI: ${actionData.reason}${
      dateTimeChanged ? " and updated inspection date/time" : ""
    }. Stage: ${stage}.`;

    const emailData = {
      propertyType: (inspection.propertyId as any).propertyType,
      location: (inspection.propertyId as any).location,
      reason: actionData.reason,
      inspectionDateTime: {
        newDateTime: {
          newDate: actionData.inspectionDate || inspection.inspectionDate,
          newTime: actionData.inspectionTime || inspection.inspectionTime,
        },
      },
    };

    return { update, logMessage, emailSubject, emailData };
  }

  public async submitInspectionRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const validation = SubmitInspectionSchema.safeParse(req.body);
      
      if (!validation.success) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Invalid inspection request payload"
        );
      }
 
      const {
        inspectionType,
        inspectionDate,
        inspectionTime,
        requestedBy,
        transaction,
        properties,
      } = validation.data;

      // Create or retrieve the buyer by email
      const buyer = await DB.Models.Buyer.findOneAndUpdate(
        { email: requestedBy.email },
        { $setOnInsert: requestedBy },
        { upsert: true, new: true }
      );

      // Save the transaction
      const transactionDoc = await DB.Models.Transaction.create({
        ...transaction,
        buyerId: buyer._id,
      });

      const savedInspections = [];

      for (const prop of properties) {
        const property = await DB.Models.Property.findById(prop.propertyId).lean();
        if (!property) {
          throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            `Property with ID ${prop.propertyId} not found`
          );
        }

        const isNegotiating = !!prop.negotiationPrice;
        const isLOI = !!prop.letterOfIntention;

        const stage = isNegotiating || isLOI ? "negotiation" : "inspection";

        const inspection = await DB.Models.InspectionBooking.create({
          propertyId: prop.propertyId,
          bookedBy: buyer._id,
          bookedByModel: "Buyer",
          inspectionDate: new Date(inspectionDate),
          inspectionTime,
          status: "pending_transaction",
          requestedBy: buyer._id,
          transaction: transactionDoc._id,
          isNegotiating,
          isLOI,
          inspectionType,
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
          senderRole: "buyer",
          message: `Inspection request submitted${isNegotiating ? " with negotiation price" : ""}${isLOI ? " with LOI" : ""}.`,
          status: "pending_transaction",
          stage: stage,
          meta: {
            inspectionType,
            negotiationPrice: prop.negotiationPrice || 0,
            letterOfIntention: prop.letterOfIntention || null,
            inspectionDate,
            inspectionTime,
          },
        });

      }

      res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Inspection request submitted",
        data: savedInspections,
      });

    } catch (error) {
      console.error("submitInspectionRequest error:", error);
      next(error);
    }
  };

}

export default new InspectionActionsController();