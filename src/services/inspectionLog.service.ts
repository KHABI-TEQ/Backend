import { Types } from 'mongoose';
import { DB } from '../controllers';

interface LogInspectionActivityInput {
  inspectionId: string;
  propertyId: string;
  senderId: string;
  senderRole: 'buyer' | 'seller' | 'admin';
  message: string;
  status?: string;
  stage?: 'inspection' | 'negotiation' | 'completed' | 'cancelled';
  meta?: Record<string, any>;
}

export class InspectionLogService {
  public static async logActivity(input: LogInspectionActivityInput) {
    const {
      inspectionId,
      propertyId,
      senderId,
      senderRole,
      message,
      status,
      stage,
      meta = {},
    } = input;

    const activity = await DB.Models.InspectionActivityLog.create({
      inspectionId: new Types.ObjectId(inspectionId),
      propertyId: new Types.ObjectId(propertyId),
      senderId: new Types.ObjectId(senderId),
      senderRole,
      message,
      status,
      stage,
      meta,
    });

    return activity;
  }

  public static async getLogsByProperty(propertyId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      DB.Models.InspectionActivityLog.find({ propertyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'firstName lastName email')
        .lean(),
      DB.Models.InspectionActivityLog.countDocuments({ propertyId }),
    ]);

    return {
      data: logs,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    };
  }

  public static async getLogsByInspection(inspectionId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      DB.Models.InspectionActivityLog.find({ inspectionId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'firstName lastName email')
        .lean(),
      DB.Models.InspectionActivityLog.countDocuments({ inspectionId }),
    ]);

    return {
      data: logs,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    };
  }
}
