import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import {
  SEARCH_INSURANCE_CATALOG,
  generateSearchInsurancePolicyReference,
  type SearchInsuranceClaimStatus,
} from "../common/constants/searchInsuranceCatalog";
import { PaystackService } from "./paystack.service";
import { notifyAllActiveAdmins } from "./adminNotification.service";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import {
  searchInsuranceActivatedMail,
  searchInsuranceClaimDecisionMail,
  searchInsuranceClaimReceivedMail,
} from "../common/emailTemplates/searchInsuranceMails";
import { AppRequest } from "../types/express";

const OPEN_CLAIM_STATUSES: SearchInsuranceClaimStatus[] = [
  "submitted",
  "under_review",
];

export async function resolveBuyerFromAuthHeader(req: AppRequest) {
  const rawAuthHeader = req.headers.authorization || req.headers.Authorization;
  if (!rawAuthHeader || typeof rawAuthHeader !== "string") return null;
  const token = rawAuthHeader.split(" ")[1];
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    if (decoded.role !== "buyer" && decoded.userType !== "Buyer") return null;
    return await DB.Models.Buyer.findById(decoded.id);
  } catch {
    return null;
  }
}

export async function stampPreferenceInsuranceOptIn(
  preferenceId: string | Types.ObjectId,
  optedIn: boolean
) {
  if (!optedIn) return;
  await DB.Models.Preference.findByIdAndUpdate(preferenceId, {
    $set: {
      "searchInsurance.optedIn": true,
      "searchInsurance.status": "pending_payment",
    },
  });
}

export async function checkoutSearchInsurance(input: {
  buyerId: string;
  buyerEmail: string;
  preferenceId: string;
}) {
  if (!mongoose.isValidObjectId(input.preferenceId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference ID");
  }

  const preference = await DB.Models.Preference.findById(input.preferenceId);
  if (!preference) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
  }
  if (String(preference.buyer) !== String(input.buyerId)) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "This search does not belong to your account."
    );
  }

  const existingActive = await DB.Models.SearchInsurancePolicy.findOne({
    preference: preference._id,
    status: { $in: ["active", "claimed"] },
  });
  if (existingActive) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      "This search is already insured."
    );
  }

  let policy = await DB.Models.SearchInsurancePolicy.findOne({
    preference: preference._id,
    status: "pending_payment",
  });
  if (!policy) {
    policy = await DB.Models.SearchInsurancePolicy.create({
      preference: preference._id,
      buyer: input.buyerId,
      premiumAmount: SEARCH_INSURANCE_CATALOG.premiumAmount,
      coverAmount: SEARCH_INSURANCE_CATALOG.coverAmount,
      partner: SEARCH_INSURANCE_CATALOG.partner,
      status: "pending_payment",
      policyReference: generateSearchInsurancePolicyReference(),
    });
  }

  await DB.Models.Preference.findByIdAndUpdate(preference._id, {
    $set: {
      "searchInsurance.optedIn": true,
      "searchInsurance.status": "pending_payment",
      "searchInsurance.policyId": policy._id,
    },
  });

  const payment = await PaystackService.initializePayment({
    email: input.buyerEmail,
    amount: SEARCH_INSURANCE_CATALOG.premiumAmount,
    fromWho: { kind: "Buyer", item: new Types.ObjectId(input.buyerId) },
    transactionType: "search-insurance",
    metadata: {
      preferenceId: String(preference._id),
      policyId: String(policy._id),
      coverAmount: SEARCH_INSURANCE_CATALOG.coverAmount,
      partner: SEARCH_INSURANCE_CATALOG.partner,
    },
  });

  await DB.Models.SearchInsurancePolicy.findByIdAndUpdate(policy._id, {
    $set: { transaction: payment.transactionId },
  });

  return {
    policyId: policy._id,
    policyReference: policy.policyReference,
    paymentUrl: payment.authorization_url,
    reference: payment.reference,
  };
}

