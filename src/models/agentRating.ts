import { Schema, model, Document, Model, Types } from "mongoose";

export interface IAgentRating {
  inspectionId: Types.ObjectId;
  buyerId: Types.ObjectId;
  agentId: Types.ObjectId;
  rating: number;
  comment?: string;
}

export interface IAgentRatingDoc extends IAgentRating, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type IAgentRatingModel = Model<IAgentRatingDoc>;

export class AgentRating {
  private agentRatingModel: IAgentRatingModel;

  constructor() {
    const schema = new Schema<IAgentRatingDoc>(
      {
        inspectionId: {
          type: Schema.Types.ObjectId,
          ref: "InspectionBooking",
          required: true,
          unique: true,
        },
        buyerId: { type: Schema.Types.ObjectId, ref: "Buyer", required: true },
        agentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, default: "" },
      },
      { timestamps: true }
    );

    schema.index({ agentId: 1 });
    schema.index({ buyerId: 1 });

    this.agentRatingModel = model<IAgentRatingDoc>("AgentRating", schema);
  }

  public get model(): IAgentRatingModel {
    return this.agentRatingModel;
  }
}
