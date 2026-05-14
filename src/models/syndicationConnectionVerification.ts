import { Schema, model, Document, Model, Types } from "mongoose";

export type SyndicationConnectionVerificationStatus = "pending" | "completed" | "failed";

export interface ISyndicationConnectionVerification {
  correlationId: string;
  userId: Types.ObjectId;
  platformId: Types.ObjectId;
  platformKey: string;
  email: string;
  /** AES-256-GCM fields for password until resolved */
  encBlob: string;
  encIv: string;
  encTag: string;
  status: SyndicationConnectionVerificationStatus;
  connectionId?: Types.ObjectId;
  partnerMessage?: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISyndicationConnectionVerificationDoc extends ISyndicationConnectionVerification, Document {}
export type ISyndicationConnectionVerificationModel = Model<ISyndicationConnectionVerificationDoc>;

export class SyndicationConnectionVerification {
  private _model: ISyndicationConnectionVerificationModel;

  constructor() {
    const schema = new Schema<ISyndicationConnectionVerificationDoc>(
      {
        correlationId: { type: String, required: true, unique: true, trim: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        platformId: { type: Schema.Types.ObjectId, ref: "SyndicationPlatform", required: true, index: true },
        platformKey: { type: String, required: true, trim: true, lowercase: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        encBlob: { type: String },
        encIv: { type: String },
        encTag: { type: String },
        status: {
          type: String,
          enum: ["pending", "completed", "failed"],
          default: "pending",
          index: true,
        },
        connectionId: { type: Schema.Types.ObjectId, ref: "PlatformConnection" },
        partnerMessage: { type: String },
        expiresAt: { type: Date, required: true, index: true },
      },
      { timestamps: true }
    );

    schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    this._model = model<ISyndicationConnectionVerificationDoc>(
      "SyndicationConnectionVerification",
      schema
    );
  }

  public get model(): ISyndicationConnectionVerificationModel {
    return this._model;
  }
}
