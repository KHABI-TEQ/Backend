import { Schema, model, Document, Model, Types } from "mongoose";

export interface ISyndicatedListingMapping {
  propertyId: Types.ObjectId;
  userId: Types.ObjectId;
  platformKey: string;
  platformListingId: string;
  listingUrl?: string;
  lastSyncedStatus?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISyndicatedListingMappingDoc extends ISyndicatedListingMapping, Document {}
export type ISyndicatedListingMappingModel = Model<ISyndicatedListingMappingDoc>;

export class SyndicatedListingMapping {
  private _model: ISyndicatedListingMappingModel;

  constructor() {
    const schema = new Schema<ISyndicatedListingMappingDoc>(
      {
        propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        platformKey: { type: String, required: true, trim: true, lowercase: true },
        platformListingId: { type: String, required: true, trim: true },
        listingUrl: { type: String },
        lastSyncedStatus: { type: String },
        isActive: { type: Boolean, default: true },
      },
      { timestamps: true }
    );

    schema.index({ propertyId: 1, platformKey: 1 }, { unique: true });
    schema.index({ platformKey: 1, platformListingId: 1 }, { unique: true });

    this._model = model<ISyndicatedListingMappingDoc>("SyndicatedListingMapping", schema);
  }

  public get model(): ISyndicatedListingMappingModel {
    return this._model;
  }
}
