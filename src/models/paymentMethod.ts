import { Schema, model, Document, Model, Types } from "mongoose";

export type PaymentMethodType = "card" | "bank";

export interface IPaymentMethod {
  user: Types.ObjectId;
  type: PaymentMethodType; // e.g., card
  authorizationCode: string; // from Paystack
  last4: string; // last 4 digits of card
  expMonth: string;
  expYear: string;
  bank?: string; // optional (if bank account)
  brand?: string; // e.g., VISA, MasterCard
  reusable: boolean; // true if Paystack says reusable
  customerCode: string; // Paystack customer_code
  isDefault?: boolean; // mark primary method
}

export interface IPaymentMethodDoc extends IPaymentMethod, Document {}

export type IPaymentMethodModel = Model<IPaymentMethodDoc>;

export class PaymentMethod {
  private paymentMethodModel: IPaymentMethodModel;

  constructor() {
    const schema = new Schema<IPaymentMethodDoc>(
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        type: {
          type: String,
          enum: ["card", "bank"],
          required: true,
        },
        authorizationCode: {
          type: String,
          required: true,
        },
        last4: {
          type: String,
          required: true,
        },
        expMonth: {
          type: String,
          required: true,
        },
        expYear: {
          type: String,
          required: true,
        },
        bank: String,
        brand: String,
        reusable: {
          type: Boolean,
          default: true,
        },
        customerCode: {
          type: String,
          required: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
      { timestamps: true }
    );

    this.paymentMethodModel = model<IPaymentMethodDoc>(
      "PaymentMethod",
      schema
    );
  }

  public get model(): IPaymentMethodModel {
    return this.paymentMethodModel;
  }
}
