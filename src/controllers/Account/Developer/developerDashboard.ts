import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  ensureDeveloperProfile,
  isDeveloperFullyVerified,
  verificationPublicView,
} from "../../../services/developerVerification.service";
import { getDeveloperPlanSnapshot } from "../../../services/developerPlanEntitlement.service";
import { listDeveloperProjects, projectCounts } from "../../../services/offPlanProject.service";

export const getDeveloperDashboardSummary = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    if ((req.user as { userType?: string }).userType !== "Developer") {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "This snapshot is for Developer accounts only.");
    }

    const oid = new Types.ObjectId(String(userId));
    const { user, profile } = await ensureDeveloperProfile(String(userId));
    const [plan, projects, properties, inspections, transactions, rtm, unread] = await Promise.all([
      getDeveloperPlanSnapshot(String(userId)),
      listDeveloperProjects(String(userId)),
      DB.Models.Property.find({
        owner: oid,
        isDeleted: { $ne: true },
        $or: [{ offPlanProjectId: { $exists: false } }, { offPlanProjectId: null }],
        propertyType: { $nin: ["off-plan"] },
      })
        .select("status isApproved isRejected")
        .lean(),
      DB.Models.InspectionBooking.find({ owner: oid }).select("status inspectionDate").lean().catch(() => []),
      DB.Models.NewTransaction.find({ "fromWho.item": oid })
        .select("status")
        .lean()
        .catch(() => []),
      DB.Models.RequestToMarket.find({ publisherId: oid }).select("status").lean().catch(() => []),
      DB.Models.Notification.countDocuments({
        $or: [{ user: oid }, { userId: oid }],
        isRead: { $ne: true },
      }).catch(() => 0),
    ]);

    const propertyCounts = {
      total: properties.length,
      active: properties.filter((p) => p.isApproved && p.status !== "draft").length,
      pendingReview: properties.filter((p) => !p.isApproved && p.status !== "draft" && !p.isRejected).length,
      drafts: properties.filter((p) => p.status === "draft").length,
      requiresAttention: properties.filter((p) => p.isRejected || p.status === "rejected").length,
    };

    const insp = Array.isArray(inspections) ? inspections : [];
    const now = Date.now();
    const inspectionCounts = {
      pending: insp.filter((i: any) => String(i.status || "").includes("pending")).length,
      upcoming: insp.filter(
        (i: any) =>
          i.inspectionDate &&
          new Date(i.inspectionDate).getTime() > now &&
          !["completed", "cancelled"].includes(String(i.status))
      ).length,
      completed: insp.filter((i: any) => i.status === "completed").length,
      cancelled: insp.filter((i: any) => String(i.status || "").includes("cancelled")).length,
    };

    const tx = Array.isArray(transactions) ? transactions : [];
    const transactionCounts = {
      active: tx.filter((t: any) => t.status === "success").length,
      pending: tx.filter((t: any) => t.status === "pending").length,
      completed: tx.filter((t: any) => t.status === "success").length,
    };

    const requests = Array.isArray(rtm) ? rtm : [];
    const distribution = {
      connected: requests.filter((r: any) => r.status === "accepted" || r.status === "approved").length,
      pending: requests.filter((r: any) => r.status === "pending").length,
      active: requests.filter((r: any) => r.status === "accepted" || r.status === "approved").length,
    };

    const verification = verificationPublicView(profile, user);
    const fullyVerified = isDeveloperFullyVerified(profile);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        verification,
        isVerifiedDeveloper: fullyVerified,
        canSubmitOffPlan: fullyVerified && plan.allowsOffPlan,
        properties: propertyCounts,
        projects: projectCounts(projects),
        inspections: inspectionCounts,
        transactions: transactionCounts,
        distribution,
        unreadNotifications: unread,
        plan,
        profile: verification.profile,
      },
    });
  } catch (err) {
    next(err);
  }
};
