import { model, Model, Schema, Types, Document } from 'mongoose';

/**
 * Interface for Notification records.
 */
export interface INotification {
  user: Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  meta?: Record<string, any>; // optional data payload
}

export interface INotificationDoc extends INotification, Document {}

export type INotificationModel = Model<INotificationDoc>;

/**
 * Notification model with class-based structure
 */
export class Notification {
  private NotificationModel: INotificationModel;

  constructor() {
    const schema = new Schema<INotificationDoc>(
      {
        user: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: 'User',
        },
        title: {
          type: String,
          required: true,
          trim: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
        },
        isRead: {
          type: Boolean,
          default: false,
        },
        meta: {
          type: Schema.Types.Mixed,
          default: {},
        },
      },
      {
        timestamps: true, // adds createdAt and updatedAt
      }
    );

    this.NotificationModel = model<INotificationDoc>('Notification', schema);
  }

  public get model(): INotificationModel {
    return this.NotificationModel;
  }
}
