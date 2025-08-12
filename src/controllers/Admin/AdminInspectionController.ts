import { DB } from "..";
import mongoose from "mongoose";
import sendEmail from "../../common/send.email";
import { Request, Response } from "express";
import { RouteError } from "../../common/classes";
import { IInspectionBooking } from "../../models";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { 
  generalTemplate,
  InspectionRequestWithNegotiation,
  InspectionRequestWithNegotiationSellerTemplate,
  InspectionTransactionRejectionTemplate,
} from "../../common/email.template";
import notificationService from "../../services/notification.service";
import { InspectionLogService } from "../../services/inspectionLog.service";
import { AppRequest } from "../../types/express";
import { FieldAgentAssignmentTemplate, FieldAgentRemovalTemplate, InspectionLoiRejectionTemplate } from "../../common/emailTemplates/inspectionMails";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";

export class AdminInspectionController {
  /**
   * Fetch all inspection bookings with optional filters
   * @param req Express request
   * @param res Express response
   */
  public async getAllInspections(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        stage,
        propertyId,
        owner,
        isNegotiating,
      } = req.query;

      const query: any = {};

      if (status) query.status = status;
      if (stage) query.stage = stage;
      if (propertyId && mongoose.isValidObjectId(propertyId))
        query.propertyId = propertyId;
      if (owner && mongoose.isValidObjectId(owner)) query.owner = owner;
      if (typeof isNegotiating !== "undefined")
        query.isNegotiating = isNegotiating === "true";

      const currentPage = Math.max(1, parseInt(page as string, 10));
      const perPage = Math.min(100, parseInt(limit as string, 10));

