import { Schema, model, Document, Model, Types } from "mongoose";

export type ReportedByModel = "Buyer" | "User" | "Admin";
export type DealSiteReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export interface IDealSiteReport {
  dealSite: Types.ObjectId;
  reportedBy: Types.ObjectId;
  reportedByModel: ReportedByModel;
  reason: string;
  description?: string;
  status: DealSiteReportStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDealSiteReportDoc extends IDealSiteReport, Document {}
export type IDealSiteReportModel = Model<IDealSiteReportDoc>;

export class DealSiteReport {
  private dealSiteReportModel: IDealSiteReportModel;

  constructor() {
    const schema = new Schema<IDealSiteReportDoc>(
      {
        dealSite: { type: Schema.Types.ObjectId, ref: "DealSite", required: true },
        reportedBy: {
          type: Schema.Types.ObjectId,
          refPath: "reportedByModel",
          required: true,
        },
        reportedByModel: {
          type: String,
          enum: ["Buyer", "User", "Admin"],
          required: true,
        },
        reason: { type: String, required: true },
        description: { type: String },
        status: {
          type: String,
          enum: ["pending", "reviewed", "resolved", "dismissed"],
          default: "pending",
        },
      },
      { timestamps: true }
    );

    this.dealSiteReportModel = model<IDealSiteReportDoc>("DealSiteReport", schema);
  }

  public get model(): IDealSiteReportModel {
    return this.dealSiteReportModel;
  }
}
