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

/** Approved, user-owned listing the publisher may attach per-property inspection contacts to. */
async function loadPropertyForRepManagement(req: AppRequest, propertyId: string) {
  const userId = req.user?._id;
  if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
  if (!allowedPublisherUserType(req.user!.userType)) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Only Landlords and Developers can manage inspection representatives",
    );
  }
  if (!Types.ObjectId.isValid(propertyId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid property id");
  }

  const isAdmin = req.user!.role === "admin";
  const filter: Record<string, unknown> = {
    _id: new Types.ObjectId(propertyId),
    ownerModel: "User",
    isDeleted: { $ne: true },
    isApproved: true,
  };
  if (!isAdmin) {
    filter.owner = userId;
  }

  const property = await DB.Models.Property.findOne(filter)
    .select("owner inspectionNotificationRepresentatives")
    .lean();

  if (!property) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      "Approved property not found, or you do not have permission to manage its representatives",
    );
  }

  return property;
}

/**
 * @swagger
 * /account/properties/{propertyId}/inspection-representatives:
 *   get:
 *     tags:
 *       - Account > Inspections
 *     summary: List property inspection representatives
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Property inspection representatives fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     representatives:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only Landlords and Developers can manage inspection representatives
 *       404:
 *         description: Approved property not found or no permission
 */
export async function listPropertyInspectionRepresentatives(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const { propertyId } = req.params;
    const property = await loadPropertyForRepManagement(req, propertyId);
    const reps = (property as any)?.inspectionNotificationRepresentatives ?? [];
    res.status(HttpStatusCodes.OK).json({ success: true, data: { representatives: reps } });
  } catch (e) {
    next(e);
  }
}

/**
 * @swagger
 * /account/properties/{propertyId}/inspection-representatives:
 *   post:
 *     tags:
 *       - Account > Inspections
 *     summary: Add property inspection representative
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               label:
 *                 type: string
 *                 description: Representative label/name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Representative email address
 *               whatsappNumber:
 *                 type: string
 *                 description: Representative WhatsApp number
 *     responses:
 *       201:
 *         description: Representative added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     representative:
 *                       type: object
 *       400:
 *         description: Invalid request body or maximum representatives reached
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only Landlords and Developers can manage inspection representatives
 *       404:
 *         description: Approved property not found or no permission
 */
export async function addPropertyInspectionRepresentative(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const { propertyId } = req.params;
    await loadPropertyForRepManagement(req, propertyId);

    const validation = JoiValidator.validate(addInspectionRepresentativeSchema, req.body);
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
    }

    const row = validation.data!;
    const emailNorm = normalizeRepEmail(row.email);
    const whatsappNorm = String(row.whatsappNumber || "").trim() || undefined;

    const current = await DB.Models.Property.findById(propertyId)
      .select("inspectionNotificationRepresentatives")
      .lean();
    const existing = ((current as any)?.inspectionNotificationRepresentatives ?? []) as { email?: string }[];
    if (existing.length >= MAX_REPRESENTATIVES) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `You can add at most ${MAX_REPRESENTATIVES} representatives per property`,
      );
    }

    if (emailNorm) {
      const dup = existing.some((x) => normalizeRepEmail(x.email) === emailNorm);
      if (dup) throw new RouteError(HttpStatusCodes.BAD_REQUEST, "This email is already in this property's list");
    }

    const doc = await DB.Models.Property.findByIdAndUpdate(
      propertyId,
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

/**
 * @swagger
 * /account/properties/{propertyId}/inspection-representatives/{representativeId}:
 *   patch:
 *     tags:
 *       - Account > Inspections
 *     summary: Update property inspection representative
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *       - in: path
 *         name: representativeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Representative ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 description: Representative label/name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Representative email address
 *               whatsappNumber:
 *                 type: string
 *                 description: Representative WhatsApp number
 *     responses:
 *       200:
 *         description: Representative updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     representative:
 *                       type: object
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only Landlords and Developers can manage inspection representatives
 *       404:
 *         description: Representative not found
 */
export async function updatePropertyInspectionRepresentative(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const { propertyId, representativeId } = req.params;
    await loadPropertyForRepManagement(req, propertyId);

    if (!representativeId || !Types.ObjectId.isValid(representativeId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid representative id");
    }

    const validation = JoiValidator.validate(updateInspectionRepresentativeSchema, req.body);
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
    }

    const patch = validation.data!;
    const propDoc = await DB.Models.Property.findById(propertyId)
      .select("inspectionNotificationRepresentatives")
      .lean();
    const reps = ((propDoc as any)?.inspectionNotificationRepresentatives ?? []) as {
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
    await DB.Models.Property.updateOne(
      { _id: propertyId, "inspectionNotificationRepresentatives._id": repOid },
      {
        $set: {
          "inspectionNotificationRepresentatives.$.label": nextRow.label,
          "inspectionNotificationRepresentatives.$.email": nextRow.email,
          "inspectionNotificationRepresentatives.$.whatsappNumber": nextRow.whatsappNumber,
        },
      },
    );

    const updated = await DB.Models.Property.findById(propertyId)
      .select("inspectionNotificationRepresentatives")
      .lean();
    const list = ((updated as any)?.inspectionNotificationRepresentatives ?? []) as { _id: Types.ObjectId }[];
    const rep = list.find((r) => String(r._id) === representativeId);

    res.status(HttpStatusCodes.OK).json({ success: true, data: { representative: rep } });
  } catch (e) {
    next(e);
  }
}

/**
 * @swagger
 * /account/properties/{propertyId}/inspection-representatives/{representativeId}:
 *   delete:
 *     tags:
 *       - Account > Inspections
 *     summary: Delete property inspection representative
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *       - in: path
 *         name: representativeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Representative ID
 *     responses:
 *       200:
 *         description: Representative removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid representative id
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only Landlords and Developers can manage inspection representatives
 *       404:
 *         description: Representative not found
 */
export async function deletePropertyInspectionRepresentative(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const { propertyId, representativeId } = req.params;
    await loadPropertyForRepManagement(req, propertyId);

    if (!representativeId || !Types.ObjectId.isValid(representativeId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid representative id");
    }

    const result = await DB.Models.Property.updateOne(
      { _id: propertyId },
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
