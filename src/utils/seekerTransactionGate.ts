import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { AppRequest } from "../types/express";
import { preferenceIdFromBooking } from "./seekerJourney";

export async function resolveBuyerInspectionLink(params: {
  inspectionId?: string;
  buyerId?: string;
}): Promise<{
  inspectionId: string;
  propertyId?: string;
  preferenceId?: string;
}> {
  const inspectionId = String(params.inspectionId || "").trim();
  if (!inspectionId) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Select the inspected property this due diligence is for."
    );
  }

  const inspection = await DB.Models.InspectionBooking.findById(inspectionId).lean();
  if (!inspection) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection booking not found.");
  }

  const cancelled = ["cancelled", "agent_rejected", "transaction_failed"].includes(
    String((inspection as any).status || "")
  );
  if (cancelled) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "That inspection was cancelled or rejected and cannot be used for due diligence."
    );
  }

  if (params.buyerId) {
    const ownerIds = [inspection.bookedBy, inspection.requestedBy]
      .filter(Boolean)
      .map((id) => String(id));
    if (!ownerIds.includes(String(params.buyerId))) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "That inspection does not belong to your buyer account."
      );
    }
  }

  const preferenceId = preferenceIdFromBooking(inspection);
  const propertyId = String((inspection as any).propertyId || "");

  return {
    inspectionId: String(inspection._id),
    propertyId: propertyId || undefined,
    preferenceId: preferenceId || undefined,
  };
}

export function inspectionLinkFields(link: {
  inspectionId: string;
  propertyId?: string;
  preferenceId?: string;
}) {
  const fields: Record<string, Types.ObjectId> = {
    inspectionId: new Types.ObjectId(link.inspectionId),
  };
  if (link.propertyId && Types.ObjectId.isValid(link.propertyId)) {
    fields.propertyId = new Types.ObjectId(link.propertyId);
  }
  if (link.preferenceId && Types.ObjectId.isValid(link.preferenceId)) {
    fields.preferenceId = new Types.ObjectId(link.preferenceId);
  }
  return fields;
}

export async function hasKhabiteqProfessionalEngagement(
  buyerId: string,
  inspectionId?: string
): Promise<boolean> {
  if (!buyerId) return false;
  const filter: Record<string, unknown> = { buyerId };
  if (inspectionId) filter.inspectionId = inspectionId;
  const jobFilter: Record<string, unknown> = {
    buyerId,
    status: { $nin: ["cancelled", "declined", "payment-failed"] },
  };
  if (inspectionId) jobFilter.inspectionId = inspectionId;

  const [doc, survey, job] = await Promise.all([
    DB.Models.DocumentVerification.findOne(filter).select("_id").lean(),
    DB.Models.SurveyRequest.findOne(filter).select("_id").lean(),
    DB.Models.ProfessionalServiceRequest.findOne(jobFilter).select("_id").lean(),
  ]);
  return Boolean(doc || survey || job);
}

export async function loadBuyerFromRequest(req: AppRequest) {
  if (req.buyer?._id) return req.buyer;
  const rawAuthHeader = req.headers.authorization || req.headers.Authorization;
  if (!rawAuthHeader || typeof rawAuthHeader !== "string") return null;
  const token = rawAuthHeader.split(" ")[1];
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    if (decoded.role !== "buyer" && decoded.userType !== "Buyer") return null;
    return await DB.Models.Buyer.findById(decoded.id).select("-password");
  } catch {
    return null;
  }
}

export async function assertSeekerCanRegisterTransaction(params: {
  inspectionId?: string;
  buyerId?: string;
}): Promise<void> {
  const inspectionId = String(params.inspectionId || "").trim();
  if (!inspectionId) return;

  if (!params.buyerId) {
    throw new RouteError(
      HttpStatusCodes.UNAUTHORIZED,
      "Sign in to your buyer account to register this transaction."
    );
  }

  const inspection = await DB.Models.InspectionBooking.findById(inspectionId).lean();
  if (!inspection) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found.");
  }

  const ownerIds = [inspection.bookedBy, inspection.requestedBy]
    .filter(Boolean)
    .map((id) => String(id));
  if (!ownerIds.includes(String(params.buyerId))) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "This inspection does not belong to your buyer account."
    );
  }

  const path = String((inspection as any).dueDiligencePath || "");
  if (path === "independent") {
    if (!(inspection as any).independentDeclaration?.acceptedAt) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Confirm your independent due diligence declaration before registering this transaction."
      );
    }
    return;
  }

  if (path === "platform") {
    const engaged = await hasKhabiteqProfessionalEngagement(
      String(params.buyerId),
      inspectionId
    );
    if (!engaged) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Hire a Khabiteq professional for due diligence before registering this transaction."
      );
    }
    return;
  }

  throw new RouteError(
    HttpStatusCodes.BAD_REQUEST,
    "Record due diligence on this inspection before registering the transaction."
  );
}
