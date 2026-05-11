import { Types } from "mongoose";
import { DB } from "../controllers";
import type { AdminNotificationType } from "../models/adminNotification";
import type { IAdminNotificationDoc } from "../models/adminNotification";

export interface CreateAdminNotificationInput {
  title: string;
  message: string;
  type: AdminNotificationType;
  meta?: Record<string, unknown>;
}

/**
 * Fan-out one in-app notification to every active admin (each admin gets their own row + read state).
 * Never throws — failures are logged so callers are not blocked.
 */
export async function notifyAllActiveAdmins(
  payload: CreateAdminNotificationInput
): Promise<void> {
  try {
    const admins = await DB.Models.Admin.find({ isActive: true })
      .select("_id")
      .lean();
    if (!admins.length) return;

    const docs = admins.map((a) => ({
      admin: a._id,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      meta: payload.meta ?? {},
      isRead: false,
    }));

    await DB.Models.AdminNotification.insertMany(docs);
  } catch (err) {
    console.warn("[AdminNotification] notifyAllActiveAdmins failed:", err);
  }
}

class AdminNotificationService {
  async listForAdmin(
    adminId: string,
    params: {
      page?: number;
      limit?: number;
      isRead?: boolean;
      type?: AdminNotificationType;
    }
  ): Promise<{
    data: IAdminNotificationDoc[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      admin: new Types.ObjectId(adminId),
    };
    if (typeof params.isRead === "boolean") {
      filter.isRead = params.isRead;
    }
    if (params.type) {
      filter.type = params.type;
    }

    const [data, total] = await Promise.all([
      DB.Models.AdminNotification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DB.Models.AdminNotification.countDocuments(filter),
    ]);

    return {
      data: data as IAdminNotificationDoc[],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async unreadCount(adminId: string): Promise<number> {
    return DB.Models.AdminNotification.countDocuments({
      admin: new Types.ObjectId(adminId),
      isRead: false,
    });
  }

  async markRead(adminId: string, notificationId: string): Promise<boolean> {
    const res = await DB.Models.AdminNotification.findOneAndUpdate(
      {
        _id: notificationId,
        admin: new Types.ObjectId(adminId),
      },
      { $set: { isRead: true } },
      { new: true }
    );
    return !!res;
  }

  async markAllRead(adminId: string): Promise<number> {
    const res = await DB.Models.AdminNotification.updateMany(
      { admin: new Types.ObjectId(adminId), isRead: false },
      { $set: { isRead: true } }
    );
    return res.modifiedCount ?? 0;
  }

  async deleteOne(adminId: string, notificationId: string): Promise<boolean> {
    const res = await DB.Models.AdminNotification.deleteOne({
      _id: notificationId,
      admin: new Types.ObjectId(adminId),
    });
    return res.deletedCount === 1;
  }
}

export default new AdminNotificationService();
