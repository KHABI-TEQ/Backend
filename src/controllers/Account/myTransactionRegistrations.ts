import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { RouteError } from "../../common/classes";
import { toAuthorizedCertificateView } from "../../services/transactionCertificateRecord.service";
import { normalizeTransactionReference } from "../../services/transactionReference.service";
import { ensureTransactionCertificateIdentity } from "../../services/transactionRegistrationCertificate.service";
import { logCertificateActivity } from "../../services/transactionCertificateAudit.service";

function requireUserId(req: AppRequest) {
  const id = req.user?._id;
  if (!id) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated.");
  }
  return String(id);
}

async function ownedPropertyIds(userId: string) {
  const properties = await DB.Models.Property.find({
    $or: [{ createdBy: userId }, { owner: userId }],
  })
    .select("_id")
    .lean();
  return properties.map((item) => item._id);
}

function listItem(reg: any) {
  return {
    id: String(reg._id),
    property: reg.propertyLocationLabel || reg.propertyIdentification?.exactAddress || "Recorded property",
    propertyCode: reg.propertyCode || null,
    transactionReference: reg.transactionReference || null,
    transactionStatus: reg.status,
    certificateStatus: reg.certificateStatus || null,
    registrationDate: reg.createdAt,
    certificateUrl: reg.certificateUrl || null,
    hasCertificate: Boolean(reg.certificateUrl && (reg.status === "certificate_issued" || reg.status === "completed")),
  };
}

export const listMyTransactionRegistrations = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireUserId(req);
    const propertyIds = await ownedPropertyIds(userId);
    const agent = await DB.Models.Agent.findOne({ userId }).select("_id").lean();

    const or: Record<string, unknown>[] = [];
    if (propertyIds.length) or.push({ propertyId: { $in: propertyIds } });
    if (agent?._id) or.push({ agentId: agent._id });
    if (req.user?.email) or.push({ "buyer.email": String(req.user.email).toLowerCase() });

    if (!or.length) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: { transactions: [] },
      });
    }

    const transactions = await DB.Models.TransactionRegistration.find({ $or: or })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { transactions: transactions.map(listItem) },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyTransactionCertificate = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireUserId(req);
    const reference = normalizeTransactionReference(String(req.params.reference || ""));
    if (!reference) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Transaction reference is required.");
    }

    const registration = Types.ObjectId.isValid(reference)
      ? await DB.Models.TransactionRegistration.findOne({
          $or: [{ transactionReference: reference }, { _id: reference }],
        })
      : await DB.Models.TransactionRegistration.findOne({ transactionReference: reference });

    if (!registration) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Transaction record not found.");
    }

    const propertyIds = await ownedPropertyIds(userId);
    const agent = await DB.Models.Agent.findOne({ userId }).select("_id").lean();
    const email = String(req.user?.email || "").toLowerCase();
    const authorized =
      (registration.propertyId && propertyIds.some((id) => String(id) === String(registration.propertyId))) ||
      (agent?._id && String(agent._id) === String(registration.agentId)) ||
      (email && email === String(registration.buyer?.email || "").toLowerCase());

    if (!authorized) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view this certificate.");
    }

    await ensureTransactionCertificateIdentity(registration);
    await registration.save();

    void logCertificateActivity({
      registrationId: String(registration._id),
      transactionReference: registration.transactionReference,
      actorType: "User",
      actorId: userId,
      action: "CERTIFICATE_DOWNLOADED",
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: toAuthorizedCertificateView(registration),
    });
  } catch (error) {
    next(error);
  }
};
