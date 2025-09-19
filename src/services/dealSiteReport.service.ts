import { Types } from "mongoose";
import { DB } from "../controllers";
import { IDealSiteReport } from "../models";

export type DealSiteReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";
export type ReportedByModel = "Buyer" | "User" | "Admin";

class DealSiteReportService {
  private model = DB.Models.DealSiteReport;

  /**
   * Create a new report
   */
  async createReport(
    dealSiteId: Types.ObjectId,
    reportedBy: Types.ObjectId,
    reportedByModel: ReportedByModel,
    reason: string,
    description?: string
  ) {
    return this.model.create({
      dealSite: dealSiteId,
      reportedBy,
      reportedByModel,
      reason,
      description,
      status: "pending",
    });
  }

  /**
   * Fetch a single report by ID
   */
  async getReportById(reportId: Types.ObjectId) {
    return this.model.findById(reportId).populate("dealSite reportedBy").exec();
  }

  /**
   * Fetch reports for a DealSite
   */
  async getReportsByDealSite(dealSiteId: Types.ObjectId) {
    return this.model.find({ dealSite: dealSiteId }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Fetch all reports (admin use)
   */
  async getAllReports(filter: Partial<IDealSiteReport> = {}) {
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }

  /**
   * Update report status
   */
  async updateStatus(reportId: Types.ObjectId, status: DealSiteReportStatus) {
    return this.model.findByIdAndUpdate(reportId, { status }, { new: true });
  }

  /**
   * Resolve report
   */
  async resolveReport(reportId: Types.ObjectId) {
    return this.updateStatus(reportId, "resolved");
  }

  /**
   * Dismiss report
   */
  async dismissReport(reportId: Types.ObjectId) {
    return this.updateStatus(reportId, "dismissed");
  }
}

export const dealSiteReportService = new DealSiteReportService();
