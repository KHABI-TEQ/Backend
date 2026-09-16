import { Types } from "mongoose";
import { DB } from "../controllers";
import type { TransactionCertificateAuditAction } from "../models/transactionRegistrationActivityLog";

export async function logCertificateActivity(params: {
  registrationId: Types.ObjectId | string;
  transactionReference?: string;
  actorType?: "User" | "Buyer" | "Admin" | "System" | "BRM";
  actorId?: Types.ObjectId | string;
  actorLabel?: string;
  action: TransactionCertificateAuditAction;
  previousValue?: unknown;
  nextValue?: unknown;
  reason?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await DB.Models.TransactionRegistrationActivityLog.create({
      registrationId: new Types.ObjectId(String(params.registrationId)),
      transactionReference: params.transactionReference,
      actorType: params.actorType || "System",
      actorId: params.actorId ? new Types.ObjectId(String(params.actorId)) : undefined,
      actorLabel: params.actorLabel,
      action: params.action,
      previousValue: params.previousValue,
      nextValue: params.nextValue,
      reason: params.reason,
      meta: params.meta || {},
    });
  } catch (err) {
    console.error("[certificate-audit] Failed to write activity log:", err);
  }
}
