import { Schema, model, Document, Model, Types } from "mongoose";

export type RequestToMarketStatus = "pending" | "accepted" | "rejected";

export interface IRequestToMarket {
  propertyId: Types.ObjectId;
  requestedByAgentId: Types.ObjectId;
  publisherId: Types.ObjectId;
  publisherType: "Landowners" | "Developer";
  status: RequestToMarketStatus;
  /** Agent commission amount in Naira (from property.agentCommissionAmount when request was created). */
  agentCommissionAmount: number;
  /** Paystack transaction for agent commission (Publisher pays Agent). */
  paymentTransactionId?: Types.ObjectId;
  /** Set when Publisher rejects. */
  rejectedReason?: string;
  /** Set when Publisher accepts (for audit). */
  acceptedAt?: Date;
  rejectedAt?: Date;
  /** Actual sale price in Naira, set when Publisher registers the sale (register-sale endpoint). */
  actualSalePriceNaira?: number;
  /** Commission percentage (1–5). Landlord: 5; Developer: 1–5. Used to compute agent commission from actualSalePriceNaira. */
  commissionPercent?: number;
  /** When the Publisher registered the sale (actual price + commission %). */
  saleRegisteredAt?: Date;
}

export interface IRequestToMarketDoc extends IRequestToMarket, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type IRequestToMarketModel = Model<IRequestToMarketDoc>;

const schema = new Schema<IRequestToMarketDoc>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    requestedByAgentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publisherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publisherType: { type: String, enum: ["Landowners", "Developer"], required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      required: true,
    },
    agentCommissionAmount: { type: Number, required: true },
    paymentTransactionId: { type: Schema.Types.ObjectId, ref: "newTransaction" },
    rejectedReason: { type: String },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
    actualSalePriceNaira: { type: Number },
    commissionPercent: { type: Number },
    saleRegisteredAt: { type: Date },
  },
  { timestamps: true }
);

schema.index({ propertyId: 1, requestedByAgentId: 1 }, { unique: true });
schema.index({ publisherId: 1, status: 1 });
schema.index({ requestedByAgentId: 1, status: 1 });

export class RequestToMarketModel {
  private _model: IRequestToMarketModel;

  constructor() {
    this._model = model<IRequestToMarketDoc>("RequestToMarket", schema);
  }

  public get model(): IRequestToMarketModel {
    return this._model;
  }
}
