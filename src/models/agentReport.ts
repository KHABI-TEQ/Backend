import { Schema, model, Document, Model, Types } from "mongoose";

export type AgentReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export type AgentReportCategory =
  | "unprofessional_conduct"
  | "property_misrepresentation"
  | "no_show_or_late"
  | "payment_issue"
  | "safety_concern"
  | "communication_issue"
  | "other";

export interface IAgentReport {
  inspectionId: Types.ObjectId;
  reportedBy: Types.ObjectId;
  reportedByModel: "Buyer" | "User";
  reportedAgentId: Types.ObjectId;
  category: AgentReportCategory;
  subject?: string;
  description: string;
  status: AgentReportStatus;
  adminNotes?: string;
}

export interface IAgentReportDoc extends IAgentReport, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type IAgentReportModel = Model<IAgentReportDoc>;

const CATEGORY_ENUM: AgentReportCategory[] = [
  "unprofessional_conduct",
  "property_misrepresentation",
  "no_show_or_late",
  "payment_issue",
  "safety_concern",
  "communication_issue",
  "other",
];

export class AgentReport {
  private agentReportModel: IAgentReportModel;

  constructor() {
    const schema = new Schema<IAgentReportDoc>(
      {
        inspectionId: {
          type: Schema.Types.ObjectId,
          ref: "InspectionBooking",
          required: true,
        },
        reportedBy: {
          type: Schema.Types.ObjectId,
          refPath: "reportedByModel",
          required: true,
        },
        reportedByModel: {
          type: String,
          enum: ["Buyer", "User"],
          required: true,
        },
        reportedAgentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        category: {
          type: String,
          enum: CATEGORY_ENUM,
          required: true,
        },
        subject: { type: String },
        description: { type: String, required: true },
        status: {
          type: String,
          enum: ["pending", "reviewed", "resolved", "dismissed"],
          default: "pending",
        },
        adminNotes: { type: String },
      },
      { timestamps: true }
    );

    schema.index({ reportedAgentId: 1 });
    schema.index({ inspectionId: 1 });
    schema.index({ reportedBy: 1 });
    schema.index({ status: 1 });

    this.agentReportModel = model<IAgentReportDoc>("AgentReport", schema);
  }

  public get model(): IAgentReportModel {
    return this.agentReportModel;
  }
}
