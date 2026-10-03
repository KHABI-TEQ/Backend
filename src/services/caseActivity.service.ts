import { Types } from "mongoose";
import { DB } from "../controllers";
import {
  CaseActivityAction,
  CaseActivityActorType,
  CaseActivityVisibility,
} from "../models/caseActivityLog";

export interface ILogCaseActivityParams {
  caseId: any;
  registrationId: any;
  actorType: CaseActivityActorType;
  actorId?: any;
  actorLabel?: string;
  action: CaseActivityAction;
  visibility?: CaseActivityVisibility;
  message: string;
  meta?: Record<string, unknown>;
}

export async function logCaseActivity(params: ILogCaseActivityParams): Promise<void> {
  const caseObjectId =
    typeof params.caseId === "string" ? new Types.ObjectId(params.caseId) : params.caseId;
  const registrationObjectId =
    typeof params.registrationId === "string"
      ? new Types.ObjectId(params.registrationId)
      : params.registrationId;
  const actorObjectId =
    params.actorId && typeof params.actorId === "string"
      ? new Types.ObjectId(params.actorId)
      : (params.actorId as Types.ObjectId | undefined);

  await DB.Models.CaseActivityLog.create({
    caseId: caseObjectId,
    registrationId: registrationObjectId,
    actorType: params.actorType,
    actorId: actorObjectId,
    actorLabel: params.actorLabel,
    action: params.action,
    visibility: params.visibility ?? "internal",
    message: params.message,
    meta: params.meta,
  });

  // Update lastActivityAt on the Case document
  await DB.Models.Case.findByIdAndUpdate(caseObjectId, {
    $set: { lastActivityAt: new Date() },
  });
}
