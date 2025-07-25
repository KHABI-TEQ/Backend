import { Types } from 'mongoose';
import { DB } from '../controllers';
import { INotificationDoc } from '../models/notification';

class NotificationService {
  public async getAll(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      customDate?: string;
      month?: number;
      year?: number;
      withPagination?: boolean;
    }
  ): Promise<{
    data: INotificationDoc[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 5,
      search = '',
      customDate,
      month,
      year,
      withPagination = false,
    } = params;

    const filter: Record<string, any> = { user: userId };

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { message: new RegExp(search, 'i') },
      ];
    }

    if (customDate) {
      const date = new Date(customDate);
      filter.createdAt = {
        $gte: new Date(date.setHours(0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59)),
      };
    }

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const query = DB.Models.Notification.find(filter).sort({ createdAt: -1 });

    if (withPagination) {
      const total = await DB.Models.Notification.countDocuments(filter);
      const data = await query.skip((page - 1) * limit).limit(limit);
      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    }

    const data = await query.limit(limit);
    return { data };
  }

  public async getById(id: string): Promise<INotificationDoc | null> {
    return DB.Models.Notification.findById(id);
  }

  public async markRead(id: string): Promise<boolean> {
    const result = await DB.Models.Notification.findByIdAndUpdate(id, { isRead: true });
    return !!result;
  }

  public async markUnRead(id: string): Promise<boolean> {
    const result = await DB.Models.Notification.findByIdAndUpdate(id, { isRead: false });
    return !!result;
  }

  public async markAllRead(userId: string): Promise<boolean> {
    const result = await DB.Models.Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    return !!result;
  }

  public async delete(id: string): Promise<boolean> {
    const result = await DB.Models.Notification.findByIdAndDelete(id);
    return !!result;
  }

  public async deleteAll(userId: string): Promise<boolean> {
    const result = await DB.Models.Notification.deleteMany({ user: userId });
    return !!result;
  }

  public async createNotification(payload: {
    user: string;
    title: string;
    message: string;
    meta?: Record<string, any>;
  }): Promise<INotificationDoc> {
    return DB.Models.Notification.create(payload);
  }

  public async bulkDelete(
    ids: string[],
    userId: string
  ): Promise<{ deletedCount: number }> {
    const result = await DB.Models.Notification.deleteMany({
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      user: userId,
    });

    return { deletedCount: result.deletedCount || 0 };
  }

}

export default new NotificationService();
