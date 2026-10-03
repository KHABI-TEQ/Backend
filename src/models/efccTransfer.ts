import { Schema, model, Document, Model, Types } from "mongoose";

export type EfccTransferDeliveryStatus = "pending" | "sent" | "failed";

export interface IEfccTransferAttachment {
  fileName: string;
  url: string;
}

export interface IEfccTransfer {
  caseId: Types.ObjectId;
  transferReference: string;
  officer: Types.ObjectId;
  efccEmail: string;
  emailSubject: string;
  documentsIncluded: string[];
  pdfUrl: string;
  pdfFileName: string;
  attachmentsSent: IEfccTransferAttachment[];
  deliveryStatus: EfccTransferDeliveryStatus;
  deliveryError?: string;
  sentAt?: Date;
  idempotencyKey: string;
}

export interface IEfccTransferDoc extends IEfccTransfer, Document {}
export type IEfccTransferModel = Model<IEfccTransferDoc>;

export class EfccTransfer {
  private _model: IEfccTransferModel;

  constructor() {
    const schema = new Schema<IEfccTransferDoc>(
      {
        caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
        transferReference: { type: String, required: true, unique: true, index: true },
        officer: { type: Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
        efccEmail: { type: String, required: true, lowercase: true, trim: true },
        emailSubject: { type: String, required: true },
        documentsIncluded: [{ type: String, required: true }],
        pdfUrl: { type: String, required: true },
        pdfFileName: { type: String, required: true },
        attachmentsSent: [
          {
            fileName: { type: String, required: true },
            url: { type: String, required: true },
          },
        ],
        deliveryStatus: {
          type: String,
          enum: ["pending", "sent", "failed"],
          default: "pending",
          index: true,
        },
        deliveryError: { type: String, required: false },
        sentAt: { type: Date, required: false },
        idempotencyKey: { type: String, required: true },
      },
      { timestamps: true }
    );

    schema.index({ caseId: 1, idempotencyKey: 1 }, { unique: true });

    this._model = model<IEfccTransferDoc>("EfccTransfer", schema);
  }

  public get model(): IEfccTransferModel {
    return this._model;
  }
}
