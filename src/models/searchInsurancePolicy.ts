import { Schema, model, Document, Model, Types } from "mongoose";
import type { SearchInsurancePolicyStatus } from "../common/constants/searchInsuranceCatalog";

export interface ISearchInsurancePolicy {
  preference: Types.ObjectId;
  buyer: Types.ObjectId;
  premiumAmount: number;
  coverAmount: number;
  partner: string;
  status: SearchInsurancePolicyStatus;
  transaction?: Types.ObjectId;
  paidAt?: Date;
  policyReference: string;
}

export interface ISearchInsurancePolicyDoc
  extends ISearchInsurancePolicy,
    Document {
  createdAt: Date;
  updatedAt: Date;
}

export type ISearchInsurancePolicyModel = Model<ISearchInsurancePolicyDoc>;

export class SearchInsurancePolicy {
  private searchInsurancePolicyModel: ISearchInsurancePolicyModel;

  constructor() {
    const schema = new Schema<ISearchInsurancePolicyDoc>(
      {
        preference: {
          type: Schema.Types.ObjectId,
          ref: "Preference",
          required: true,
          index: true,
        },
        buyer: {
          type: Schema.Types.ObjectId,
          ref: "Buyer",
          required: true,
          index: true,
        },
        premiumAmount: { type: Number, required: true },
        coverAmount: { type: Number, required: true },
        partner: { type: String, required: true },
        status: {
          type: String,
          enum: ["pending_payment", "active", "expired", "claimed"],
          default: "pending_payment",
          index: true,
        },
        transaction: { type: Schema.Types.ObjectId, ref: "newTransaction" },
        paidAt: { type: Date },
        policyReference: { type: String, required: true, unique: true },
      },
      { timestamps: true }
    );

    schema.index({ preference: 1, status: 1 });
    schema.index({ buyer: 1, createdAt: -1 });

    this.searchInsurancePolicyModel = model<ISearchInsurancePolicyDoc>(
      "SearchInsurancePolicy",
      schema
    );
  }

  public get model(): ISearchInsurancePolicyModel {
    return this.searchInsurancePolicyModel;
  }
}