export async function activateSearchInsuranceFromPayment(tx: {
  _id: Types.ObjectId;
  meta?: Record<string, any>;
  amount?: number;
}): Promise<null> {
  const policyId = tx.meta?.policyId;
  const preferenceId = tx.meta?.preferenceId;
  if (!policyId && !preferenceId) return null;

  const policy = policyId
    ? await DB.Models.SearchInsurancePolicy.findById(policyId)
    : await DB.Models.SearchInsurancePolicy.findOne({
        preference: preferenceId,
        status: "pending_payment",
      });
  if (!policy) return null;

  policy.status = "active";
  policy.paidAt = new Date();
  policy.transaction = tx._id;
  await policy.save();

  await DB.Models.Preference.findByIdAndUpdate(policy.preference, {
    $set: {
      "searchInsurance.optedIn": true,
      "searchInsurance.status": "active",
      "searchInsurance.policyId": policy._id,
    },
  });

  const buyer = await DB.Models.Buyer.findById(policy.buyer)
    .select("fullName email")
    .lean();
  if (buyer?.email) {
    const html = generalEmailLayout(
      searchInsuranceActivatedMail({
        fullName: String((buyer as any).fullName || ""),
        policyReference: policy.policyReference,
        preferenceId: String(policy.preference),
        coverAmount: policy.coverAmount,
        premiumAmount: policy.premiumAmount,
      })
    );
    void sendEmail({
      to: buyer.email,
      subject: "Your property search is insured",
      text: html,
      html,
    });
  }

  void notifyAllActiveAdmins({
    type: "search_insurance_paid",
    title: "Search insurance paid",
    message: `${buyer?.email || "A buyer"} insured a search (${policy.policyReference}).`,
    meta: {
      policyId: String(policy._id),
      preferenceId: String(policy.preference),
      amount: tx.amount,
    },
  });

  return null;
}

export async function listBuyerSearchInsurance(buyerId: string) {
  const [policies, claims] = await Promise.all([
    DB.Models.SearchInsurancePolicy.find({ buyer: buyerId })
      .sort({ createdAt: -1 })
      .populate("preference", "preferenceType preferenceMode status location budget createdAt searchInsurance")
      .lean(),
    DB.Models.SearchInsuranceClaim.find({ buyer: buyerId })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return { policies, claims };
}

export async function fileSearchInsuranceClaim(input: {
  buyerId: string;
  policyId: string;
  description: string;
  practitionerName?: string;
  practitionerUser?: string;
  evidence: Array<{ url: string; publicId?: string; kind?: string; name?: string }>;
}) {
  if (!mongoose.isValidObjectId(input.policyId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid policy ID");
  }
  const description = String(input.description || "").trim();
  if (description.length < 20) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Please describe what happened in at least 20 characters."
    );
  }
  const evidence = (input.evidence || []).filter((item) => item?.url);
  if (!evidence.length) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Upload at least one piece of evidence."
    );
  }

  const policy = await DB.Models.SearchInsurancePolicy.findById(input.policyId);
  if (!policy) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Policy not found");
  }
  if (String(policy.buyer) !== String(input.buyerId)) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "This policy is not yours.");
  }
  if (policy.status !== "active") {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Claims can only be filed against an active insured search."
    );
  }

  const preferenceId = String(policy.preference || "");
  const journey = await DB.Models.InspectionBooking.find({
    bookedBy: input.buyerId,
    dueDiligencePath: "platform",
    $or: [
      { "meta.preferenceId": preferenceId },
      { "meta.requestSource.preferenceId": preferenceId },
    ],
  })
    .select("_id dueDiligencePath")
    .lean();
  const { hasKhabiteqProfessionalEngagement } = await import(
    "../utils/seekerTransactionGate"
  );
  const platformWithProfessional = await (async () => {
    for (const booking of journey) {
      if (
        await hasKhabiteqProfessionalEngagement(
          input.buyerId,
          String(booking._id)
        )
      ) {
        return true;
      }
    }
    return false;
  })();
  if (!platformWithProfessional) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Claims are only available when this insured search includes due diligence with a Khabiteq professional. An external declaration does not qualify."
    );
  }

  const openClaim = await DB.Models.SearchInsuranceClaim.findOne({
    policy: policy._id,
    status: { $in: OPEN_CLAIM_STATUSES },
  });
  if (openClaim) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      "You already have an open claim on this search."
    );
  }

  const claim = await DB.Models.SearchInsuranceClaim.create({
    policy: policy._id,
    preference: policy.preference,
    buyer: input.buyerId,
    practitionerName: input.practitionerName?.trim() || undefined,
    practitionerUser:
      input.practitionerUser && mongoose.isValidObjectId(input.practitionerUser)
        ? input.practitionerUser
        : undefined,
    description,
    evidence: evidence.map((item) => ({
      url: item.url,
      publicId: item.publicId,
      kind: ["image", "document", "other"].includes(String(item.kind))
        ? item.kind
        : "other",
      name: item.name,
    })),
    status: "submitted",
  });

  const buyer = await DB.Models.Buyer.findById(input.buyerId)
    .select("fullName email")
    .lean();
  if (buyer?.email) {
    const html = generalEmailLayout(
      searchInsuranceClaimReceivedMail({
        fullName: String((buyer as any).fullName || ""),
        policyReference: policy.policyReference,
        claimId: String(claim._id),
      })
    );
    void sendEmail({
      to: buyer.email,
      subject: "Search insurance claim received",
      text: html,
      html,
    });
  }

  void notifyAllActiveAdmins({
    type: "search_insurance_claim_submitted",
    title: "Search insurance claim submitted",
    message: `${buyer?.email || "A buyer"} filed a claim on ${policy.policyReference}.`,
    meta: {
      claimId: String(claim._id),
      policyId: String(policy._id),
      preferenceId: String(policy.preference),
    },
  });

  return claim;
}

