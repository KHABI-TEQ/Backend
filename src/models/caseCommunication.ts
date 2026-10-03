import { Schema, model, Document, Model, Types } from "mongoose";

export type CaseCommunicationDirection = "outbound" | "inbound";
export type CaseCommunicationType = "information_request" | "buyer_response";
export type CaseCommunicationDeliveryStatus = "sent" | "failed";
export type CaseCommunicationResponseStatus = "awaiting" | "responded" | "not_required";

export interface ICaseCommunication {
  caseId: Types.ObjectId;
  direction: CaseCommunicationDirection;
  type: CaseCommunicationType;
  officer?: Types.ObjectId;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  message: string;
  sentAt: Date;
  deliveryStatus: CaseCommunicationDeliveryStatus;
  deliveryError?: string;
  providerMessageId?: string;
  responseStatus: CaseCommunicationResponseStatus;
  respondedAt?: Date;
  parentId?: Types.ObjectId;
}

export interface ICaseCommunicationDoc extends ICaseCommunication, Document {}
export type ICaseCommunicationModel = Model<ICaseCommunicationDoc>;

export class CaseCommunication {
  private _model: ICaseCommunicationModel;

  constructor() {
    const schema = new Schema<ICaseCommunicationDoc>(
      {
        caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
        direction: {
          type: String,
          enum: ["outbound", "inbound"],
          required: true,
        },
        type: {
          type: String,
          enum: ["information_request", "buyer_response"],
          required: true,
        },
        officer: { type: Schema.Types.ObjectId, ref: "Admin", required: false, index: true },
        recipientEmail: { type: String, required: true, lowercase: true, trim: true },
        recipientName: { type: String, required: true },
        subject: { type: String, required: true },
        message: { type: String, required: true },
        sentAt: { type: Date, default: Date.now },
        deliveryStatus: {
          type: String,
          enum: ["sent", "failed"],
          default: "sent",
        },
        deliveryError: { type: String, required: false },
        providerMessageId: { type: String, required: false },
        responseStatus: {
          type: String,
          enum: ["awaiting", "responded", "not_required"],
          default: "not_required",
          index: true,
        },
        respondedAt: { type: Date, required: false },
        parentId: { type: Schema.Types.ObjectId, ref: "CaseCommunication", required: false, index: true },
      },
      { timestamps: true }
    );

    schema.index({ caseId: 1, createdAt: -1 });

    this._model = model<ICaseCommunicationDoc>("CaseCommunication", schema);
  }

  public get model(): ICaseCommunicationModel {
    return this._model;
  }
}
