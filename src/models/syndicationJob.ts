import { Schema, model, Document, Model, Types } from "mongoose";

export type SyndicationJobEvent =
  | "property.created"
  | "property.updated"
  | "property.status_changed"
  | "property.unpublished";

export type SyndicationJobStatus = "pending" | "processing" | "sent" | "failed";

export interface ISyndicationJob {
  propertyId: Types.ObjectId;
  userId: Types.ObjectId;
  platformKey: string;
  eventType: SyndicationJobEvent;
  status: SyndicationJobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISyndicationJobDoc extends ISyndicationJob, Document {}
export type ISyndicationJobModel = Model<ISyndicationJobDoc>;

export class SyndicationJob {
  private _model: ISyndicationJobModel;

  constructor() {
    const schema = new Schema<ISyndicationJobDoc>(
      {
        propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        platformKey: { type: String, required: true, trim: true, lowercase: true, index: true },
        eventType: {
          type: String,
          enum: ["property.created", "property.updated", "property.status_changed", "property.unpublished"],
          required: true,
        },
        status: { type: String, enum: ["pending", "processing", "sent", "failed"], default: "pending", index: true },
        payload: { type: Schema.Types.Mixed, required: true },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        lastAttemptAt: { type: Date },
        sentAt: { type: Date },
        errorMessage: { type: String },
      },
      { timestamps: true }
    );

    schema.index({ status: 1, createdAt: 1 });

    this._model = model<ISyndicationJobDoc>("SyndicationJob", schema);
  }

  public get model(): ISyndicationJobModel {
    return this._model;
  }
}
