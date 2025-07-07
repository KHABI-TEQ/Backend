import { DB } from '..';
import mongoose from "mongoose"
import sendEmail from '../../common/send.email';
import { Request, Response } from 'express';
import { RouteError } from '../../common/classes';
import { IInspectionBooking } from '../../models';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import {
  generalTemplate,
  InspectionRequestWithNegotiation,
  InspectionRequestWithNegotiationSellerTemplate,
} from '../../common/email.template';
import notificationService from '../../services/notification.service';
import { InspectionLogService } from '../../services/inspectionLog.service';


interface Request extends Express.Request {
  body?: any;
  params?: any;
  query?: any;
  admin?: any;
}

export class AdminInspectionController {


    /**
   * Fetch all inspection bookings with optional filters
   * @param req Express request
   * @param res Express response
   */
  public async getAllInspections(req: Request, res: Response): Promise<Response> {
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
      if (propertyId && mongoose.isValidObjectId(propertyId)) query.propertyId = propertyId;
      if (owner && mongoose.isValidObjectId(owner)) query.owner = owner;
      if (typeof isNegotiating !== 'undefined') query.isNegotiating = isNegotiating === 'true';

      const currentPage = Math.max(1, parseInt(page as string, 10));
      const perPage = Math.min(100, parseInt(limit as string, 10));

      const total = await DB.Models.InspectionBooking.countDocuments(query);
      const inspections = await DB.Models.InspectionBooking.find(query)
        .populate('propertyId')
        .populate('owner')
        .populate('requestedBy')
        .populate('transaction')
        .skip((currentPage - 1) * perPage)
        .limit(perPage)
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        message: 'Inspections fetched successfully',
        data: inspections,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      });
    } catch (error: any) {
      console.error('Error fetching inspections:', error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch inspections');
    }
  }


  /**
   * Get a single inspection with transaction and buyer details
   */
  public async getSingleInspection(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid inspection ID');
    }

    const inspection = await DB.Models.InspectionBooking.findById(id)
      .populate({
        path: 'transaction',
        model: DB.Models.Transaction.modelName,
        populate: {
          path: 'buyerId',
          model: DB.Models.Buyer.modelName,
        },
      })
      .populate('propertyId')
      .populate('owner')
      .populate('requestedBy');

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Inspection not found');
    }

    return res.status(200).json({
      success: true,
      message: 'Inspection details fetched successfully',
      data: inspection,
    });
  }


  /**
   * Update the inspection's status (e.g., approve, reject transaction, etc.)
   */

  public async updateInspectionStatus(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['approve', 'reject'];

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid inspection ID');
    }

    if (!allowedStatuses.includes(status)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid inspection status');
    }

    const inspection = await DB.Models.InspectionBooking.findById(id)
      .populate('transaction')
      .populate('requestedBy')
      .populate('propertyId')
      .populate('owner');

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Inspection not found');
    }

    const currentStatus = inspection.status;

    // ❌ Prevent re-approving already approved inspections
    if (
      (currentStatus === 'pending_inspection' || currentStatus === 'negotiation_countered') &&
      status === 'approve'
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        'Inspection has already been approved. Cannot approve again.'
      );
    }
 
    // ✅ Properly typed updated status
    let updatedStatus: IInspectionBooking['status'];

    if (status === 'reject') {
      updatedStatus = 'transaction_failed';
    } else if (status === 'approve') {
      updatedStatus = inspection.isNegotiating ? 'negotiation_countered' : 'pending_inspection';
    }

    inspection.status = updatedStatus;
    await inspection.save();

    // ✅ Send email only on approval
    if (status === 'approve') {
      const buyer = inspection.requestedBy as any;
      const property = inspection.propertyId as any;
      const owner = inspection.owner as any;

      const location = `${property.location.state}, ${property.location.localGovernment}, ${property.location.area}`;
      const formattedPrice = property.price?.toLocaleString('en-US') ?? 'N/A';
      const negotiationPrice = inspection.negotiationPrice?.toLocaleString('en-US') ?? 'N/A';

      // log inspection details
      await InspectionLogService.logActivity({
        inspectionId: inspection._id.toString(),
        propertyId: (inspection.propertyId as any)._id.toString(),
        senderId: req.admin?._id.toString(),
        senderRole: 'admin',
        message: `Inspection transaction approved successfully - status updated to ${updatedStatus}`,
        status: updatedStatus,
        stage: 'inspection',
      });

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

      const buyerEmailHtml = InspectionRequestWithNegotiation(buyer.fullName, emailData);
      const sellerEmailHtml = InspectionRequestWithNegotiationSellerTemplate(
        owner.fullName || owner.firstName,
        {
          ...emailData,
          responseLink: `${process.env.CLIENT_LINK}/seller-negotiation-inspection/${inspection._id.toString()}`,
        }
      );

      await sendEmail({
        to: buyer.email,
        subject: `New Offer Received – Action Required`,
        html: generalTemplate(buyerEmailHtml),
        text: generalTemplate(buyerEmailHtml),
      });

      await sendEmail({
        // to: "gatukurh1+4@gmail.com",
        to: owner.email, // Replace with owner.email in prod
        subject: `Inspection Request Submitted`,
        html: generalTemplate(sellerEmailHtml),
        text: generalTemplate(sellerEmailHtml),
      });

      const propertyLocation = `${property.location.area}, ${property.location.localGovernment}, ${property.location.state}`;

      // For seller
      await notificationService.createNotification({
        user: owner._id,
        title: 'New Inspection Request',
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


  public async getInspectionStats(req: Request, res: Response): Promise<Response> {
    try {
      // 1. Count total inspections
      const totalInspections = await DB.Models.InspectionBooking.countDocuments();

      // 2. Count pending inspections
      const totalPendingInspections = await DB.Models.InspectionBooking.countDocuments({
        status: 'pending_transaction',
      });

      // 3. Count completed inspections
      const totalCompletedInspections = await DB.Models.InspectionBooking.countDocuments({
        status: 'completed',
      });

      // 4. Count cancelled inspections
      const totalCancelledInspections = await DB.Models.InspectionBooking.countDocuments({
        status: 'cancelled',
      });

      // 5. Count active negotiations
      const activeNegotiationStatuses: IInspectionBooking['status'][] = [
        'pending_inspection',
        'inspection_approved',
        'inspection_rescheduled',
        'negotiation_countered',
        'negotiation_accepted',
        'negotiation_rejected',
        'negotiation_cancelled',
      ];

      const totalActiveNegotiations = await DB.Models.InspectionBooking.countDocuments({
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
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message || 'Error getting stats');
    }
  }

  public async getInspectionLogs(req: Request, res: Response): Promise<Response> {
    try {
      const { propertyId, inspectionId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      if (!propertyId && !inspectionId) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'propertyId or inspectionId is required');
      }

      const filter: Record<string, any> = {};
      if (propertyId) filter.propertyId = propertyId;
      if (inspectionId) filter.inspectionId = inspectionId;

      const [logs, total] = await Promise.all([
        DB.Models.InspectionActivityLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('senderId', '_id firstName lastName email')
          .lean(),
        DB.Models.InspectionActivityLog.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        message: 'Inspection logs fetched successfully',
        data: logs,
        pagination: {
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          perPage: limit,
        },
      });
    } catch (error: any) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message || 'Error fetching logs');
    }
  }


}
