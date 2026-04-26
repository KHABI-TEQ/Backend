import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { preferenceValidationSchema } from "../../../validators/preference.validator";
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "../../../services/whatsappClient.service";
import { preferencePayloadToUserPreferences } from "../../../utils/preferenceUserPreferencesForWhatsapp";

export const updateBuyerPreferenceById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { buyerId, preferenceId } = req.params;

    if (!buyerId || !preferenceId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "buyerId and preferenceId are required",
      });
    }

    // Validate Payload
    const payload = await preferenceValidationSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const before = await DB.Models.Preference.findOne({
      _id: preferenceId,
      buyer: buyerId,
    })
      .select("assignedAgent")
      .lean();

    const oldAgentId = before?.assignedAgent
      ? String(before.assignedAgent)
      : "";

    const updatedPreference = await DB.Models.Preference.findOneAndUpdate(
      { _id: preferenceId, buyer: buyerId },
      { $set: payload },
      { new: true },
    )
      .populate("buyer")
      .populate({ path: "assignedAgent", populate: { path: "userId", select: "firstName lastName phoneNumber" } });

    if (!updatedPreference) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Preference not found for this buyer",
        ),
      );
    }

    const up: any = updatedPreference;
    const contact = up.contactInfo || {};
    const contactPhone = String(
      (up.buyer as any)?.whatsAppNumber ||
        (up.buyer as any)?.phoneNumber ||
        contact.phoneNumber ||
        ""
    ).replace(/\s/g, "");
    if (isLikelyE164CapableLocalPhone(contactPhone)) {
      const prefs = preferencePayloadToUserPreferences(payload);
      void runWhatsapp("preference_update_whatsapp", async (wa) => {
        await wa.sendPreferencesUpdated({
          user: {
            name: (up.buyer as any)?.fullName || contact.fullName || "there",
            phone: contactPhone,
            id: String(buyerId),
          },
          preferences: prefs,
        });
      });
    }

    const newAgentId = up.assignedAgent?._id
      ? String(up.assignedAgent._id)
      : "";
    if (newAgentId && newAgentId !== oldAgentId && up.assignedAgent?.userId) {
      const u = up.assignedAgent.userId as {
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
      };
      const agentName = [u.firstName, u.lastName].filter(Boolean).join(" ");
      const agentPhone = (u.phoneNumber || "").replace(/\s/g, "");
      if (isLikelyE164CapableLocalPhone(contactPhone) && isLikelyE164CapableLocalPhone(agentPhone)) {
        void runWhatsapp("preference_agent_assignment_whatsapp", async (wa) => {
          const prefs = preferencePayloadToUserPreferences(payload);
          await wa.sendAgentAssignment({
            user: {
              name: (up.buyer as any)?.fullName || contact.fullName || "there",
              phone: contactPhone,
              id: String(buyerId),
              preferences: prefs,
            },
            agent: { name: agentName || "Agent", phone: agentPhone, id: newAgentId },
            property: undefined,
            reason: "preference update",
          });
        });
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference updated successfully",
      data: updatedPreference,
    });
  } catch (err: any) {
    if (err?.isJoi) {
      const message = err.details?.map((e: any) => e.message).join(", ");
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }

    next(err);
  }
};