export async function getBuyerClaim(buyerId: string, claimId: string) {
  if (!mongoose.isValidObjectId(claimId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid claim ID");
  }
  const claim = await DB.Models.SearchInsuranceClaim.findOne({
    _id: claimId,
    buyer: buyerId,
  })
    .populate("policy")
    .populate("preference", "preferenceType status location createdAt")
    .lean();
  if (!claim) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Claim not found");
  }
  return claim;
}

export async function adminListPolicies(query: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    DB.Models.SearchInsurancePolicy.find(filter)
      .populate("buyer", "fullName email phoneNumber")
      .populate("preference", "preferenceType status location createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DB.Models.SearchInsurancePolicy.countDocuments(filter),
  ]);
  return {
    data: rows,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function adminListClaims(query: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    DB.Models.SearchInsuranceClaim.find(filter)
      .populate("buyer", "fullName email phoneNumber")
      .populate("policy")
      .populate("preference", "preferenceType status location createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DB.Models.SearchInsuranceClaim.countDocuments(filter),
  ]);
  return {
    data: rows,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function adminGetClaim(claimId: string) {
  if (!mongoose.isValidObjectId(claimId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid claim ID");
  }
  const claim = await DB.Models.SearchInsuranceClaim.findById(claimId)
    .populate("buyer", "fullName email phoneNumber")
    .populate("policy")
    .populate("preference")
    .populate("practitionerUser", "firstName lastName fullName email")
    .lean();
  if (!claim) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Claim not found");
  }
  return claim;
}

export async function adminUpdateClaim(input: {
  claimId: string;
  adminId?: string;
  status?: SearchInsuranceClaimStatus;
  adminNotes?: string;
  approvedAmount?: number;
}) {
  const claim = await DB.Models.SearchInsuranceClaim.findById(input.claimId);
  if (!claim) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Claim not found");
  }

  const allowed: SearchInsuranceClaimStatus[] = [
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "paid",
  ];
  if (input.status && !allowed.includes(input.status)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid claim status");
  }

  const policy = await DB.Models.SearchInsurancePolicy.findById(claim.policy);
  if (input.approvedAmount != null) {
    const amount = Number(input.approvedAmount);
    const cap = policy?.coverAmount || SEARCH_INSURANCE_CATALOG.coverAmount;
    if (Number.isNaN(amount) || amount < 0 || amount > cap) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Approved amount must be between 0 and ₦${cap.toLocaleString()}.`
      );
    }
    claim.approvedAmount = amount;
  }
  if (input.adminNotes != null) claim.adminNotes = String(input.adminNotes);
  if (input.status) claim.status = input.status;
  if (input.adminId && mongoose.isValidObjectId(input.adminId)) {
    claim.reviewedBy = new Types.ObjectId(input.adminId);
  }
  claim.reviewedAt = new Date();
  await claim.save();

  if (input.status === "approved" || input.status === "paid") {
    if (policy && policy.status === "active") {
      policy.status = "claimed";
      await policy.save();
      await DB.Models.Preference.findByIdAndUpdate(claim.preference, {
        $set: { "searchInsurance.status": "claimed" },
      });
    }
  }

  const buyer = await DB.Models.Buyer.findById(claim.buyer)
    .select("fullName email")
    .lean();
  if (buyer?.email && input.status) {
    const html = generalEmailLayout(
      searchInsuranceClaimDecisionMail({
        fullName: String((buyer as any).fullName || ""),
        policyReference: policy?.policyReference || "",
        status: input.status,
        adminNotes: claim.adminNotes,
        approvedAmount: claim.approvedAmount,
      })
    );
    void sendEmail({
      to: buyer.email,
      subject: `Search insurance claim ${input.status}`,
      text: html,
      html,
    });
  }

  return claim;
}