      const total = await DB.Models.InspectionBooking.countDocuments(query);
      const inspections = await DB.Models.InspectionBooking.find(query)
        .populate("propertyId")
        .populate("owner")
        .populate("requestedBy")
        .populate({
            path: "transaction",
            model: "newTransaction",
            select: "-__v -paymentDetails",
        })
        .skip((currentPage - 1) * perPage)
        .limit(perPage)
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        message: "Inspections fetched successfully",
        data: inspections,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      });
    } catch (error: any) {
      console.error("Error fetching inspections:", error);
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to fetch inspections",
      );
    }
  }

  /**
   * Get a single inspection with transaction and buyer details
   */
  public async getSingleInspection(
    req: Request,
    res: Response,
  ): Promise<Response> {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid inspection ID",
      );
    }

    const inspection = await DB.Models.InspectionBooking.findById(id)
      .populate({
        path: "transaction",
        model: "newTransaction",
        select: "-__v -paymentDetails",
      })
      .populate("propertyId")
      .populate("owner")
      .populate("requestedBy");

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    return res.status(200).json({
      success: true,
      message: "Inspection details fetched successfully",
      data: inspection,
    });
  }

  /**
   * Update the inspection's status (e.g., approve, reject transaction, etc.)
   */ 

  public async updateInspectionStatus(
    req: AppRequest,
    res: Response,
  ): Promise<Response> {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["approve", "reject"];

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid inspection ID",
      );
    }

    if (!allowedStatuses.includes(status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid inspection status",
      );
    }

    const inspection = await DB.Models.InspectionBooking.findById(id)
      .populate("transaction")
      .populate("requestedBy")
      .populate("propertyId")
      .populate("owner");

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    const currentStatus = inspection.status;

    // Prevent re-approving already approved
    if (
      (currentStatus === "active_negotiation" ||
        currentStatus === "negotiation_countered") &&
      status === "approve"
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Inspection has already been approved. Cannot approve again.",
      );
    }

    let updatedStatus: IInspectionBooking["status"];
    let updatedStage: IInspectionBooking["stage"];
    let pendingResponseFrom: IInspectionBooking["pendingResponseFrom"];

    // Handle rejection
    if (status === "reject") {
      updatedStatus = "transaction_failed";
      updatedStage = "cancelled";
      pendingResponseFrom = "admin";
    }

    // Handle approval with conditional logic
    if (status === "approve") {
      const isPrice = inspection.inspectionType === "price";
      const isLOI = inspection.inspectionType === "LOI";
      const hasNegotiationPrice = inspection.negotiationPrice > 0;
      const hasLOIDocument =
        inspection.letterOfIntention &&
        inspection.letterOfIntention.trim() !== "";

      if (isPrice) {
        inspection.isNegotiating = hasNegotiationPrice;
        updatedStage = hasNegotiationPrice ? "negotiation" : "inspection";
      } else if (isLOI) {
        inspection.isLOI = !!hasLOIDocument;
        updatedStage = hasLOIDocument ? "negotiation" : "inspection";
      }

      pendingResponseFrom = "seller";
      updatedStatus = inspection.isNegotiating
        ? "negotiation_countered"
        : "active_negotiation";
    }

    inspection.pendingResponseFrom = pendingResponseFrom;
    inspection.status = updatedStatus;
    inspection.stage = updatedStage;

    await inspection.save();

    const buyer = inspection.requestedBy as any;
    const property = inspection.propertyId as any;
    const owner = inspection.owner as any;

    const location = `${property.location.state}, ${property.location.localGovernment}, ${property.location.area}`;
    const formattedPrice = property.price?.toLocaleString("en-US") ?? "N/A";
    const negotiationPrice =
      inspection.negotiationPrice?.toLocaleString("en-US") ?? "N/A";

    const emailData = {
      propertyType: property.propertyType,
      location,
      price: formattedPrice,
      inspectionDate: inspection.inspectionDate,
      inspectionTime: inspection.inspectionTime,
      isNegotiating: inspection.isNegotiating,
      negotiationPrice,
      letterOfIntention: inspection.letterOfIntention,
      agentName: owner.fullName || owner.firstName,
    };

    // Rejection email flow
    if (status === "reject") {
      // send mail to buyer only
      const buyerRejectionHtml = InspectionTransactionRejectionTemplate(
        buyer.fullName,
        {
          ...emailData,
          rejectionReason:
            "Your inspection request was not approved. Please contact support for more info.",
        },
      );

      await sendEmail({
        to: buyer.email,
        subject: `Inspection Request Rejected`,
        html: generalTemplate(buyerRejectionHtml),
        text: generalTemplate(buyerRejectionHtml),
      });

      await InspectionLogService.logActivity({
        inspectionId: inspection._id.toString(),
        propertyId: property._id.toString(),
        senderId: req.admin?._id.toString(),
        senderModel: "Admin",
        senderRole: "admin",
        message: `Inspection transaction rejected by admin.`,
        status: updatedStatus,
        stage: updatedStage,
      });
    }

    // Approval flow
    if (status === "approve") {
      await InspectionLogService.logActivity({
        inspectionId: inspection._id.toString(),
        propertyId: property._id.toString(),
        senderId: req.admin?._id.toString(),
        senderModel: "Admin",
        senderRole: "admin",
        message: `Inspection transaction approved successfully - status updated to ${updatedStatus}`,
        status: updatedStatus,
        stage: updatedStage,
      });

      const buyerEmailHtml = InspectionRequestWithNegotiation(
        buyer.fullName,
        emailData,
      );

      const sellerEmailHtml = InspectionRequestWithNegotiationSellerTemplate(
        owner.fullName || owner.firstName,
        {
          ...emailData,
          responseLink: `${process.env.CLIENT_LINK}/secure-seller-response/${owner._id}/${inspection._id.toString()}`,
        },
      );

      await sendEmail({
        to: buyer.email,
        subject: `New Offer Received – Action Required`,
        html: generalTemplate(buyerEmailHtml),
        text: generalTemplate(buyerEmailHtml),
      });

      await sendEmail({
        to: owner.email,
        subject: `Inspection Request Submitted`,
        html: generalTemplate(sellerEmailHtml),
        text: generalTemplate(sellerEmailHtml),
      });

      const propertyLocation = `${property.location.area}, ${property.location.localGovernment}, ${property.location.state}`;

      await notificationService.createNotification({
        user: owner._id,
        title: "New Inspection Request",
        message: `${buyer.fullName} has requested an inspection for your property at ${propertyLocation}.`,
        meta: {
          propertyId: property._id,
          inspectionId: inspection._id,
          status: updatedStatus,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Inspection status updated to ${updatedStatus}`,
      data: inspection,
    });
  }

  /**
   * Attach a field agent to an inspection
   */
  public async attachFieldAgentToInspection(
    req: AppRequest,
    res: Response,
  ): Promise<Response> {
    const { id } = req.params;
    const { fieldAgentId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid inspection ID",
      );
    }

    if (!mongoose.isValidObjectId(fieldAgentId)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid field agent ID",
      );
    }

    const inspection = await DB.Models.InspectionBooking.findById(id)
      .populate("requestedBy")
      .populate("propertyId")
      .populate("owner");

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    if (["completed", "cancelled"].includes(inspection.stage)) {
       throw new RouteError(HttpStatusCodes.BAD_REQUEST, `Action not allowed when stage is '${inspection.stage}'`);
    }

    // Attach the field agent (matches your schema: assignedFieldAgent)
    inspection.assignedFieldAgent = fieldAgentId;
    await inspection.save();

    const buyer = inspection.requestedBy as any;
    const property = inspection.propertyId as any;
    const owner = inspection.owner as any;

    // Optional: notify the field agent (with user details)
    const fieldAgent = await DB.Models.FieldAgent.findById(fieldAgentId)
      .populate({
        path: 'userId',
        model: DB.Models.User.modelName,
        select: 'firstName lastName email phoneNumber',
      });

    if (!fieldAgent) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent not found");
    }

    const propertyData = {
      propertyType: property.propertyType,
      location: property.location,
      inspectionDate: inspection.inspectionDate,
      inspectionTime: inspection.inspectionTime,
      inspectionMode: inspection.inspectionMode
    }

    const fieldAgentData = fieldAgent.userId as any; 

    const attachFieldAgentBody = generalEmailLayout(
      FieldAgentAssignmentTemplate(fieldAgentData, propertyData)
    );

    if (fieldAgent) {
      await sendEmail({
        to: fieldAgentData.email,
        subject: `New Inspection Assignment`,
        html: attachFieldAgentBody,
        text: attachFieldAgentBody
      });

      await notificationService.createNotification({
        user: fieldAgent.userId._id.toString(),
        title: "New Inspection Assignment",
        message: `You have been assigned to an inspection for ${property.propertyType} at ${property.location.area}, ${property.location.localGovernment}, ${property.location.state}.`,
        meta: {
          propertyId: property._id,
          inspectionId: inspection._id,
        },
      });
    }

    // Log activity
    await InspectionLogService.logActivity({
      inspectionId: inspection._id.toString(),
      propertyId: property._id.toString(),
      senderId: req.admin?._id.toString(),
      senderModel: "Admin",
      senderRole: "admin",
      message: `Field agent ${fieldAgentId} assigned to inspection.`,
      status: inspection.status,
      stage: inspection.stage,
    });

    return res.status(200).json({
      success: true,
      message: `Field agent assigned to inspection successfully.`,
      data: inspection,
    });
  }


  /**
   * Remove a field agent from an inspection
   */
  public async removeFieldAgentFromInspection(
    req: AppRequest,
    res: Response,
  ): Promise<Response> {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid inspection ID",
      );
    }

    const inspection = await DB.Models.InspectionBooking.findById(id)
      .populate("requestedBy")
      .populate("propertyId")
      .populate("owner")
      .populate({
        path: "assignedFieldAgent",
        populate: {
          path: "userId",
          model: DB.Models.User.modelName,
          select: "firstName lastName email phoneNumber",
        },
      });

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    if (["completed", "cancelled"].includes(inspection.stage)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Action not allowed when stage is '${inspection.stage}'`
      );
    }

    if (!inspection.assignedFieldAgent) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "No field agent assigned to this inspection"
      );
    }

    const property = inspection.propertyId as any;
    const removedAgent = inspection.assignedFieldAgent as any;

    // Remove the field agent
    inspection.assignedFieldAgent = undefined;
    await inspection.save();

    // Optional: notify the removed field agent
    const propertyData = {
      propertyType: property.propertyType,
      location: property.location,
      inspectionDate: inspection.inspectionDate,
      inspectionTime: inspection.inspectionTime,
      inspectionMode: inspection.inspectionMode,
    };

    const removeFieldAgentBody = generalEmailLayout(
      FieldAgentRemovalTemplate(removedAgent, propertyData)
    );

    if (removedAgent?.userId) {
      const user = removedAgent.userId as any;

      await sendEmail({
        to: user.email,
        subject: `Inspection Assignment Removed`,
        html: removeFieldAgentBody,
        text: removeFieldAgentBody,
      });

      await notificationService.createNotification({
        user: removedAgent.userId._id.toString(),
        title: "Inspection Assignment Removed",
        message: `Your assignment for ${property.propertyType} at ${property.location.area}, ${property.location.localGovernment}, ${property.location.state} has been removed.`,
        meta: {
          propertyId: property._id,
          inspectionId: inspection._id,
        },
      });
    }

    // Log activity
    await InspectionLogService.logActivity({
      inspectionId: inspection._id.toString(),
      propertyId: property._id.toString(),
      senderId: req.admin?._id.toString(),
      senderModel: "Admin",
      senderRole: "admin",
      message: `Field agent removed from inspection.`,
      status: inspection.status,
      stage: inspection.stage,
    });

    return res.status(200).json({
      success: true,
      message: `Field agent removed from inspection successfully.`,
      data: inspection,
    });
  }



  public async approveOrRejectLOIDocs(
    req: AppRequest,
    res: Response
  ): Promise<Response> {
    const { id } = req.params;
    const { status, reason } = req.body;

    const allowedStatuses = ["approve", "reject"];
    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid inspection ID"
      );
    }

    if (!allowedStatuses.includes(status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid LOI status"
      );
    }

    const inspection = await DB.Models.InspectionBooking.findById(id)
      .populate("requestedBy")
      .populate("propertyId")
      .populate("owner");

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    // Set approveLOI value based on action
    const approveLOI = status === "approve";

    // Update LOI status
    inspection.approveLOI = approveLOI;
    if (status === "reject") {
      inspection.status = "negotiation_cancelled";
      inspection.stage = "cancelled";
    }
     
    await inspection.save();

    const buyer = inspection.requestedBy as any;
    const property = inspection.propertyId as any;
    const owner = inspection.owner as any;

    const location = `${property.location?.state}, ${property.location?.localGovernment}, ${property.location?.area}`;
    const formattedPrice = property.price?.toLocaleString("en-US") ?? "N/A";
    const negotiationPrice = inspection.negotiationPrice?.toLocaleString("en-US") ?? "N/A";

    const emailData = {
      propertyType: property.propertyType,
      location,
      price: formattedPrice,
      inspectionDate: inspection.inspectionDate,
      inspectionTime: inspection.inspectionTime,
      isNegotiating: inspection.isNegotiating,
      negotiationPrice,
      letterOfIntention: inspection.letterOfIntention,
      agentName: owner?.fullName ?? owner?.firstName ?? "N/A",
      reason: reason ?? "No reason provided"
    };

    if (status === "reject") {
      // Send rejection email to buyer
      const buyerRejectionHtml = InspectionLoiRejectionTemplate(
        buyer.fullName,
        emailData
      );

      await sendEmail({
        to: buyer.email,
        subject: `LOI Document Rejected`,
        html: generalTemplate(buyerRejectionHtml),
        text: generalTemplate(buyerRejectionHtml),
      });

      await InspectionLogService.logActivity({
        inspectionId: inspection._id.toString(),
        propertyId: property._id.toString(),
        senderId: req.admin?._id.toString(),
        senderModel: "Admin",
        senderRole: "admin",
        message: `LOI document rejected by admin.`,
        meta: { approveLOI, reason }
      });
    }

    if (status === "approve") {
      await InspectionLogService.logActivity({
        inspectionId: inspection._id.toString(),
        propertyId: property._id.toString(),
        senderId: req.admin?._id.toString(),
        senderModel: "Admin",
        senderRole: "admin",
        message: `LOI document approved by admin.`,
        meta: { approveLOI }
      });
    }

    return res.status(200).json({
      success: true,
      message: `LOI status updated to ${approveLOI ? "approved" : "rejected"}`,
      data: inspection,
    });
  }


  public async getInspectionStats(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      // 1. Count total inspections
      const totalInspections =
        await DB.Models.InspectionBooking.countDocuments();

      // 2. Count pending inspections
      const totalPendingInspections =
        await DB.Models.InspectionBooking.countDocuments({
          status: "pending_transaction",
        });

      // 3. Count completed inspections
      const totalCompletedInspections =
        await DB.Models.InspectionBooking.countDocuments({
          status: "completed",
        });

      // 4. Count cancelled inspections
      const totalCancelledInspections =
        await DB.Models.InspectionBooking.countDocuments({
          status: "cancelled",
        });

      // 5. Count active negotiations
      const activeNegotiationStatuses: IInspectionBooking["status"][] = [
        "active_negotiation",
        "inspection_approved",
        "inspection_rescheduled",
        "negotiation_countered",
        "negotiation_accepted",
        "negotiation_rejected",
        "negotiation_cancelled",
      ];

      const totalActiveNegotiations =
        await DB.Models.InspectionBooking.countDocuments({
          status: { $in: activeNegotiationStatuses },
        });

      // 6. Return as structured response
      return res.status(200).json({
        success: true,
        data: {
          totalInspections,
          totalPendingInspections,
          totalCompletedInspections,
          totalCancelledInspections,
          totalActiveNegotiations,
        },
      });
    } catch (error: any) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        error.message || "Error getting stats",
      );
    }
  }


  public async getInspectionLogs(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const { propertyId, inspectionId } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      if (!propertyId && !inspectionId) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "propertyId or inspectionId is required",
        );
      }

      const filter: Record<string, any> = {};
      if (propertyId) filter.propertyId = propertyId;
      if (inspectionId) filter.inspectionId = inspectionId;

      const [logs, total] = await Promise.all([
        DB.Models.InspectionActivityLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("senderId", "_id firstName lastName fullName email") // fullName added
          .lean(),
        DB.Models.InspectionActivityLog.countDocuments(filter),
      ]);

      const formattedLogs = logs.map((log) => {
        const sender: any = log.senderId;
        const senderName =
          sender?.fullName ||
          `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim();

        return {
          ...log,
          senderName: senderName || "Unknown",
          senderEmail: sender?.email || "",
        };
      });

      return res.status(200).json({
        success: true,
        message: "Inspection logs fetched successfully",
        data: formattedLogs,
        pagination: {
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          perPage: limit,
        },
      });
    } catch (error: any) {
      throw new RouteError(
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        error.message || "Error fetching logs",
      );
    }
  }
}
