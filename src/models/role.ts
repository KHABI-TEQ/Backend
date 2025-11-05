import { Schema, model, Document, Model } from 'mongoose';
 
export interface IRole {
  name: string;
  description: string;
  permissions: string[]; // Array of Permission IDs
  isActive: boolean;
  level: number; // 1: Super Admin, 2: Admin, 3: Manager, 4: Viewer
}
 
export interface IRoleDoc extends IRole, Document {}

export type IRoleModel = Model<IRoleDoc>;

export class Role {
  private RoleModel: Model<IRoleDoc>;

  constructor() {
    const schema = new Schema(
      {
        name: {
          type: String,
          required: true,
          unique: true,
          trim: true,
          enum: ['superAdmin', 'admin', 'manager', 'viewer', 'agent-reviewer', 'property-reviewer', 'inspector', 'field-agent-manager'],
        },
        description: {
          type: String,
          required: true,
        },
        permissions: [
          {
            type: Schema.Types.ObjectId,
            ref: 'Permission',
            required: true,
          },
        ],
        isActive: {
          type: Boolean,
          default: true,
        },
        level: {
          type: Number,
          required: true,
          min: 1,
          max: 4,
        },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    // Compound index for uniqueness
    schema.index({ name: 1, isActive: 1 });

    this.RoleModel = model<IRoleDoc>('Role', schema);
  }

  public get model(): Model<IRoleDoc> {
    return this.RoleModel;
  }
}
