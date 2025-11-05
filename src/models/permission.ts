import { Schema, model, Document, Model } from 'mongoose';

export interface IPermission {
  name: string;
  description: string;
  resource: string; // e.g., 'agents', 'properties', 'inspections'
  action: string; // e.g., 'create', 'read', 'update', 'delete'
  category:
    | 'agents'
    | 'properties'
    | 'landlords'
    | 'buyers'
    | 'inspections'
    | 'field-agents'
    | 'admins'
    | 'preferences'
    | 'promotions'
    | 'transactions'
    | 'analytics'
    | 'settings'
    | 'testimonials'
    | 'subscriptions'
    | 'referrals'
    | 'verification'
    | 'ads'
    | 'extra-pages'
    | 'public-access-page'
    | 'email-subscriptions';
  isActive: boolean;
}
 
export interface IPermissionDoc extends IPermission, Document {}

export type IPermissionModel = Model<IPermissionDoc>;

export class Permission {
  private PermissionModel: Model<IPermissionDoc>;

  constructor() {
    const schema = new Schema(
      {
        name: {
          type: String,
          required: true,
          unique: true,
          trim: true,
        },
        description: {
          type: String,
          required: true,
        },
        resource: {
          type: String,
          required: true,
          index: true,
        },
        action: {
          type: String,
          required: true,
        },
        category: {
          type: String,
          required: true,
          enum: [
            'agents',
            'properties',
            'landlords',
            'buyers',
            'inspections',
            'field-agents',
            'admins',
            'preferences',
            'promotions',
            'transactions',
            'analytics',
            'settings',
            'testimonials',
            'subscriptions',
            'referrals',
            'verification',
            'ads',
            'extra-pages',
            'public-access-page',
            'email-subscriptions',
          ],
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    this.PermissionModel = model<IPermissionDoc>('Permission', schema);
  }

  public get model(): Model<IPermissionDoc> {
    return this.PermissionModel;
  }
}
