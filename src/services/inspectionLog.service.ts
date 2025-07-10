import { Types } from 'mongoose';
import { DB } from '../controllers';

interface LogInspectionActivityInput {
  inspectionId: string;
  propertyId: string;
  senderId: string;
  senderRole: 'buyer' | 'seller' | 'admin';
  senderModel: 'User' | 'Buyer' | 'Admin';
  message: string;
  status?: string;
  stage?: 'inspection' | 'negotiation' | 'completed' | 'cancelled';
  meta?: Record<string, any>;
} 

export class InspectionLogService {
  /**
   * Log a new inspection activity
   */
  public static async logActivity(input: LogInspectionActivityInput) {
    const {
      inspectionId,
      propertyId,
      senderId,
      senderRole,
      senderModel,
      message,
      status,
      stage,
      meta = {},
    } = input;

    const activity = await DB.Models.InspectionActivityLog.create({
      inspectionId: new Types.ObjectId(inspectionId),
      propertyId: new Types.ObjectId(propertyId),
      senderId: new Types.ObjectId(senderId),
      senderModel,
      senderRole,
      message,
      status,
      stage,
      meta,
    });

    return activity;
  }

  /**
   * Get logs by property ID
   */
  public static async getLogsByProperty(propertyId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      DB.Models.InspectionActivityLog.find({ propertyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'senderId',
          select: 'firstName lastName fullName email',
        })
        .lean(),
      DB.Models.InspectionActivityLog.countDocuments({ propertyId }),
    ]);

    const formattedLogs = logs.map(log => {
      const sender: any = log.senderId;
      const senderName =
        sender?.fullName || `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim();

      return {
        ...log,
        senderName: senderName || 'Unknown',
        senderEmail: sender?.email || '',
      };
    });

    return {
      data: formattedLogs,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    };
  }

  /**
   * Get logs by inspection ID
   */
  public static async getLogsByInspection(inspectionId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      DB.Models.InspectionActivityLog.find({ inspectionId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'senderId',
          select: 'firstName lastName fullName email',
        })
        .lean(),
      DB.Models.InspectionActivityLog.countDocuments({ inspectionId }),
    ]);

    const formattedLogs = logs.map(log => {
      const sender: any = log.senderId;
      const senderName =
        sender?.fullName || `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim();

      return {
        ...log,
        senderName: senderName || 'Unknown',
        senderEmail: sender?.email || '',
      };
    });

    return {
      data: formattedLogs,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    };
  }
}
