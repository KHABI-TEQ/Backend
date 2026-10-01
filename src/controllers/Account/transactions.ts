import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { RouteError } from "../../common/classes";
import { getLawyerPlatformChargePercent, getSurveyorPlatformChargePercent } from "../../services/professionalFee.service";
import {
  AGENT_FEE_CATEGORIES,
  AGENT_FEE_TABLE_COLUMNS,
  agentFeeTabLabel,
  listAgentFeeRows,
  type AgentFeeCategory,
} from "../../services/agentFeeLedger.service";

export const fetchUserTransactions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;

    const { page = 1, limit = 10, transactionType } = req.query;

    // Filter to only fetch the user's transactions with allowed statuses
    const filter: any = {
      "fromWho.kind": "User",
      "fromWho.item": userId,
      status: { $in: ["failed", "success", "cancelled"] },
    };

    if (transactionType) {
      filter.transactionType = transactionType;
    }

    const transactions = await DB.Models.NewTransaction.find(filter)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.NewTransaction.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};



/**
 * My Transactions tabs: inspection fee, commission fee, and property sales price.
 * GET /account/transactions/fees?category=inspection_fee|commission_fee|property_sales_price_fee
 */
export const fetchAgentFeeLedger = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const requested = String(req.query.category || "inspection_fee");
    const category = (AGENT_FEE_CATEGORIES as readonly string[]).includes(requested)
      ? (requested as AgentFeeCategory)
      : null;
    if (!category) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "category must be inspection_fee, commission_fee, or property_sales_price_fee"
      );
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const rows = await listAgentFeeRows(String(userId), category);
    const start = (page - 1) * limit;
    const tableTitle = agentFeeTabLabel(category);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        title: "My Transactions",
        subtitle: "Manage your briefs and track your real estate performance",
        category,
        tableTitle,
        selectable: true,
        tabs: AGENT_FEE_CATEGORIES.map((key) => ({
          key,
          label: agentFeeTabLabel(key),
          active: key === category,
        })),
        columns: AGENT_FEE_TABLE_COLUMNS,
        rows: rows.slice(start, start + limit),
      },
      pagination: {
        total: rows.length,
        page,
        limit,
        totalPages: Math.ceil(rows.length / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch details of a single transaction for the authenticated user
 */
export const getUserTransactionDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactionId } = req.params;

    // Allowed statuses
    const allowedStatuses = ["success", "failed", "cancelled"];

    const transaction = await DB.Models.NewTransaction.findOne({
      _id: transactionId,
      "fromWho.item": req.user._id,
      "fromWho.kind": "User",
      status: { $in: allowedStatuses },
    })
      .populate("fromWho.item", "firstName lastName email")
      .lean();

    if (!transaction) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Transaction not found or not accessible")
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};

