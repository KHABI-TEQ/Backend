import { Schema, model, Document, Model } from "mongoose";

export type WebhookEventStatus = "received" | "processed" | "failed";

export interface IWebhookEvent {
  platformKey: string;
  eventId?: string;
  eventType?: string;
  status: WebhookEventStatus;
  headers?: Record<string, unknown>;
  payload: Record<string, unknown>;
  processedAt?: Date;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IWebhookEventDoc extends IWebhookEvent, Document {}
export type IWebhookEventModel = Model<IWebhookEventDoc>;

export class WebhookEvent {
  private _model: IWebhookEventModel;

  constructor() {
    const schema = new Schema<IWebhookEventDoc>(
      {
        platformKey: { type: String, required: true, trim: true, lowercase: true, index: true },
        eventId: { type: String, index: true },
        eventType: { type: String },
        status: { type: String, enum: ["received", "processed", "failed"], default: "received" },
        headers: { type: Schema.Types.Mixed },
        payload: { type: Schema.Types.Mixed, required: true },
        processedAt: { type: Date },
        errorMessage: { type: String },
      },
      { timestamps: true }
    );

    schema.index({ platformKey: 1, eventId: 1 }, { unique: true, sparse: true });

    this._model = model<IWebhookEventDoc>("WebhookEvent", schema);
  }

  public get model(): IWebhookEventModel {
    return this._model;
  }
}
