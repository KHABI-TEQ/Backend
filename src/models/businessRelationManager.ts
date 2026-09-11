import { Schema, model, models, Document, Model } from "mongoose";

export type BrmGender = "male" | "female" | "other";

export interface IBusinessRelationManager {
  fullName: string;
  profilePicture: string;
  phoneNumber: string;
  gender: BrmGender;
  serviceMessage: string;
  isActive: boolean;
}

export interface IBusinessRelationManagerDoc
  extends IBusinessRelationManager,
    Document {
  createdAt: Date;
  updatedAt: Date;
}

export type IBusinessRelationManagerModel = Model<IBusinessRelationManagerDoc>;

export class BusinessRelationManager {
  private _model: IBusinessRelationManagerModel;

  constructor() {
    const schema = new Schema<IBusinessRelationManagerDoc>(
      {
        fullName: { type: String, required: true, trim: true },
        profilePicture: { type: String, required: true, trim: true },
        phoneNumber: { type: String, required: true, trim: true },
        gender: {
          type: String,
          enum: ["male", "female", "other"],
          required: true,
        },
        serviceMessage: { type: String, required: true, trim: true },
        isActive: { type: Boolean, default: true, index: true },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    this._model =
      (models.BusinessRelationManager as IBusinessRelationManagerModel) ||
      model<IBusinessRelationManagerDoc>("BusinessRelationManager", schema);
  }

  public get model(): IBusinessRelationManagerModel {
    return this._model;
  }
}
