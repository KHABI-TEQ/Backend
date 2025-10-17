import { Schema, model, Document, Model } from "mongoose";

export interface ISystemSetting {
  key: string;
  value: any;
  description?: string;
  category?: string;
  isEditable?: boolean;
  status: "active" | "inactive";
}

export interface ISystemSettingDoc extends ISystemSetting, Document {}
export type ISystemSettingModel = Model<ISystemSettingDoc>;

export class SystemSetting {
  private generalModel: Model<ISystemSettingDoc>;

  constructor() {
    const schema = new Schema<ISystemSettingDoc>(
      {
        key: { type: String, required: true, unique: true, index: true },
        value: { type: Schema.Types.Mixed, required: true },
        description: { type: String },
        category: { type: String, default: "general" },
        isEditable: { type: Boolean, default: true },
        status: {
          type: String,
          enum: ['active', 'inactive'],
          default: 'active',
        },
      },
      { timestamps: true }
    );

    this.generalModel = model<ISystemSettingDoc>("SystemSetting", schema);
  }

  public get model(): Model<ISystemSettingDoc> {
    return this.generalModel;
  }
}