/** Role-aware activity and money summary for practitioners and publishers. */
export const fetchTransactionActivity = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    const userType = String((req.user as any)?.userType || "");
    const id = userId;
    const activity: any[] = [];
    const add = (row: any) => activity.push(row);
    const asId = (value: any) => String(value?._id || value || "");

    const payments = await DB.Models.NewTransaction.find({
      "fromWho.kind": "User", "fromWho.item": id, status: { $in: ["pending", "success", "failed", "cancelled"] },
    }).sort({ createdAt: -1 }).limit(100).lean();
    for (const tx of payments) add({
      id: `payment:${tx._id}`, kind: "payment", title: tx.transactionType || "Account payment",
      reference: tx.reference, status: tx.status, occurredAt: tx.createdAt,
      amount: Number(tx.amount || 0), direction: "outgoing",
    });

    let summary: Record<string, number> = { confirmedRevenue: 0, pendingRevenue: 0, commissionOwed: 0, transactionValue: 0 };
    if (["Lawyer", "Surveyor", "Valuer"].includes(userType)) {
      const category = userType.toLowerCase();
      const legacyPlatformPercent = userType === "Lawyer"
        ? await getLawyerPlatformChargePercent()
        : userType === "Surveyor"
          ? await getSurveyorPlatformChargePercent()
          : 0;
      const requests = await DB.Models.ProfessionalServiceRequest.find({
        $or: [{ professionalId: id }, { "offers.professionalId": id }],
      }).sort({ updatedAt: -1 }).limit(200).lean();
      const seen = new Set<string>();
      for (const job of requests) {
        const offer = (job.offers || []).find((item: any) => asId(item.professionalId) === asId(id));
        const assigned = asId(job.professionalId) === asId(id);
        if (!assigned && !offer) continue;
        seen.add(`${job.fulfillment}:${job.linkedDocumentVerificationId || job.linkedSurveyRequestId || job._id}`);
        const isPaid = Number(job.amountPaid || 0) > 0 || ["in-progress", "delivered", "completed"].includes(job.status);
        const fee = Number(assigned ? job.professionalFee : offer?.professionalFee || 0);
        if (isPaid) summary.confirmedRevenue += fee;
        else if (job.status === "awaiting-payment" || job.status === "awaiting-acceptance") summary.pendingRevenue += fee;
        add({
          id: `service:${job._id}`, kind: "professional-service", title: job.serviceName || `${category} service`,
          reference: job.reference, status: job.status, occurredAt: job.updatedAt || job.createdAt,
          amount: fee, grossAmount: Number(job.customerPrice || offer?.customerPrice || 0),
          platformFee: Number(job.platformFee || offer?.platformFee || 0), direction: "earning",
          propertyId: job.propertyId, inspectionId: job.inspectionId,
        });
      }
      if (userType === "Lawyer") {
        const jobs = await DB.Models.DocumentVerification.find({ lawyerId: id }).sort({ updatedAt: -1 }).limit(100).lean();
        for (const job of jobs) {
          if (seen.has(`document-verification:${job._id}`)) continue;
          const gross = Number(job.amountPaid || 0);
          const platformFee = Math.round(gross * legacyPlatformPercent / 100);
          const fee = Math.max(0, gross - platformFee);
          const paid = gross > 0 && ["payment-approved", "in-progress", "registered", "unregistered"].includes(String(job.status));
          if (paid) summary.confirmedRevenue += fee;
          else if (gross > 0 || ["awaiting-payment", "awaiting-acceptance"].includes(String(job.status))) summary.pendingRevenue += fee;
          add({ id: `lawyer-job:${job._id}`, kind: "professional-service", title: `Document verification · ${job.docType}`,
            reference: job.docCode, status: job.status, occurredAt: (job as any).updatedAt || (job as any).createdAt,
            amount: fee, grossAmount: gross, platformFee, direction: "earning", propertyId: job.propertyId, inspectionId: job.inspectionId });
        }
      }
      if (userType === "Surveyor") {
        const jobs = await DB.Models.SurveyRequest.find({ surveyorId: id }).sort({ updatedAt: -1 }).limit(100).lean();
        for (const job of jobs) {
          if (seen.has(`survey-request:${job._id}`)) continue;
          const gross = Number(job.amountPaid || 0);
          const platformFee = Math.round(gross * legacyPlatformPercent / 100);
          const fee = Math.max(0, gross - platformFee);
          const paid = gross > 0 && ["payment-approved", "in-progress", "completed"].includes(String(job.status));
          if (paid) summary.confirmedRevenue += fee;
          else if (gross > 0 || ["awaiting-payment", "awaiting-acceptance"].includes(String(job.status))) summary.pendingRevenue += fee;
          add({ id: `surveyor-job:${job._id}`, kind: "professional-service", title: job.serviceType === "site-survey" ? "Site survey" : "Survey plan verification",
            reference: String(job._id).slice(-8).toUpperCase(), status: job.status, occurredAt: job.updatedAt || job.createdAt,
            amount: fee, grossAmount: gross, platformFee, direction: "earning", propertyId: job.propertyId, inspectionId: job.inspectionId });
        }
      }
    }

    if (["Agent", "Developer"].includes(userType)) {
      const isAgent = userType === "Agent";
      const requests = await DB.Models.RequestToMarket.find(isAgent ? { requestedByAgentId: id } : { publisherId: id })
        .populate("propertyId", "propertyCode propertyType propertyCategory price location")
        .sort({ updatedAt: -1 }).limit(200).lean();
      for (const request of requests) {
        const registered = Number(request.actualSalePriceNaira || 0) > 0;
        const commission = registered
          ? Math.round(Number(request.actualSalePriceNaira) * Number(request.commissionPercent ?? request.agentCommissionPercent ?? 0) / 100)
          : Number(request.agentCommissionAmount || 0);
        if (registered && isAgent) {
          if (request.receiptVerificationStatus === "verified") summary.confirmedRevenue += commission;
          else summary.pendingRevenue += commission;
        }
        if (registered && !isAgent) {
          summary.commissionOwed += commission;
        }
        const prop: any = request.propertyId || {};
        add({ id: `mandate:${request._id}`, kind: "property-transaction", title: prop.propertyCode || prop.propertyType || "Property mandate",
          reference: String(request._id).slice(-8).toUpperCase(), status: registered ? (request.receiptVerificationStatus || "sale-registered") : request.status,
          occurredAt: request.saleRegisteredAt || request.acceptedAt || request.updatedAt || request.createdAt,
          amount: isAgent ? (registered ? commission : Number(request.agentCommissionAmount || 0)) : Number(request.actualSalePriceNaira || 0),
          commissionAmount: commission, actualSalePrice: Number(request.actualSalePriceNaira || 0),
          direction: isAgent ? "earning" : "commission", propertyId: prop._id, propertyCode: prop.propertyCode,
          commissionStatus: request.receiptVerificationStatus || (registered ? "awaiting-proof" : "not-registered") });
      }

      const ownProperties = await DB.Models.Property.find({ owner: id, isDeleted: { $ne: true } }).select("_id propertyCode").lean();
      const propertyIds = ownProperties.map((property: any) => property._id);
      const agentProfile = isAgent ? await DB.Models.Agent.findOne({ userId: id }).select("_id").lean() : null;
      const registrationFilter: Record<string, any> = {};
      const registrationOr: Record<string, any>[] = [];
      if (propertyIds.length) registrationOr.push({ propertyId: { $in: propertyIds } });
      if (agentProfile?._id) registrationOr.push({ agentId: agentProfile._id });
      if (registrationOr.length) registrationFilter.$or = registrationOr;
      const inspectionFilter = isAgent
        ? { $or: [{ owner: id }, { assignedFieldAgent: id }, { fieldAgentRequestTargetId: id }, { fieldAgentRequestedBy: id }] }
        : { owner: id };
      const [inspections, registrations] = await Promise.all([
        DB.Models.InspectionBooking.find(inspectionFilter).sort({ updatedAt: -1 }).limit(100).lean().catch(() => []),
        registrationOr.length ? DB.Models.TransactionRegistration.find(registrationFilter).sort({ updatedAt: -1 }).limit(100).lean().catch(() => []) : Promise.resolve([]),
      ]);
      const inspectionTransactions = isAgent
        ? await DB.Models.NewTransaction.find({
            _id: { $in: (inspections as any[]).map((row) => row.transaction).filter(Boolean) },
            status: "success",
          }).select("_id").lean().catch(() => [])
        : [];
      const settledInspectionIds = new Set((inspectionTransactions as any[]).map((tx) => asId(tx._id)));
      for (const inspection of inspections as any[]) add({
        id: `inspection:${inspection._id}`, kind: "inspection", title: "Property inspection",
        reference: String(inspection._id).slice(-8).toUpperCase(), status: inspection.status,
        occurredAt: inspection.inspectionDate || inspection.updatedAt || inspection.createdAt,
        amount: isAgent ? Number(inspection.inspectionFeeSplit?.licensedAgentNaira || 0) : 0,
        direction: isAgent ? "earning" : "activity",
        propertyId: inspection.propertyId, inspectionId: inspection._id,
      });
      if (isAgent) {
        for (const inspection of inspections as any[]) {
          const fee = Number(inspection.inspectionFeeSplit?.licensedAgentNaira || 0);
          if (fee > 0 && inspection.transaction && settledInspectionIds.has(asId(inspection.transaction))) {
            summary.confirmedRevenue += fee;
          }
        }
      }
      for (const registration of registrations as any[]) {
        if (registration.status !== "rejected") summary.transactionValue += Number(registration.transactionValue || 0);
        add({ id: `registration:${registration._id}`, kind: "registered-transaction", title: "Transaction registration",
          reference: registration.transactionReference || registration.reference, status: registration.status,
          occurredAt: registration.updatedAt || registration.createdAt, amount: Number(registration.transactionValue || 0),
          direction: "transaction", propertyId: registration.propertyId });
      }
    }

    activity.sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime());
    return res.status(HttpStatusCodes.OK).json({ success: true, data: { role: userType, summary, activity } });
  } catch (err) {
    next(err);
  }
};


