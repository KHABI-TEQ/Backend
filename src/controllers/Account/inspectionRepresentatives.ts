import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { JoiValidator } from "../../validators/JoiValidator";
import {
  addInspectionRepresentativeSchema,
  updateInspectionRepresentativeSchema,
  MAX_REPRESENTATIVES,
} from "../../validators/inspectionRepresentatives.validator";

function allowedPublisherUserType(userType: string): boolean {
  return userType === "Landowners" || userType === "Developer";
}

function normalizeRepEmail(email?: string | null): string {
  return String(email || "").trim().toLowerCase();
}

export async function listInspectionRepresentatives(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    if (!allowedPublisherUserType(req.user!.userType)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Landlords and Developers can manage inspection representatives",
      );
    }

    const user = await DB.Models.User.findById(userId).select("inspectionNotificationRepresentatives").lean();
    const reps = (user as any)?.inspectionNotificationRepresentatives ?? [];
    res.status(HttpStatusCodes.OK).json({ success: true, data: { representatives: reps } });
  } catch (e) {
    next(e);
  }
}

export async function addInspectionRepresentative(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    if (!allowedPublisherUserType(req.user!.userType)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Landlords and Developers can manage inspection representatives",
      );
    }

    const validation = JoiValidator.validate(addInspectionRepresentativeSchema, req.body);
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
    }

    const row = validation.data!;
    const emailNorm = normalizeRepEmail(row.email);
    const whatsappNorm = String(row.whatsappNumber || "").trim() || undefined;

    const current = await DB.Models.User.findById(userId).select("inspectionNotificationRepresentatives").lean();
    const existing = ((current as any)?.inspectionNotificationRepresentatives ?? []) as {
      email?: string;
    }[];
    if (existing.length >= MAX_REPRESENTATIVES) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `You can add at most ${MAX_REPRESENTATIVES} representatives`,
      );
    }

    if (emailNorm) {
      const dup = existing.some((x) => normalizeRepEmail(x.email) === emailNorm);
      if (dup) throw new RouteError(HttpStatusCodes.BAD_REQUEST, "This email is already in your list");
    }

    const doc = await DB.Models.User.findByIdAndUpdate(
      userId,
      {
        $push: {
          inspectionNotificationRepresentatives: {
            label: row.label?.trim() || undefined,
            email: emailNorm || undefined,
            whatsappNumber: whatsappNorm,
          },
        },
      },
      { new: true },
    ).select("inspectionNotificationRepresentatives");

    const added = (doc as any)?.inspectionNotificationRepresentatives?.slice(-1)?.[0];
    res.status(HttpStatusCodes.CREATED).json({ success: true, data: { representative: added } });
  } catch (e) {
    next(e);
  }
}

export async function updateInspectionRepresentative(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    if (!allowedPublisherUserType(req.user!.userType)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Landlords and Developers can manage inspection representatives",
      );
    }

    const { representativeId } = req.params;
    if (!representativeId || !Types.ObjectId.isValid(representativeId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid representative id");
    }

    const validation = JoiValidator.validate(updateInspectionRepresentativeSchema, req.body);
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
    }

    const patch = validation.data!;
    const user = await DB.Models.User.findById(userId).select("inspectionNotificationRepresentatives").lean();
    const reps = ((user as any)?.inspectionNotificationRepresentatives ?? []) as {
      _id: Types.ObjectId;
      email?: string;
      whatsappNumber?: string;
      label?: string;
    }[];

    const idx = reps.findIndex((r) => String(r._id) === representativeId);
    if (idx === -1) throw new RouteError(HttpStatusCodes.NOT_FOUND, "Representative not found");

    const nextRow = { ...reps[idx] };
    if (patch.label !== undefined) nextRow.label = patch.label?.trim() || undefined;
    if (patch.email !== undefined) nextRow.email = normalizeRepEmail(patch.email) || undefined;
    if (patch.whatsappNumber !== undefined) {
      nextRow.whatsappNumber = String(patch.whatsappNumber || "").trim() || undefined;
    }

    const finalEmail = nextRow.email;
    const finalWa = nextRow.whatsappNumber;
    if (!finalEmail && !finalWa) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Representative must keep at least one of email or WhatsApp number",
      );
    }

    if (finalEmail) {
      const dup = reps.some((r, i) => i !== idx && normalizeRepEmail(r.email) === finalEmail);
      if (dup) throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Another representative already uses this email");
    }

    const repOid = new Types.ObjectId(representativeId);
    await DB.Models.User.updateOne(
      { _id: userId, "inspectionNotificationRepresentatives._id": repOid },
      {
        $set: {
          "inspectionNotificationRepresentatives.$.label": nextRow.label,
          "inspectionNotificationRepresentatives.$.email": nextRow.email,
          "inspectionNotificationRepresentatives.$.whatsappNumber": nextRow.whatsappNumber,
        },
      },
    );

    const updated = await DB.Models.User.findById(userId).select("inspectionNotificationRepresentatives").lean();
    const list = ((updated as any)?.inspectionNotificationRepresentatives ?? []) as { _id: Types.ObjectId }[];
    const rep = list.find((r) => String(r._id) === representativeId);

    res.status(HttpStatusCodes.OK).json({ success: true, data: { representative: rep } });
  } catch (e) {
    next(e);
  }
}

export async function deleteInspectionRepresentative(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    if (!allowedPublisherUserType(req.user!.userType)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Landlords and Developers can manage inspection representatives",
      );
    }

    const { representativeId } = req.params;
    if (!representativeId || !Types.ObjectId.isValid(representativeId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid representative id");
    }

    const result = await DB.Models.User.updateOne(
      { _id: userId },
      { $pull: { inspectionNotificationRepresentatives: { _id: new Types.ObjectId(representativeId) } } },
    );

    if (result.modifiedCount === 0) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Representative not found");
    }

    res.status(HttpStatusCodes.OK).json({ success: true, message: "Representative removed" });
  } catch (e) {
    next(e);
  }
}
