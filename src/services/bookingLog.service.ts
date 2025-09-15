import { Types } from "mongoose";
import { DB } from "../controllers";

interface LogBookingActivityInput {
  bookingId: string;
  propertyId: string;
  senderId: string;
  senderRole: "buyer" | "owner" | "admin";
  senderModel: "User" | "Buyer" | "Admin";
  message: string;
  status?: "requested" | "pending" | "accepted" | "rejected" | "cancelled" | "completed";
  stage?: "booking" | "payment" | "checkin" | "checkout" | "completed" | "cancelled";
  meta?: Record<string, any>;
}

export class BookingLogService {
  /**
   * Log a new booking activity
   */
  public static async logActivity(input: LogBookingActivityInput) {
    const {
      bookingId,
      propertyId,
      senderId,
      senderRole,
      senderModel,
      message,
      status,
      stage,
      meta = {},
    } = input;

    const activity = await DB.Models.BookingActivityLog.create({
      bookingId: new Types.ObjectId(bookingId),
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
      DB.Models.BookingActivityLog.find({ propertyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "senderId",
          select: "firstName lastName fullName email",
        })
        .lean(),
      DB.Models.BookingActivityLog.countDocuments({ propertyId }),
    ]);

    const formattedLogs = logs.map((log) => {
      const sender: any = log.senderId;
      const senderName =
        sender?.fullName || `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim();

      return {
        ...log,
        senderName: senderName || "Unknown",
        senderEmail: sender?.email || "",
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
   * Get logs by booking ID
   */
  public static async getLogsByBooking(bookingId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      DB.Models.BookingActivityLog.find({ bookingId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "senderId",
          select: "firstName lastName fullName email",
        })
        .lean(),
      DB.Models.BookingActivityLog.countDocuments({ bookingId }),
    ]);

    const formattedLogs = logs.map((log) => {
      const sender: any = log.senderId;
      const senderName =
        sender?.fullName || `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim();

      return {
        ...log,
        senderName: senderName || "Unknown",
        senderEmail: sender?.email || "",
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
